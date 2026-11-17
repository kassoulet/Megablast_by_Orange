// fx11 = stage 12 "blue ring" (orders 0x20-0x23): shared engine, update 0x2243d, init 0x2207b (clears both planes, palette as stored). See engine2217.js.
import { at } from './timeline.js'; import { loadAssets, Stage } from './engine2217.js';
let st; export async function init(a) { await loadAssets(a); st = new Stage(at(0x20, 0), 0); }
export const stage = () => st;
export function render(t, ctx) { st.render(t, ctx.idx, ctx.pal); }
