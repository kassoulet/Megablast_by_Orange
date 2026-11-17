// fx04 = stage 5 of the demo: grey light lines (update 0x20c7a, render 0x20a13, line 0x207fe, init 0x209d7). Feedback effect (the line/blur buffer persists): STATEFUL, replay from the stage start.
// Per tick: a18 += 3, a1c += 5 (mod 4096); p10 += s28, p14 += s2c; s28 and s2c count down by 4 to -0x300; c30 += 0x72, c34 += 0x6f, c38 -= 0x81 (mod 4096).
// Render: 256 rays (loop over i: angles from p10>>7, p14>>7 stepping +0x9d / +0x1c9, two points through the sine table, a ray is walked from point 0 in steps of (p1-p0)/(max(|dx|,|dy|)>>9) until it leaves the screen,
// each step adds saturating (<0x3e) 1/2 to a 12-pixel pattern of the 8-bit buffer A), palette = 3 sine gradients (c30/c34/c38), then every dword of A is blurred (4 neighbours at +-2 px / +-2 rows, 4-byte SIMD-in-a-register adds incl. the carries)
// x0.75 into buffer B, VRAM = that + background picture (dword add), A and B swap.
import { at, pos } from './timeline.js';
export const TICK_HZ = 70.086;
let SINE, BG;
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx04.bin')).arrayBuffer());
  SINE = new Int16Array(b.slice(0, 8192).buffer); BG = b.subarray(8192, 8192 + 64000);
}
const M = 0x1400, OFFS = [[1, 1], [2, 1], [0x140, 1], [0x141, 2], [0x142, 2], [0x143, 1], [0x280, 1], [0x281, 2], [0x282, 2], [0x283, 1], [0x3c1, 1], [0x3c2, 1]];
export class Sim {
  constructor() {
    this.A = new Uint8Array(64000 + 2 * M); this.B = new Uint8Array(64000 + 2 * M);
    this.p10 = 0; this.p14 = 8192; this.a18 = 0; this.a1c = 8192; this.s28 = 1024; this.s2c = 1536; this.c30 = 0; this.c34 = 0; this.c38 = 0;
  }
  tick() {
    this.a18 = (this.a18 + 3) & 0xfff; this.a1c = (this.a1c + 5) & 0xfff;
    this.p10 = (this.p10 + this.s28) | 0; this.p14 = (this.p14 + this.s2c) | 0;
    if (this.s28 !== -0x300) this.s28 -= 4; if (this.s2c !== -0x300) this.s2c -= 4;
    this.c30 = (this.c30 + 0x72) & 0xfff; this.c34 = (this.c34 + 0x6f) & 0xfff; this.c38 = (this.c38 - 0x81) & 0xfff;
  }
  line(x0, y0, x1, y1) {   // 0x207fe
    let dx = x0 - x1; dx ^= dx >> 31; let dy = y0 - y1; dy ^= dy >> 31;   // |v|-1 for negatives, as cdq/xor
    let c = dy < dx ? dx : dy; c >>>= 9; if (c === 0) c = 1;
    const sx = ((x1 - x0) / c) | 0, sy = ((y1 - y0) / c) | 0;
    if (x0 < 0 || y0 < 0 || x1 < 0 || y1 < 0 || x0 > 0x13b00 || y0 > 0xc300 || x1 > 0x13b00 || y1 > 0xc300) return;
    let x = x0, y = y0; const A = this.A;
    for (;;) {
      const px = x >>> 8, py = y >>> 8;
      if (px > 0x13b || py > 0xc3) return;
      const e = M + py * 320 + px;
      for (const [o, v] of OFFS) if (A[e + o] < 0x3e) A[e + o] += v;
      x = (x + sx) | 0; y = (y + sy) | 0;
    }
  }
  render(out, pal) {
    const edx = 0x461;
    let si = this.p10 >>> 7, bp = this.p14 >>> 7;
    for (let i = 0; i < 256; i++) {
      si &= 0xfff; bp &= 0xfff;
      let x0 = ((SINE[si] * edx * 0xa0) >> 14) + 0xa000, y0 = ((SINE[bp] * edx * 0x64) >> 14) + 0x6400;
      x0 -= SINE[this.a18] << 3; y0 -= SINE[this.a1c] << 3;
      const s2 = (si + 0x1d7) & 0xfff, b2 = (bp + 0x303) & 0xfff;
      let x1 = ((SINE[s2] * edx * 0xa0) >> 12) + 0xa000, y1 = ((SINE[b2] * edx * 0x64) >> 12) + 0x6400;
      x1 += SINE[this.a18] << 3; y1 += SINE[this.a1c] << 3;
      this.line(x0, y0, x1, y1);
      si += 0x9d; bp += 0x1c9;
    }
    for (let i = 0; i < 256; i++) for (let k = 0; k < 3; k++) {
      const v = ((SINE[[this.c30, this.c34, this.c38][k]] + 0x4400) * i) >> 13; pal[i * 3 + k] = v < 0x3f ? v : 0x3f;
    }
    const A = this.A, B = this.B, rd = p => (A[p] | A[p + 1] << 8 | A[p + 2] << 16 | A[p + 3] << 24) >>> 0;
    for (let p = 0; p < 64000; p += 4) {
      const q = M + p;
      let e = ((rd(q - 2) + rd(q + 2) + rd(q + 0x280) + rd(q - 0x280)) >>> 0) >>> 2 & 0x3f3f3f3f;
      e = (e - ((e >>> 2) & 0x3f3f3f3f)) >>> 0;
      B[q] = e; B[q + 1] = e >>> 8; B[q + 2] = e >>> 16; B[q + 3] = e >>> 24;
      const g = (e + (BG[p] | BG[p + 1] << 8 | BG[p + 2] << 16 | BG[p + 3] << 24)) >>> 0;
      out[p] = g; out[p + 1] = g >>> 8; out[p + 2] = g >>> 16; out[p + 3] = g >>> 24;
    }
    this.A = B; this.B = A;
  }
}
// player API: n = ticks since the stage start (order 0x0b row 0); render n follows n updates. Seek = replay from the start (<= ~1200 frames). ponytail: n from music time is a model.
let cache = null;
export function render(t, ctx) {
  const n = Math.max(1, Math.floor((t - at(0x0b, 0)) * TICK_HZ) + 1);
  if (!cache || cache.n > n) cache = { n: 0, s: new Sim(), idx: new Uint8Array(64000), pal: new Uint8Array(768) };
  const s = cache.s;
  if (cache.n < n) { while (cache.n < n) { cache.n++; s.tick(); s.render(cache.idx, cache.pal); } }
  ctx.idx.set(cache.idx); for (let i = 0; i < 768; i++) ctx.pal[i] = (cache.pal[i] << 2) | (cache.pal[i] >> 4);
}
