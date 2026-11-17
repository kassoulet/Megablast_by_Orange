// fx16 = stage 17 "green blob" (orders 0x30-0x33): shared engine, update 0x2243d, init 0x220d7 (palette g/b swapped, steps reset, planes and phases KEPT from stage 16).
import { at } from './timeline.js'; import { loadAssets, Stage, Sim } from './engine2217.js';
let st, end;
export async function init(a) {
  await loadAssets(a);
  st = new Stage(at(0x30, 0), 0, () => {   // stage 16 as the oracle run saw it: 1540 ticks of stage 12 phases, then 770 ticks with a render every 7th (K=7 batches), replayed once
    if (!end) { const s = new Sim(1, (() => { const q = new Sim(0); for (let i = 0; i < 1540; i++) q.tick(); return q; })(), false), o = new Uint8Array(64000); for (let t = 1; t <= 770; t++) { s.tick(); if (t % 7 === 0) s.render(o); } end = s; }
    return end;
  });
}
export function render(t, ctx) { st.render(t, ctx.idx, ctx.pal, true); }
