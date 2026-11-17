// fx00 = stage 1 of the demo: helicopter over snow mountains (update 0x20401, render 0x2032b, init 0x201b1, interpolation 0x204a9). Bit-exact against the Unicorn oracle (tools/fx00check.mjs).
// Asset 4 = 240 RLE frames of 160x80 (0x2018a: literal byte, or (b&0xc0)==0xc0 -> run of b&63 x next byte; until exactly 12800 bytes).
// State after n updates (70.086 Hz ticks): fade = min(2n,256) (palette = base*fade>>8); a frame is decoded each time [46604] (start 1, +2 per tick) wraps past 13 (first at the first render): frame index = min(floor((1+2n)/13), 237); shown 2x with vertical/horizontal blend (word ops incl. the cross-byte carry) at screen rows 20..177. Pure function of n: seek = decode frame k (frames are decoded once at init).
export const TICK_HZ = 70.086;
let PAL, FR = [];
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx00.bin')).arrayBuffer());
  PAL = b.subarray(0, 768); const a = b.subarray(768); let s = 0;
  for (let f = 0; f < 238; f++) {
    const o = new Uint8Array(12800 + 4); let d = 0;   // +4 slack: the interpolation reads up to one pixel past the last row (never used for output)
    while (d !== 12800) { const v = a[s++]; if ((v & 0xc0) === 0xc0) { const c = v & 63, x = a[s++]; o.fill(x, d, d + c); d += c; } else o[d++] = v; }
    FR.push(o);
  }
}
export function renderN(n, out, pal) {
  const fade = Math.min(2 * n, 256), f = Math.min(Math.floor((1 + 2 * n) / 13), 237), F = FR[f];
  out.fill(0, 0, 64000); let si = 0, di = 0x1900;
  for (let r = 0; r < 79; r++) {
    for (let c = 0; c < 159; c++, si++, di += 2) {
      const al = F[si], ah = F[si + 1], m = ((ah + al) & 255) >> 1;
      out[di] = al; out[di + 1] = m;
      const bl = F[si + 0xa0], bh = F[si + 0xa1], bm = ((bh + bl) & 255) >> 1;
      const v = (((m << 8 | al) + (bm << 8 | bl)) & 0xffff) >> 1 & 0x3f3f; out[di + 0x140] = v & 255; out[di + 0x141] = v >> 8;
    }
    si++; di += 0x142;
  }
  for (let i = 0; i < 768; i++) pal[i] = (PAL[i] * fade) >> 8;
}
import { at } from './timeline.js';
const T0 = () => at(0, 0);
export function render(t, ctx) {   // ponytail: n = floor(t*70.086)+1 is a model (the original's own count depends on timing)
  const n = Math.max(1, Math.floor((t - T0()) * TICK_HZ) + 1);
  renderN(n, ctx.idx, ctx.pal); for (let i = 0; i < 768; i++) ctx.pal[i] = (ctx.pal[i] << 2) | (ctx.pal[i] >> 4);
}
