// fx06check.mjs oracle.bin : Sim stepped with each frame's [0x52888] (oracle sidecar oracle.bin.json, field a52888), draw vs VRAM (all 64000 px) + 6-bit DAC. V=1 prints the first bad frames.
import fs from 'fs'; import { init, Sim, draw } from '../web/fx/fx06.js';
await init(fs.readFileSync(new URL('../web/assets/fx06.bin', import.meta.url)));
const pal6 = fs.readFileSync(new URL('../web/assets/fx06.bin', import.meta.url)).subarray(200, 968).map(v => v >> 2);
const d = fs.readFileSync(process.argv[2]), N = d.readInt32LE(0), ticks = JSON.parse(fs.readFileSync(process.argv[2] + '.json')).a52888;
let off = 4, bad = 0, pbad = 0, badF = 0, first = -1; const out = new Uint8Array(64000), s = new Sim();
for (let i = 0; i < N; i++) {
  const n = d.readInt32LE(off); off += 16;
  const M = s.step(ticks[i]); draw(M, out);
  let b = 0, q = 0; for (let p = 0; p < 64000; p++) if (out[p] !== d[off + p]) b++; off += 64000;
  for (let p = 0; p < 768; p++) if (pal6[p] !== d[off + p]) q++; off += 768;
  bad += b; pbad += q; if (b || q) { badF++; if (first < 0) first = i; if (process.env.V && badF < 5) console.log('frame', i, 'tick', ticks[i], b, q); }
}
console.log(`${N} frames (ticks ${ticks[0]}..${ticks[N - 1]}): differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}, first ${first}`); process.exit(bad || pbad ? 1 : 0);
