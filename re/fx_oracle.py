#!/usr/bin/env python3
"""fx_oracle.py: per-frame ORACLE of one stage of the ORIGINAL code under the Unicorn harness (harness.py, virtual clock).
env: STAGE=hook addr of the stage (hex, one of harness.FRAME_HOOKS, e.g. 1c612), NEXT=hook of the next stage (stop), UPD=update fn addr, REND=render fn addr, RET=addr of the render's final ret (VRAM already written),
K1ORDER=S3M order from which the clock runs at K=1 (70 fps, one update per render; before: K=7 for speed), STATE=addr:size,... (hex, read at render entry), OUT=x.npz.
Per frame it stores: n (updates run since the stage's first update, counted at the update fn entry), ticks (virtual 70.086 Hz clock), order,row (what the stub gave the demo), the STATE words, idx (64000 VRAM bytes after the render), pal (768 DAC bytes, 6-bit).
usage: STAGE=1c612 NEXT=1c678 UPD=203c4 REND=201ea RET=202ad K1ORDER=25 STATE=47200:4,46610:4,46cec:4 OUT=/path/x.npz python3 fx_oracle.py"""
import os,sys,time
import numpy as np
import harness as H,emucore as E
from unicorn import *
X=lambda k:int(os.environ[k],16)
STAGE,NEXT,UPD,REND,RET=X('STAGE'),X('NEXT'),X('UPD'),X('REND'),X('RET'); K1=int(os.environ['K1ORDER'],16)
ST=[(int(a.split(':')[0],16),int(a.split(':')[1])) for a in os.environ.get('STATE','').split(',') if a]
g=H.Golden(); g.k=7; g.stop_at=int(400*H.TICK_HZ)
n=[0]; started=[False]; fr=[]; pend=[None]; T0=time.time()
def rd(a,s): return int.from_bytes(bytes(E.mu.mem_read(a,s)),'little')
def on_frame(g):
    a=E.ireg('EIP')
    if rd(0x4ab11,4)>=K1 and not started[0]: g.k=1
    if a==NEXT and started[0]: np.savez_compressed(os.environ['OUT'],**{k:np.array([f[k] for f in fr]) for k in fr[0]}); print('saved',len(fr),'frames',time.time()-T0); E.mu.emu_stop(); E.exited[0]=1
    if a==STAGE: started[0]=True
g.on_frame=on_frame
def upd(*a):
    if started[0] or E.ireg('EIP')==UPD: n[0]+=1
E.mu.hook_add(UC_HOOK_CODE,lambda *a:n.__setitem__(0,n[0]+1) if started[0] or True else 0,begin=UPD,end=UPD)
def rend(*a):
    if not started[0]: return
    if os.environ.get('OOB') and not fr and pend[0] is None:   # OOB=bytes: dump the memory just past the 7 decoded frames at [0x46618] (the original reads 1 row past them)
        p=rd(0x46618,4)+112000; open(os.environ['OUT']+'.oob','wb').write(bytes(E.mu.mem_read(p,int(os.environ['OOB'])))); print('oob dumped at',hex(p),flush=True)
    pend[0]=dict(n=n[0],ticks=g.ticks,order=rd(0x4ab11,4),row=rd(0x4ab15,4),**{'a%x'%ad:rd(ad,sz) for ad,sz in ST})
def ret(*a):
    p=pend[0]
    if p is None: return
    p['idx']=np.frombuffer(bytes(E.mu.mem_read(0xA0000,64000)),np.uint8).copy(); p['pal']=np.array(H.pal,np.uint8).reshape(768).copy(); fr.append(p); pend[0]=None
    if os.environ.get('MAXF') and len(fr)>=int(os.environ['MAXF']): np.savez_compressed(os.environ['OUT'],**{k:np.array([f[k] for f in fr]) for k in fr[0]}); E.mu.emu_stop(); E.exited[0]=1
    if len(fr)%200==0: print(len(fr),'frames order',p['order'],'wall %.0f'%(time.time()-T0),flush=True)
E.mu.hook_add(UC_HOOK_CODE,rend,begin=REND,end=REND); E.mu.hook_add(UC_HOOK_CODE,ret,begin=RET,end=RET)
eip=0x27d20
while True:
    E.mu.emu_start(eip,0,count=200000000); eip=E.ireg('EIP')
    if g.ticks>=g.stop_at or E.exited[0]: break
if not os.path.exists(os.environ['OUT']) and fr: np.savez_compressed(os.environ['OUT'],**{k:np.array([f[k] for f in fr]) for k in fr[0]}); print('saved at end',len(fr))
