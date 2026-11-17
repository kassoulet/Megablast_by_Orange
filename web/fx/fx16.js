// fx16 = stage 17 "green blob" (orders 0x30-0x33): shared engine, update 0x2243d, init 0x220d7 (palette g/b swapped, steps reset, planes and phases KEPT from stage 16).
import { at } from './timeline.js'; import { loadAssets, Stage } from './engine2217.js'; import * as f15 from './fx15.js';
let st, end;
export async function init(a) {
  await loadAssets(a); await f15.init(a);
  st = new Stage(at(0x30, 0), 0, () => {   // stage 16's final state, replayed once
    if (!end) { const p = f15.stage(), n = Math.floor((at(0x30, 0) - at(0x2e, 0)) * 70.086), s = p.start(), o = new Uint8Array(64000); for (let i = 0; i < n; i++) { s.tick(); s.render(o); } end = s; }
    return end;
  });
}
export function render(t, ctx) { st.render(t, ctx.idx, ctx.pal, true); }
