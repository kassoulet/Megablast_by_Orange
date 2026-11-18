// fx05check.mjs oracle.bin: replays Sim (K=1 oracle: one tick + one render per frame, tick row = the row the oracle's stub gave at that render) vs VRAM idx + 6-bit DAC
import fs from 'fs';import {init,Sim} from '../web/fx/fx05.js';
await init(fs.readFileSync(new URL('../web/assets/fx05.bin',import.meta.url)));
const d=fs.readFileSync(process.argv[2]),N=d.readInt32LE(0);let off=4,bad=0,pbad=0,badF=0,first=-1,pn=null;const out=new Uint8Array(64000),pal=new Uint8Array(768),s=new Sim();
for(let i=0;i<N;i++){const n=d.readInt32LE(off),row=d.readInt32LE(off+12);off+=16;
 if(pn===null){for(let k=0;k<n;k++)s.tick(row);}else for(let k=pn;k<n;k++){s.tick(row);if(k+1<n)s.render(out,pal);}
 pn=n;s.render(out,pal);
 let b=0;for(let p=0;p<64000;p++)if(out[p]!==d[off+p])b++;off+=64000;let q=0;for(let p=0;p<768;p++)if(pal[p]!==d[off+p])q++;off+=768;bad+=b;pbad+=q;if((b||q)&&first<0)first=i;if(b||q)badF++;}
console.log(`${N} frames: differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}, first bad frame ${first}`);process.exit(bad||pbad?1:0);
