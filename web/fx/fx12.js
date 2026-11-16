// fx12 = stage 13 of the demo: checkerboard tunnel (update 0x206c1, render 0x20659 -> 0x20526, init 0x205a1). Feedback effect, so STATEFUL: replay from the stage start.
// Per tick (70.086 Hz, orders from the S3M): fade bc6 += 4 (to 0x100); shade level bf6 += 2 (to 0xb0, only once the first render has run); camera (da,de) += (t[2o+2]*ce + t[2o]*d2)>>8 / (t[2o+3]*ce + t[2o+1]*d2)>>8
// (o = order, ce counts 0.., d2 counts 256.. down, both reset on an order change); si = (da>>4) + ((de>>4)<<8) mod 65536.
// Render: per pixel (200 rows x 320): tex[(OFF[p] + si) & 0xffff] -> screen; for the first 200 columns shade[(bf6>>3)<<8 | c] is also written to the OTHER 256x256 buffer (stride 256),
// then the two buffers swap (the shaded picture is the next frame's texture). Palette = base * bc6 >> 8.
import { at } from './timeline.js';
export const TICK_HZ = 70.086;
let OFF, TEX0, PAL, SHADE, TAB;
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx12.bin')).arrayBuffer());
  OFF = new Uint16Array(b.slice(0, 128000).buffer); TEX0 = b.subarray(128000, 128000 + 65536); PAL = b.subarray(193536, 193536 + 768);
  SHADE = b.subarray(194304, 194304 + 16384); TAB = new Int32Array(b.slice(210688, 210688 + 384).buffer);
}
export class Sim {   // ticks(order) then render(): the order is [0x4ab11] at the tick
  constructor() { this.T = new Uint8Array(TEX0); this.W = new Uint8Array(TEX0); this.bc6 = 0; this.bf2 = 0; this.bf6 = 0; this.da = 0; this.de = 0; this.ce = 0; this.d2 = 256; this.bd6 = -1; this.si = 0; }
  tick(o) {
    if (this.bc6 !== 0x100) this.bc6 += 4;
    if (this.bf2 === 1 && this.bf6 !== 0xb0) this.bf6 = (this.bf6 + 2) & 255;
    if (o !== this.bd6) { this.ce = 0; this.d2 = 256; this.bd6 = o; }
    this.da += (TAB[2 * o + 2] * this.ce + TAB[2 * o] * this.d2) >> 8;
    this.de += (TAB[2 * o + 3] * this.ce + TAB[2 * o + 1] * this.d2) >> 8;
    if (this.d2 !== 0) { this.d2--; this.ce++; }
    this.si = (((this.da >> 4) & 0xffff) + (((this.de >> 4) << 8) & 0xffff)) & 0xffff;
  }
  render(out, pal) {
    this.bf2 = 1; const { T, W, si } = this, lv = (this.bf6 >> 3) << 8;
    for (let r = 0; r < 200; r++) for (let c = 0; c < 320; c++) {
      const p = r * 320 + c, v = T[(OFF[p] + si) & 0xffff]; out[p] = v;
      if (c < 200) W[r * 256 + c] = SHADE[lv + v];
    }
    for (let i = 0; i < 768; i++) pal[i] = (PAL[i] * this.bc6) >> 8;
    this.T = W; this.W = T;
  }
}
// player API: n = ticks since the stage start (order 0x24 row 0), render n follows n updates. Seek = replay from the start (<= ~800 frames).
let cache = null;
export function render(t, ctx) {
  const T0 = at(0x24, 0), n = Math.max(1, Math.floor((t - T0) * TICK_HZ) + 1);
  if (!cache || cache.n > n) cache = { n: 0, s: new Sim(), idx: new Uint8Array(64000), pal: new Uint8Array(768) };
  const s = cache.s;
  if (cache.n < n) {   // render() advances the feedback buffers: run it exactly once per tick and keep the last frame for repeated draws at the same n
    while (cache.n < n) { cache.n++; s.tick(orderAt(T0 + (cache.n - 1) / TICK_HZ)); if (cache.n < n) s.render(cache.idx, cache.pal); }
    s.render(cache.idx, cache.pal);
  }
  ctx.idx.set(cache.idx); for (let i = 0; i < 768; i++) ctx.pal[i] = (cache.pal[i] << 2) | (cache.pal[i] >> 4);
}
import { pos } from './timeline.js';
const orderAt = t => pos(t).order;
