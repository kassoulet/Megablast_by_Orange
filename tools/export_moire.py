#!/usr/bin/env python3
"""export_moire.py: assets of the moire family (stages fx02/fx03/fx08/fx10: render 0x1d770/0x1d378/0x1dade/0x1d574) -> web/assets/moire.bin
layout: sine 5121 int32 (static 0x3705e; cos = +1025 entries) | texture 65536 (asset 0 = RIX 256x256, 0x30a header+palette skipped) | palette 768 (6-bit) | LUT 16384 (asset 1) |
7 backgrounds x 64000 (PCX assets 14,12,10,11 = fx02 orders 5..8; 3 = fx03; 13 = fx08; 15 = fx10, decoded as 0x1c768 does: skip 0x80, RLE until 64000 bytes) | row fade table 70 int32 (static 0x447de)."""
import struct,glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
g=lambda n:open(glob.glob(R+'assets/%02d_*.bin'%n)[0],'rb').read()
def pcx(b):
    p=0x80; o=bytearray()
    while len(o)<64000:
        c=b[p]; p+=1
        if c&0xc0==0xc0: o+=bytes([b[p]])*(c&63); p+=1
        else: o.append(c)
    assert len(o)==64000; return bytes(o)
m=open(R+'mem.bin','rb').read()
a0,a1=g(0),g(1); assert len(a0)==66314 and len(a1)==16384
out=m[0x3705e:0x3705e+5121*4]+a0[0x30a:0x30a+65536]+a0[0xa:0x30a]+a1
for n in (14,12,10,11,3,13,15):
    b=pcx(g(n)); print('asset',n,'max pixel',max(b)); out+=b
out+=m[0x447de:0x447de+70*4]
open(H+'/../web/assets/moire.bin','wb').write(out); print(len(out),'max pal',max(a0[0xa:0x30a]))
