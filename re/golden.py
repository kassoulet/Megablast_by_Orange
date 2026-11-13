#!/usr/bin/env python3
"""golden.py OUTDIR T0 T1 STEP_SEC [K]: run the original from the start with the virtual clock (K ticks of 70.086 Hz per rendered frame, default 7),
save a PNG (320x200, original pixels; display at 4:3) every STEP_SEC seconds as tNNNN.NN.png and log stage changes (main-loop hook hit) to OUTDIR/stages.txt"""
import sys,os,time
import harness as H,emucore as E
from PIL import Image
from unicorn.x86_const import *
out=sys.argv[1]; t0=float(sys.argv[2]); t1=float(sys.argv[3]); step=float(sys.argv[4]); k=int(sys.argv[5]) if len(sys.argv)>5 else 7
os.makedirs(out,exist_ok=True)
g=H.Golden(); g.k=k; g.stop_at=int(t1*H.TICK_HZ)+1
nxt=[t0]; T=time.time(); last=[None]; st=open(out+'/stages.txt','a')
def cb(g):
    t=g.ticks/H.TICK_HZ
    a=E.ireg('EIP')
    if a!=last[0]:
        last[0]=a; o=H.rd32(0x4ab11); st.write('%.2f hook %x order %d mode %d\n'%(t,a,o,H.VGA.mode)); st.flush()
    if t>=nxt[0]:
        Image.fromarray(g.frame_rgb()).save('%s/t%07.2f.png'%(out,t)); nxt[0]+=step
        if int(t)%10==0: print('%.1f %.0fs'%(t,time.time()-T),flush=True)
g.on_frame=cb
eip=0x27d20
while True:
    E.mu.emu_start(eip,0,count=200000000); eip=E.ireg('EIP')
    if g.ticks>=g.stop_at or E.exited[0]: break
