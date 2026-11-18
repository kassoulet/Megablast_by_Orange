// fx03 = moire + logo (orders 9-10): moire family, see moire.js (shared engine, stage 3).
import { loadAssets, renderAt } from './moire.js';
const p6 = new Uint8Array(768);
export async function init(a) { await loadAssets(a); }
export function render(t, ctx) { renderAt(3, t, ctx.idx, p6); for (let i = 0; i < 768; i++) ctx.pal[i] = (p6[i] << 2) | (p6[i] >> 4); }
