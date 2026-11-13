#!/usr/bin/env python3
"""extract_data.py: DATA.DAT is NOT an archive: it is one 4,010,595-byte blob read whole into memory (DPMI alloc 0x3d3263, fn 0x21dc6) and the program
holds a table of 24 *offsets* at 0x4ab1d (relocated by the base address at load). This script cuts the 24 assets by that table into assets/ and
makes PNG previews of the image ones (RIX3, PCX). Usage: python3 extract_data.py"""
import struct,os
from PIL import Image
H=os.path.dirname(os.path.abspath(__file__)); A=H+'/assets'; os.makedirs(A,exist_ok=True)
d=open(H+'/../DATA.DAT','rb').read()
T=[0x0,0x1030a,0x1430a,0x23d0a,0x2f4db,0x2dc01b,0x2fb41b,0x30b725,0x30f725,0x31f125,0x32eb25,0x339786,0x344453,0x34e919,0x35503d,0x35de92,0x362c6c,0x372976,0x383712,0x393112,0x397112,0x3a6b12,0x3c2092,0x3c3863]
T[4]=0x2f4db
def pcx(b):
    xmin,ymin,xmax,ymax=struct.unpack_from('<4H',b,4); w=xmax-xmin+1; h=ymax-ymin+1; p=128; out=bytearray(); bpl=struct.unpack_from('<H',b,66)[0]
    while len(out)<bpl*h:
        c=b[p]; p+=1
        if c>=0xc0: n=c&63; out+=bytes([b[p]])*n; p+=1
        else: out.append(c)
    pal=b[p+1:p+769] if b[p]==12 else b[16:64]
    im=Image.frombytes('P',(w,h),bytes(out[:bpl*h]) if bpl==w else b''.join(bytes(out[y*bpl:y*bpl+w]) for y in range(h)))
    im.putpalette(pal); return im
def rix(b):
    w,h=struct.unpack_from('<HH',b,4); pal=bytes(min(255,v*4) for v in b[10:10+768]) if b[8]&0x80 else None
    im=Image.frombytes('P',(w,h),b[10+768:10+768+w*h]); im.putpalette(pal); return im
for i,o in enumerate(T):
    e=T[i+1] if i<23 else len(d); b=d[o:e]; open('%s/%02d_%06x_%d.bin'%(A,i,o,len(b)),'wb').write(b)
    try:
        if b[:4]==b'RIX3': rix(b).save('%s/%02d.png'%(A,i))
        elif b[:2]==b'\n\5': pcx(b).save('%s/%02d.png'%(A,i))
        elif len(b) in(64000,): Image.frombytes('L',(320,200),b).save('%s/%02d.png'%(A,i))
        elif len(b)==16384: Image.frombytes('L',(128,128),b).save('%s/%02d.png'%(A,i))
    except Exception as ex: print(i,'preview failed',ex)
    print(i,hex(o),len(b),b[:4])
