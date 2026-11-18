// fx05 = stage 6 of the demo: rotating 4x4x4 point-grid cube drawn as lines into a feedback buffer (update 0x2143a, render 0x2111b, line 0x20d46, init 0x210bc, orders 0x0e-0x0f). STATEFUL (buffer persists): replay from the stage start.
// Per tick: fade f (0x100 rest, 0x140 flash on rows 0,6,0x12,0x1c,0x2a,0x32,0x3e; -2 per tick back to 0x100); angles a1 += 5, a2 += 4, a3 += 3 (& 0x1fff, sine index = angle >> 1); camera y offset cy += 4 (starts -0x700), z offset 0x300.
// Render: 64 grid points rotated about 3 axes (x*c - y*s >> 10 each, then >> 8), perspective x*128/z+0xa0, y*128/z+0x64 (z <= 0x80 -> point -1), 3 x 4 x 4 edge families (+1, +4, +16 in the grid index) drawn with the 12-pixel pattern (saturation < 0x38)
// into buffer A, blur (dwords at +-4 px / +-4 rows, x7/8 of the mean) into B, VRAM = B + background (dword add), swap. Palette = base * f >> 8.
import { pos } from './timeline.js';
export const TICK_HZ = 70.086;
let SINE, V, PAL, BG;
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx05.bin')).arrayBuffer());
  SINE = new Int16Array(b.slice(0, 10242).buffer); V = new Int32Array(b.slice(10242, 10242 + 768).buffer);
  PAL = b.subarray(11010, 11778); BG = b.subarray(11778, 11778 + 64000);
}
const M = 0x1400, OFFS = [[1, 1], [2, 1], [0x140, 1], [0x141, 2], [0x142, 2], [0x143, 1], [0x280, 1], [0x281, 2], [0x282, 2], [0x283, 1], [0x3c1, 1], [0x3c2, 1]];
const ROWS = [0, 6, 0x12, 0x1c, 0x2a, 0x32, 0x3e];
export class Sim {
  constructor() {
    this.A = new Uint8Array(64000 + 2 * M); this.B = new Uint8Array(64000 + 2 * M);
    this.f = 0x100; this.a1 = 128; this.a2 = 1152; this.a3 = 128; this.cy = -1792; this.P = new Int32Array(128);   // a1=[48b61] a2=[48b65] a3=[48b69] (angles of the 3 rotations in render order: a2, a3, a1)
  }
  tick(row) {   // [48b75] stays -232 forever (the original stores the value back), so every tick on a listed row re-arms the flash
    if (this.f !== 0x100) this.f -= 2;
    if (ROWS.includes(row)) this.f = 0x140;
    this.a3 = (this.a3 + 4) & 0x1fff; this.a2 = (this.a2 + 3) & 0x1fff; this.a1 = (this.a1 + 5) & 0x1fff; this.cy += 4;
  }
  line(x0, y0, x1, y1) {   // 0x20d46
    let dx = x0 - x1; dx ^= dx >> 31; let dy = y0 - y1; dy ^= dy >> 31;
    let c = (dy < dx ? dx : dy) + 1;
    const sx = (((x1 - x0) << 8) / c) | 0, sy = (((y1 - y0) << 8) / c) | 0;
    if (x0 < 0 && x1 < 0 || y0 < 0 && y1 < 0 || x0 > 0x137 && x1 > 0x137 || y0 > 0xbf && y1 > 0xbf) return;
    const inside = x0 >= 0 && x1 >= 0 && x0 <= 0x137 && x1 <= 0x137 && y0 >= 0 && y1 >= 0 && y0 <= 0xbf && y1 <= 0xbf;
    let x = x0 << 8, y = y0 << 8; const A = this.A;
    for (; c > 0; c--) {
      const px = x >> 8, py = y >> 8;
      if (inside || px >= 0 && py >= 0 && px <= 0x137 && py <= 0xbf) {
        const e = M + py * 320 + px;
        for (let k = 0; k < 12; k++) { const o = e + OFFS[k][0]; if (A[o] < 0x38) A[o] += OFFS[k][1]; }
      }
      x = (x + sx) | 0; y = (y + sy) | 0;
    }
  }
  render(out, pal) {
    const P = this.P;
    for (let i = 0; i < 64; i++) {
      let x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2];
      let s = SINE[this.a2 >> 1], c = SINE[(this.a2 >> 1) + 1025];
      let y2 = (Math.imul(y, c) - Math.imul(s, z)) >> 10; z = (Math.imul(z, c) + Math.imul(s, y)) >> 10; y = y2;
      s = SINE[this.a3 >> 1]; c = SINE[(this.a3 >> 1) + 1025];
      let x2 = (Math.imul(x, c) - Math.imul(s, z)) >> 10; z = (Math.imul(z, c) + Math.imul(s, x)) >> 10; x = x2;
      s = SINE[this.a1 >> 1]; c = SINE[(this.a1 >> 1) + 1025];
      x2 = (Math.imul(x, c) - Math.imul(s, y)) >> 10; y = (Math.imul(y, c) + Math.imul(s, x)) >> 10; x = x2;
      x >>= 8; y = (y >> 8) + this.cy; z = (z >> 8) + 0x300;
      if (z <= 0x80) { P[i * 2] = -1; P[i * 2 + 1] = -1; }
      else { P[i * 2] = (((x << 7) / z) | 0) + 0xa0; P[i * 2 + 1] = (((y << 7) / z) | 0) + 0x64; }
    }
    const L = (a, b) => { if (P[a * 2] === -1 || P[b * 2] === -1) return; this.line(P[a * 2], P[a * 2 + 1], P[b * 2], P[b * 2 + 1]); };
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 3; c++) {
      L(16 * a + 4 * b + c, 16 * a + 4 * b + c + 1); L(16 * a + b + 4 * c, 16 * a + b + 4 * c + 4); L(a + 4 * b + 16 * c, a + 4 * b + 16 * c + 16);
    }
    for (let i = 0; i < 768; i++) { const v = (PAL[i] * this.f) >> 8; pal[i] = v < 0x3f ? v : 0x3f; }
    const A = this.A, B = this.B, rd = p => (A[p] | A[p + 1] << 8 | A[p + 2] << 16 | A[p + 3] << 24) >>> 0;
    for (let p = 0; p < 64000; p += 4) {
      const q = M + p;
      let e = ((rd(q - 4) + rd(q + 4) + rd(q + 0x500) + rd(q - 0x500)) >>> 0) >>> 2 & 0x3f3f3f3f;
      e = (e - ((e >>> 3) & 0x1f1f1f1f)) & 0x3f3f3f3f;
      B[q] = e; B[q + 1] = e >>> 8; B[q + 2] = e >>> 16; B[q + 3] = e >>> 24;
      const g = (e + (BG[p] | BG[p + 1] << 8 | BG[p + 2] << 16 | BG[p + 3] << 24)) >>> 0;
      out[p] = g; out[p + 1] = g >>> 8; out[p + 2] = g >>> 16; out[p + 3] = g >>> 24;
    }
    this.A = B; this.B = A;
  }
}
// player API: n = ticks since the stage start (order 0x0e row 0); render n follows n updates, ticks use the libopenmpt row at that tick. Seek = replay from the start (<= ~780 frames). ponytail: n from music time is a model.
import { at } from './timeline.js';
let cache = null;
export function render(t, ctx) {
  const T0 = at(0x0e, 0), n = Math.max(1, Math.floor((t - T0) * TICK_HZ) + 1);
  if (!cache || cache.n > n) cache = { n: 0, s: new Sim(), idx: new Uint8Array(64000), pal: new Uint8Array(768) };
  const s = cache.s;
  while (cache.n < n) { cache.n++; s.tick(pos(T0 + (cache.n - 1) / TICK_HZ).row); if (cache.n < n) s.render(cache.idx, cache.pal); }
  s.render(cache.idx, cache.pal);
  ctx.idx.set(cache.idx); for (let i = 0; i < 768; i++) ctx.pal[i] = (cache.pal[i] << 2) | (cache.pal[i] >> 4);
}
