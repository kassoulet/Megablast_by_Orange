#!/usr/bin/env python3
"""export_fx04.py: assets of stage 5 (light lines, update 0x20c7a, render 0x20a13, init 0x209d7) -> web/assets/fx04.bin
layout: sine table 4096 x int16 LE (static dwords at 0x3705e) | asset 9 (64000 B raw 320x200 background image, added to the blurred line buffer)."""
import struct,glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
m=open(R+'mem.bin','rb'); m.seek(0x3705e); sine=struct.unpack('<4096i',m.read(16384))
a9=open(glob.glob(R+'assets/09_*.bin')[0],'rb').read(); assert len(a9)==64000
open(H+'/../web/assets/fx04.bin','wb').write(struct.pack('<4096h',*sine)+a9)
