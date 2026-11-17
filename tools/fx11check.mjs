// fx11check.mjs oracle.bin [variant=0] : replays the shared 0x2217d engine (Sim) with the oracle's tick counts vs VRAM idx + 6-bit DAC. variant 1 = stage 16 (update 0x224e9).
// fx16 (stage 17) continues stage 16's planes: pass the fx15 oracle as 3rd arg and the check replays it first (ticks of its last render + EXTRA, see below).
import fs from 'fs'; import { loadAssets, Sim, palette } from '../web/fx/engine2217.js';
await loadAssets(fs.readFileSync(new URL('../web/assets/fx11.bin', import.meta.url)));
const variant = +(process.argv[3] ?? 0), prevFile = process.argv[4], EXTRA = +(process.argv[5] ?? 0);
const load = f => { const d = fs.readFileSync(f), N = d.readInt32LE(0), F = []; let off = 4; for (let i = 0; i < N; i++) { F.push({ n: d.readInt32LE(off), idx: d.subarray(off + 16, off + 16 + 64000), pal: d.subarray(off + 16 + 64000, off + 16 + 64768) }); off += 16 + 64768; } return F; };
const F = load(process.argv[2]); let s = new Sim(variant), pn = 0; const out = new Uint8Array(64000), pal = new Uint8Array(768);
if (prevFile) { const P = load(prevFile), p = new Sim(1); let q = 0, o = new Uint8Array(64000); for (const f of P) { for (; q < f.n; q++) p.tick(); p.render(o); } for (let k = 0; k < EXTRA; k++) p.tick(); s = new Sim(0, p); }
let bad = 0, pbad = 0, badF = 0, first = -1;
for (const f of F) {
  for (; pn < f.n; pn++) s.tick();
  s.render(out); palette(pal, !!prevFile); let b = 0, q = 0;
  for (let p = 0; p < 64000; p++) if (out[p] !== f.idx[p]) b++;
  for (let p = 0; p < 768; p++) if (pal[p] !== f.pal[p]) q++;
  bad += b; pbad += q; if (b || q) { badF++; if (first < 0) first = f.n; }
}
console.log(`${F.length} frames: differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}, first n ${first}`); process.exit(bad || pbad ? 1 : 0);
