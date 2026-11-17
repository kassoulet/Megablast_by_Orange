#!/usr/bin/env python3
"""export_fx01.py: assets of stage 2 (light rays, update 0x1e752, render 0x1e535, line 0x1e1b1, init 0x1e498) -> web/assets/fx01.bin
layout: sine table 5121 x int16 LE (static dwords at 0x3705e; the render also reads index+1025 as cosine) | asset 2 (64000 B raw 320x200 mask picture: rays are not drawn where it is non-zero)."""
import struct,glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
m=open(R+'mem.bin','rb'); m.seek(0x3705e); sine=struct.unpack('<5121i',m.read(5121*4))
a2=open(glob.glob(R+'assets/02_*.bin')[0],'rb').read(); assert len(a2)==64000
open(H+'/../web/assets/fx01.bin','wb').write(struct.pack('<5121h',*sine)+a2)
