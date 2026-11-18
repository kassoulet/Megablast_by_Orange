#!/usr/bin/env python3
"""export_fx05.py: assets of stage 6 (cube grid, update 0x2143a, render 0x2111b, init 0x210bc) -> web/assets/fx05.bin
layout: sine table 5121 x int16 (static dwords at 0x3705e; cos = index+1025) | 64 vertices x 3 int32 (static 0x48560, stride 16) | palette 768 B (static 0x47f60, 6-bit) | asset 8 (64000 B background)."""
import struct,glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
m=open(R+'mem.bin','rb').read()
sine=struct.unpack('<5121i',m[0x3705e:0x3705e+5121*4]); assert max(map(abs,sine))<32768
v=[]
for i in range(64): v+=struct.unpack('<3i',m[0x48560+16*i:0x48560+16*i+12])
pal=m[0x47f60:0x47f60+768]
a8=open(glob.glob(R+'assets/08_*.bin')[0],'rb').read(); assert len(a8)==64000
open(H+'/../web/assets/fx05.bin','wb').write(struct.pack('<5121h',*sine)+struct.pack('<192i',*v)+pal+a8)
