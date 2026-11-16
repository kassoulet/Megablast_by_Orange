// fx12check.mjs oracle.bin: replays Sim with the oracle's per-frame orders (n updates before render n; the order is the one the oracle's stub gave at that render) vs VRAM idx + 6-bit DAC.
import fs from 'fs';import {init,Sim} from '../web/fx/fx12.js';
await init(fs.readFileSync(new URL('../web/assets/fx12.bin',import.meta.url)));
const d=fs.readFileSync(process.argv[2]),N=d.readInt32LE(0);let off=4,bad=0,pbad=0,badF=0,first=-1,pn=0;const out=new Uint8Array(64000),pal=new Uint8Array(768),s=new Sim();
for(let i=0;i<N;i++){const n=d.readInt32LE(off),order=d.readInt32LE(off+8);off+=16;
  for(;pn<n;pn++)s.tick(order);   // ponytail: all updates of a render use that render's order (an order change inside a render's batch is not modelled)
  s.render(out,pal);let b=0;for(let p=0;p<64000;p++)if(out[p]!==d[off+p])b++;off+=64000;let q=0;for(let p=0;p<768;p++)if(pal[p]!==d[off+p])q++;off+=768;bad+=b;pbad+=q;if(b||q){badF++;if(first<0)first=n}}
console.log(`${N} frames: differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}, first n ${first}`);process.exit(bad||pbad?1:0);
