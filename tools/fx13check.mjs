// fx13check.mjs oracle.bin: renderN(n) vs the oracle's frames (VRAM idx + 6-bit DAC): reports differing pixels / palette bytes over all frames, and the state model
import fs from 'fs';import {init,renderN} from '../web/fx/fx13.js';
const root=new URL('../web/assets/',import.meta.url);
await init(fs.readFileSync(new URL('fx13.bin',root)));
const d=fs.readFileSync(process.argv[2]),N=d.readInt32LE(0);let off=4,bad=0,pbad=0,badF=0;const out=new Uint8Array(64000),pal=new Uint8Array(768);
for(let i=0;i<N;i++){const n=d.readInt32LE(off);off+=16;renderN(n,out,pal);let b=0;for(let p=0;p<64000;p++)if(out[p]!==d[off+p])b++;off+=64000;let q=0;for(let p=0;p<768;p++)if(pal[p]!==d[off+p])q++;off+=768;bad+=b;pbad+=q;if(b||q)badF++;}
console.log(`${N} frames: differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}`);process.exit(bad||pbad?1:0);
