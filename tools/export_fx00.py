#!/usr/bin/env python3
"""export_fx00.py: assets of stage 1 (helicopter, update 0x20401, render 0x2032b, init 0x201b1) -> web/assets/fx00.bin
layout: palette 768 B (6-bit DAC, static .data at 0x46624 of the clean dump) | asset 4 (2804544 B: 240 RLE frames of 160x80)."""
import glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
m=open(R+'mem.bin','rb'); m.seek(0x46624); pal=m.read(768)
a4=open(glob.glob(R+'assets/04_*.bin')[0],'rb').read()
open(H+'/../web/assets/fx00.bin','wb').write(pal+a4)
