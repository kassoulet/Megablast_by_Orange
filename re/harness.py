"""harness.py - run the ORIGINAL Megablast code (unpacked, linear 0x1b000..) under Unicorn with a virtual clock.
 from harness import *; g=Golden(); g.on_frame=cb; g.run()
Virtual time: one 'vsync' = one tick of the demo's own timer (it calls cb 0x1be10 = inc [0x52888] at each retrace) = 70.086 Hz (VGA mode 13h).
Stubs: 0x27936 (PIT/retrace calibration), 0x27ba3 (timer start; we bump the tick ourselves at each virtual retrace),
0x24194 (MIDAS getPlayStatus -> order/pattern/row from MUSTAKS.S3M via s3mtime.json), VGA port 0x3da (retrace by IN-count), palette ports 0x3c8/0x3c9.
Frame boundary = start of virtual retrace seen through port 0x3da; the frame capture is the 320x200 @0xA0000 + palette."""
import emucore as E,struct,json,os,bisect
from unicorn import *
from unicorn.x86_const import *
mu=E.mu
def rd32(a): return struct.unpack('<I',bytes(mu.mem_read(a,4)))[0]
def wr32(a,v): mu.mem_write(a,struct.pack('<I',v&0xffffffff))
TICK_HZ=70.086
# main-loop frame boundaries: 'mov [0x5288c],eax' (last=snapshot) right before each stage's render call; 0x1c33a = loop of the pos-driven PCX stage
FRAME_HOOKS=[0x1c0fa,0x1c166,0x1c1cc,0x1c232,0x1c298,0x1c2fd,0x1c3af,0x1c414,0x1c47a,0x1c4e0,0x1c546,0x1c5ac,0x1c612,0x1c678,0x1c6de,0x1c744,0x1c33a]
STATBUF=0x3f80000
mu.mem_map  # (flat map already covers STATBUF)
P=int(os.environ.get('VPER','24'))   # IN 0x3da reads per virtual frame (retrace = last 6)
try:
    S3M=json.load(open(E.HERE+'/s3mtime.json')); ROWS=S3M['rows']; TIMES=[r[3] for r in ROWS]
except Exception: S3M=None
pal=[[0,0,0] for _ in range(256)]
class VGA: idx=0; sub=0; mode=3; rdidx=0; rdsub=0
def pos_at(t):
    if not S3M: return (0,0,0)
    i=max(0,bisect.bisect_right(TIMES,t)-1); r=ROWS[i]; return r[0],r[1],r[2]  # order,pattern,row
class Golden:
    def __init__(s):
        s.ticks=0; s.cnt=0; s.frames=0; s.on_frame=None; s.stop_at=None; s.pos=None; s.seen={}
        s.fcalls={}
        mu.hook_del=None
        mu.hook_add(UC_HOOK_INSN,s._in,None,1,0,UC_X86_INS_IN)
        mu.hook_add(UC_HOOK_INSN,s._out,None,1,0,UC_X86_INS_OUT)
        mu.hook_add(UC_HOOK_CODE,lambda *a:s.calib(),begin=0x27936,end=0x27936)
        mu.hook_add(UC_HOOK_CODE,lambda *a:s.tstart(),begin=0x27ba3,end=0x27ba3)
        mu.hook_add(UC_HOOK_CODE,lambda *a:s.getstatus(),begin=0x24194,end=0x24194)
        for a in FRAME_HOOKS: mu.hook_add(UC_HOOK_CODE,lambda uc,a,sz,ud:s.vsync(a),begin=a,end=a)
        s.k=7; s.hits={}
        old=E.intr
        mu.hook_add(UC_HOOK_INTR,s._int10)
    def _ret(s,eax=0):
        esp=E.ireg('ESP'); r=rd32(esp); E.w('ESP',esp+4); E.w('EAX',eax); mu.reg_write(UC_X86_REG_EIP,r)
    def calib(s):
        a=rd32(E.ireg('ESP')+4); wr32(a,17030); s._ret()
    def tstart(s): s._ret()
    def getstatus(s):
        esp=E.ireg('ESP'); p=rd32(esp+8); t=s.ticks/TICK_HZ
        o,pat,row=pos_at(t); wr32(p,STATBUF)
        mu.mem_write(STATBUF,struct.pack('<III',o,pat,row)); s._ret()
    def _int10(s,uc,no,_):
        if no==0x10:
            eax=E.ireg('EAX')
            if (eax>>8)&0xff==0: VGA.mode=eax&0xff
    def _in(s,uc,port,size,_):
        if port==0x3da:
            s.cnt+=1; ph=s.cnt%P
            return 8 if ph>=P-6 else 1
        if port==0x3c9:
            v=pal[VGA.rdidx][VGA.rdsub]; VGA.rdsub+=1
            if VGA.rdsub==3: VGA.rdsub=0; VGA.rdidx=(VGA.rdidx+1)&255
            return v
        if port==0x40: return (65535-(s.cnt*37))&0xff
        return E.ports.get(port,0)
    def _out(s,uc,port,size,val,_):
        val&=0xff if size==1 else 0xffffffff
        if port==0x3c8: VGA.idx=val&255; VGA.sub=0
        elif port==0x3c7: VGA.rdidx=val&255; VGA.rdsub=0
        elif port==0x3c9:
            pal[VGA.idx][VGA.sub]=val&63; VGA.sub+=1
            if VGA.sub==3: VGA.sub=0; VGA.idx=(VGA.idx+1)&255
        else: E.ports[port]=val
    def vsync(s,a):
        s.hits[a]=s.hits.get(a,0)+1
        if s.on_frame: s.on_frame(s)                      # frame = result of the previous render
        s.ticks+=s.k; wr32(0x52888,rd32(0x52888)+s.k)     # == k calls of the timer callback 0x1be10 (inc [0x52888])
        if s.stop_at is not None and s.ticks>=s.stop_at: mu.emu_stop()
    def frame_rgb(s):
        import numpy as np
        a=np.frombuffer(bytes(mu.mem_read(0xA0000,64000)),dtype=np.uint8).reshape(200,320)
        p=np.array(pal,dtype=np.uint8); p=(p<<2)|(p>>4)
        return p[a]
    def run(s,n=80000000000): E.run(0x27d20,n)
