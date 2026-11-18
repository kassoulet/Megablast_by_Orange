#!/usr/bin/env python3
"""export_fx06.py: assets of stage 7 (vortex; init 0x231c4, render 0x23288, table/warp 0x22b80/0x22dfc, matrix 0x28190/0x28318) -> web/assets/fx06.bin
layout: 25 doubles (x87 constants, ds:0x362a4..0x3636c, one every 8 B) 200 | palette 768 (PCX tail, 8-bit; the init writes >>2 to the DAC) | texture 512x512 (PLASTI3D.PCX decoded)."""
import os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
m=open(R+'mem.bin','rb').read(); p=open(H+'/../PLASTI3D.PCX','rb').read()
assert p[0]==10 and p[2]==1 and p[3]==8 and p[-769]==12
W=int.from_bytes(p[8:10],'little')+1; Ht=int.from_bytes(p[10:12],'little')+1; bpl=int.from_bytes(p[0x42:0x44],'little'); assert (W,Ht,bpl)==(512,512,512),(W,Ht,bpl)
o=bytearray(); i=128; end=len(p)-769
while len(o)<W*Ht:
    assert i<end
    c=p[i]; i+=1
    if c&0xc0==0xc0: o+=bytes([p[i]])*(c&63); i+=1
    else: o.append(c)
assert len(o)==W*Ht
out=m[0x362a4:0x362a4+200]+p[-768:]+bytes(o)
open(H+'/../web/assets/fx06.bin','wb').write(out); print(len(out))
