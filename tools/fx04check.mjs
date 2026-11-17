// fx04check.mjs oracle.bin: replays Sim (one tick + one render per oracle frame, K=1 oracle) and diffs VRAM idx / 6-bit DAC against every frame
import fs from 'fs';import {init,Sim} from '../web/fx/fx04.js';
await init(fs.readFileSync(new URL('../web/assets/fx04.bin',import.meta.url)));
const d=fs.readFileSync(process.argv[2]),N=d.readInt32LE(0);let off=4,bad=0,pbad=0,badF=0,first=-1,pn=null;const out=new Uint8Array(64000),pal=new Uint8Array(768),s=new Sim();
for(let i=0;i<N;i++){const n=d.readInt32LE(off);off+=16;
 if(pn===null){for(let k=0;k<n;k++)s.tick();}else for(let k=pn;k<n;k++){s.tick();if(k+1<n)s.render(out,pal);}
 pn=n;s.render(out,pal);
 let b=0;for(let p=0;p<64000;p++)if(out[p]!==d[off+p])b++;off+=64000;let q=0;for(let p=0;p<768;p++)if(pal[p]!==d[off+p])q++;off+=768;bad+=b;pbad+=q;if((b||q)&&first<0)first=i;if(b||q)badF++;}
console.log(`${N} frames: differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}, first bad frame ${first}`);process.exit(bad||pbad?1:0);
