// fx15 = stage 16 "blue sphere" (orders 0x2e-0x2f): shared engine, update 0x224e9 (also moves the step values), init 0x2207b.
import { at } from './timeline.js'; import { loadAssets, Stage, Sim } from './engine2217.js';
let st; export async function init(a) { await loadAssets(a); st = new Stage(at(0x2e, 0), 1, () => { const s = new Sim(0); for (let i = 0; i < 1540; i++) s.tick(); return s; }, false); }   // phases continue from stage 12's end (1540 ticks in the oracle: 1536 renders + 5)
export const stage = () => st;
export function render(t, ctx) { st.render(t, ctx.idx, ctx.pal); }
