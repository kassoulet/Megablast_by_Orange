// fx11check.mjs oracle.bin [variant=0] : replays the shared 0x2217d engine (Sim) with the oracle's tick counts vs VRAM idx + 6-bit DAC. variant 1 = stage 16 (update 0x224e9).
// fx16 (stage 17) continues stage 16's planes: pass any 3rd arg (e.g. x) and the check first replays stage 16 as the fx16 oracle run saw it (see below).
import fs from 'fs'; import { loadAssets, Sim, palette } from '../web/fx/engine2217.js';
await loadAssets(fs.readFileSync(new URL('../web/assets/fx11.bin', import.meta.url)));
const variant = +(process.argv[3] ?? 0), prevFile = process.argv[4], EXTRA = +(process.argv[5] ?? 0);
const load = f => { const d = fs.readFileSync(f), N = d.readInt32LE(0), F = []; let off = 4; for (let i = 0; i < N; i++) { F.push({ n: d.readInt32LE(off), idx: d.subarray(off + 16, off + 16 + 64000), pal: d.subarray(off + 16 + 64000, off + 16 + 64768) }); off += 16 + 64768; } return F; };
const st12 = () => { const q = new Sim(0); for (let i = 0; i < 1540; i++) q.tick(); return q; };   // stage 16 inherits stage 12's phases (1540 ticks)
const F = load(process.argv[2]); let s = new Sim(variant, variant === 1 ? st12() : null, false), pn = prevFile ? 1540 : 0;; /* fx16 oracle n continues the shared 0x2243d counter of stage 12 (1540 ticks) */ const out = new Uint8Array(64000), pal = new Uint8Array(768);
if (prevFile) { const p = new Sim(1, st12(), false), o = new Uint8Array(64000); for (let t = 1; t <= 770; t++) { p.tick(); if (t % 7 === 0) p.render(o); } s = new Sim(0, p); }   // stage 16 as seen by the fx16 oracle run: K=7 until order 0x30 = 770 ticks, a render every 7th (the K=1 fx15 oracle is a different run)
let bad = 0, pbad = 0, badF = 0, first = -1;
for (const f of F) {
  for (; pn < f.n; pn++) s.tick();
  s.render(out); palette(pal, !!prevFile); let b = 0, q = 0;
  for (let p = 0; p < 64000; p++) if (out[p] !== f.idx[p]) b++;
  for (let p = 0; p < 768; p++) if (pal[p] !== f.pal[p]) q++;
  bad += b; pbad += q; if (process.env.V && b) console.log("frame n", f.n, b); if (b || q) { badF++; if (first < 0) first = f.n; }
}
console.log(`${F.length} frames: differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}, first n ${first}`); process.exit(bad || pbad ? 1 : 0);
