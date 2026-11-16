#!/usr/bin/env python3
"""export_fx14.py: assets of stage 15 (bar photo + logo, update 0x22b1c, render 0x227ea, init 0x22602) -> web/assets/fx14.bin
layout: sine/cosine table 5121 x int32 (static .data 0x3705e; cos(i) = table[i + 0x401]) | shade LUT 16384 B (asset 19, [0x4ab69]) | photo 64000 B (asset 20, [0x4ab6d]) |
palette 768 B (asset 16 at 0xa, set once at init) | warp source window: DATA.DAT bytes around the pixels of asset 16 (pixel start = asset + 0x30a, [0x4b048]), WIN before and after the 64000 pixels,
because the warp reads outside the picture (neighbour assets 15 and 17); the 0x30a bytes before the pixels are zeroed by the init (0x2272a)."""
import struct,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
D=open(H+'/../DATA.DAT','rb').read(); WIN=0x5000; A16=0x362c6c; PIX=A16+0x30a
m=open(R+'mem.bin','rb'); m.seek(0x3705e); S=m.read(5121*4)
win=bytearray(D[PIX-WIN:PIX+64000+WIN]); win[WIN-0x30a:WIN]=bytes(0x30a)
open(H+'/../web/assets/fx14.bin','wb').write(S+D[0x393112:0x393112+16384]+D[0x397112:0x397112+64000]+D[A16+0xa:A16+0x30a]+bytes(win))
