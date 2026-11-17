#!/usr/bin/env python3
"""export_fx11.py: assets of the shared 0x2217d engine (stages 12, 16, 17) -> web/assets/fx11.bin = sine/cos table 5121 x int32 (static .data 0x3705e, cos(i) = table[i+0x401]) | palette 768 B (6-bit, static 0x4ad24).
Needs re/mem.bin (gunzip -k re/mem.bin.gz)."""
import os
H=os.path.dirname(os.path.abspath(__file__)); m=open(H+'/../re/mem.bin','rb')
m.seek(0x3705e); S=m.read(5121*4); m.seek(0x4ad24); P=m.read(768)
open(H+'/../web/assets/fx11.bin','wb').write(S+P)
