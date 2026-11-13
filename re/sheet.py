#!/usr/bin/env python3
"""sheet.py DIR OUT.png T0 T1 [COLS]: contact sheet of golden/tNNNN.NN.png frames between T0 and T1 seconds (shown 4:3), labelled"""
import sys,glob,os
from PIL import Image,ImageDraw
d,out,t0,t1=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4]); cols=int(sys.argv[5]) if len(sys.argv)>5 else 6
fs=[f for f in sorted(glob.glob(d+'/t*.png')) if t0<=float(os.path.basename(f)[1:-4])<=t1]
w,h=213,160; rows=(len(fs)+cols-1)//cols; sh=Image.new('RGB',(cols*w,rows*h))
for i,f in enumerate(fs):
    im=Image.open(f).convert('RGB').resize((w,h)); ImageDraw.Draw(im).text((2,2),os.path.basename(f)[1:-4],fill=(255,255,0)); sh.paste(im,((i%cols)*w,(i//cols)*h))
sh.save(out)
