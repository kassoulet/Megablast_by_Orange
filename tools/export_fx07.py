#!/usr/bin/env python3
"""export_fx07.py: assets of stage 8 (voronoi wire; update 0x21c3b, render 0x21840, init 0x217de) -> web/assets/fx07.bin
layout: sine 5121 int32 (0x3705e) | vertices 20x3 int32 (0x492ac) | edges 30x2 int32 (0x491bc) | tile patterns 9 rows x 80 B (0x49479 + k*0x140) | palette 768 (0x48bb0, 6-bit) | background 64000 (asset 22, PCX RLE as 0x21520: skip 0x80)."""
import struct,glob,os
H=os.path.dirname(os.path.abspath(__file__)); R=H+'/../re/'
m=open(R+'mem.bin','rb').read()
b=open(glob.glob(R+'assets/22_*.bin')[0],'rb').read(); p=0x80; o=bytearray()
while len(o)<64000:
    c=b[p]; p+=1
    if c&0xc0==0xc0: o+=bytes([b[p]])*(c&63); p+=1
    else: o.append(c)
assert len(o)==64000
out=m[0x3705e:0x3705e+5121*4]+m[0x492ac:0x492ac+240]+m[0x491bc:0x491bc+240]+b''.join(m[0x49479+k*0x140:0x49479+k*0x140+80] for k in range(9))+m[0x48bb0:0x48bb0+768]+bytes(o)
open(H+'/../web/assets/fx07.bin','wb').write(out); print(len(out))
