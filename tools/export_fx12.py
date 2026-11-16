#!/usr/bin/env python3
"""export_fx12.py: assets of stage 13 (checkerboard tunnel, update 0x206c1, render 0x20659, init 0x205a1) -> web/assets/fx12.bin
layout: offsets 128000 B (asset 5: 320x200 words, [0x4ab31]) | texture 65536 B (asset 6 RIX 256x256: 0x30a header+palette skipped) | palette 768 B (6-bit, asset 6 at 0xa) |
shade table 16384 B (asset 7, [0x4ab39]) | motion table 96 x int32 (static .data 0x47506)."""
import struct,glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
g=lambda n:open(glob.glob(R+'assets/%02d_*.bin'%n)[0],'rb').read()
a5,a6,a7=g(5),g(6),g(7); assert (len(a5),len(a6),len(a7))==(128000,66314,16384)
m=open(R+'mem.bin','rb'); m.seek(0x47506); t=m.read(96*4)
open(H+'/../web/assets/fx12.bin','wb').write(a5+a6[0x30a:0x30a+65536]+a6[0xa:0x30a]+a7+t)
