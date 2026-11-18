// moirecheck.mjs STAGE(2|3|8|10) oracle.bin : the Sim state is taken from the oracle's first frame (counters read at render entry, see the .json sidecar of tools/oracle2bin.py),
// then ticked by the oracle's n differences with each frame's (order,row); render vs VRAM idx + 6-bit DAC.
import fs from 'fs'; import { loadAssets, tick, render, initialState } from '../web/fx/moire.js';
await loadAssets(fs.readFileSync(new URL('../web/assets/moire.bin', import.meta.url)));
const stage = +process.argv[2], d = fs.readFileSync(process.argv[3]), J = JSON.parse(fs.readFileSync(process.argv[3] + '.json')), N = d.readInt32LE(0);
const S = initialState(); let off = 4, bad = 0, pbad = 0, badF = 0, first = -1, pn = 0; const out = new Uint8Array(64000), pal = new Uint8Array(768);
for (let i = 0; i < N; i++) {
  const n = d.readInt32LE(off), order = d.readInt32LE(off + 8), row = d.readInt32LE(off + 12); off += 16;
  if (i === 0) { for (const k in J) S[k === 'a44796' ? 'fade' : 'v' + k.slice(1)] = J[k][0] | 0; S.bg = Math.max(0, Math.min(3, order - 5)); }
  else { for (; pn < n; pn++) tick(S, stage, order, row); }
  pn = n; render(S, stage, out, pal);
  let b = 0, q = 0; for (let p = 0; p < 64000; p++) if (out[p] !== d[off + p]) b++; off += 64000;
  for (let p = 0; p < 768; p++) if (pal[p] !== d[off + p]) q++; off += 768;
  bad += b; pbad += q; if (b || q) { badF++; if (first < 0) first = n; if (process.env.V && badF < 5) console.log('frame', i, 'n', n, b, q); }
}
console.log(`${N} frames: differing pixels ${bad}, palette bytes ${pbad}, frames with a difference ${badF}, first n ${first}`); process.exit(bad || pbad ? 1 : 0);
