#!/usr/bin/env python3
"""export_fx09.py: assets of stage 10 (flower blob, update 0x1ffba, render 0x1e8fc, init 0x1e89e) -> web/assets/fx09.bin
layout: sine table 5121 x int16 (static dwords at 0x3705e; cos = index+1025) | splat pattern 256 B (static 0x464ac, the init shifts it >> 2) | asset 18 (64000 B background, [4ab65])."""
import struct,glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
m=open(R+'mem.bin','rb').read()
sine=struct.unpack('<5121i',m[0x3705e:0x3705e+5121*4]); assert max(map(abs,sine))<32768
pat=bytes(b>>2 for b in m[0x464ac:0x464ac+256])
a=open(glob.glob(R+'assets/18_*.bin')[0],'rb').read(); assert len(a)==64000
open(H+'/../web/assets/fx09.bin','wb').write(struct.pack('<5121h',*sine)+pat+a)
