// fx07check.mjs oracle.bin : Sim from the stage start (counters and LCG start at the static values), ticks by the oracle's n with each frame's row, one LCG advance per render; vs VRAM rows 1..198 + 6-bit DAC.
// VRAM rows 0 and 199 are not written by the stage (fx06's last picture), they are skipped. V=1 prints the first bad frames.
import fs from 'fs'; import { init, Sim } from '../web/fx/fx07.js';
await init(fs.readFileSync(new URL('../web/assets/fx07.bin', import.meta.url)));
const d = fs.readFileSync(process.argv[2]), N = d.readInt32LE(0); let off = 4, bad = 0, pbad = 0, badF = 0, first = -1, pn = 0, rows0 = 0; const out = new Uint8Array(64000), pal = new Uint8Array(768), s = new Sim();
for (let i = 0; i < N; i++) {
  const n = d.readInt32LE(off), row = d.readInt32LE(off + 12); off += 16;
  for (; pn < n; pn++) s.tick(row); s.advance(); s.draw(out, pal);
  let b = 0, q = 0; for (let p = 320; p < 64000 - 320; p++) if (out[p] !== d[off + p]) b++; off += 64000;
  for (let p = 0; p < 768; p++) if (pal[p] !== d[off + p]) q++; off += 768;
  bad += b; pbad += q; if (b || q) { badF++; if (first < 0) first = n; if (process.env.V && badF < 5) console.log('frame', i, 'n', n, b, q); }
}
console.log(`${N} frames: differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}, first n ${first}`); process.exit(bad || pbad ? 1 : 0);
