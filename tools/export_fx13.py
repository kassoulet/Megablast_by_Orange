#!/usr/bin/env python3
"""export_fx13.py: assets of stage 14 (crowd -> Dali, update 0x203c4, render 0x201ea) -> web/assets/fx13.bin
layout: palette 768 B (6-bit DAC, static .data at 0x469ec of the clean dump) | sine table 4096 x int16 LE (static dword table at 0x3705e, values -1023..1023) |
asset 17 (7 RLE frames of 160x100, 69020 B, DATA.DAT) | asset 21 (320x350 picture, 112000 B)."""
import struct,glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
m=open(R+'mem.bin','rb'); m.seek(0x469ec); pal=m.read(768); m.seek(0x3705e); sine=struct.unpack('<4096i',m.read(16384))
assert all(-1024<v<1024 for v in sine)
a17=open(glob.glob(R+'assets/17_*.bin')[0],'rb').read(); a21=open(glob.glob(R+'assets/21_*.bin')[0],'rb').read()
assert len(a17)==69020 and len(a21)==112000
open(H+'/../web/assets/fx13.bin','wb').write(pal+struct.pack('<4096h',*sine)+a17+a21)
