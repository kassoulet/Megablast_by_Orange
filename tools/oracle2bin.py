#!/usr/bin/env python3
"""oracle2bin.py x.npz out.bin: oracle frames -> binary for node checks. file = int32 count, then per frame int32 n,ticks,order,row | 64000 idx | 768 pal(6-bit). Also prints the state fields."""
import sys,numpy as np,struct
z=dict(np.load(sys.argv[1])); N=len(z['n']); o=open(sys.argv[2],'wb'); o.write(struct.pack('<i',N))
for i in range(N): o.write(struct.pack('<4i',*(int(z[k][i]) for k in ('n','ticks','order','row')))+z['idx'][i].tobytes()+z['pal'][i].tobytes())
import json; json.dump({k:[int(v) for v in z[k]] for k in z if k.startswith('a')},open(sys.argv[2]+'.json','w'))   # state fields (sidecar, used by fx02/03/08/10 checks)
print(N,'frames; n',z['n'][0],'..',z['n'][-1],'; fields',[k for k in z if k.startswith('a')])
