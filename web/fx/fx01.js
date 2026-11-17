// fx01 = stage 2 of the demo: radial light rays around a bright object (update 0x1e752, render 0x1e535, line 0x1e1b1, init 0x1e498). Feedback effect (ray/blur buffer persists): STATEFUL, replay from the stage start.
// Same family as fx04 (0x207fe line). Render: N rays (N = s28 = ((sine[s2c]+0xc00)*fade>>11)+1) from a centre P0 (from p70/p74) to P1 (ray i: angle esi, radius edx); a ray is walked in steps (P1-P0)/count (count = max(|dx|,|dy|)>>9, min 1)
// while a length budget (s30, grows by 4 to 0x400 per tick, reset at order 4) lasts, not drawing where the mask picture is non-zero, then (unless the last step was masked) on to the screen edge unrestricted;
// each step adds saturating (<0xf0) 1/2 to the same 12-pixel pattern; then 4-neighbour blur x0.75 (byte-wise) into the other buffer = screen, swap. Palette = 3 sine gradients * fade >> 8.
// Per tick: fade (4619e, 256) -= 4 once order >= 5 (the stage ends when it is 0: the original sets flag [4ab19]); the rest as in the code of update().
import { at, pos } from './timeline.js';
export const TICK_HZ = 70.086;
let SINE, MASK;
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx01.bin')).arrayBuffer());
  SINE = new Int16Array(b.slice(0, 5121 * 2).buffer); MASK = b.subarray(5121 * 2, 5121 * 2 + 64000);
}
const M = 0x1400, OFFS = [[1, 1], [2, 1], [0x140, 1], [0x141, 2], [0x142, 2], [0x143, 1], [0x280, 1], [0x281, 2], [0x282, 2], [0x283, 1], [0x3c1, 1], [0x3c2, 1]];
export class Sim {
  constructor() {
    this.A = new Uint8Array(64000 + 2 * M); this.B = new Uint8Array(64000 + 2 * M);
    this.n28 = 1; this.s2c = 3072; this.s30 = 0; this.s34 = 0; this.s38 = 0; this.s3c = 3096; this.p70 = 3588; this.p74 = 2048; this.fade = 256; this.f2 = 0; this.c88 = 0; this.c8c = 0; this.c90 = 0; this.flag = 0;
  }
  tick(order) {
    if (order === 4 && this.f2 !== 1) { this.s30 = 0; this.f2 = 1; }
    if (order >= 5) { if (this.fade !== 0) this.fade -= 4; else this.flag = 1; }
    this.c88 = (this.c88 + 0x72) & 0xfff; this.c8c = (this.c8c + 0x6f) & 0xfff; this.c90 = (this.c90 - 0x81) & 0xfff;
    this.s34 = (this.s34 + 0x10) & 0xfff; this.s38 = (this.s38 - 15) & 0xfff;
    this.p70 -= 3; this.p74 -= 2; this.s3c = (this.s3c + 6) & 0xfff;
    if (this.s30 <= 0x3ff) this.s30 += 4;
    this.s2c = (this.s2c + 6) & 0xfff; this.n28 = (((SINE[this.s2c] + 0xc00) * this.fade) >> 11) + 1;
  }
  dot(e) { const A = this.A; for (const [o, v] of OFFS) if (A[e + o] < 0xf0) A[e + o] += v; }
  line(x0, y0, x1, y1) {   // 0x1e1b1
    let dx = x0 - x1; dx ^= dx >> 31; let dy = y0 - y1; dy ^= dy >> 31;
    let cnt = (dy < dx ? dx : dy) >>> 9; if (cnt === 0) cnt = 1;
    const sx = ((x1 - x0) / cnt) | 0, sy = ((y1 - y0) / cnt) | 0;
    let x = x0, y = y0, ebp = this.s30, ecx = cnt, last = -1;
    if (!(x0 < 0 || y0 < 0 || x0 > 0x13b00 || y0 > 0xc300)) {
      for (;;) {
        const px = x >>> 8, py = y >>> 8;
        if (px > 0x13b || py > 0xc3) return;
        const idx = py * 320 + px; last = idx;
        if (MASK[idx] === 0) this.dot(M + idx);
        x = (x + sx) | 0; y = (y + sy) | 0; ebp -= cnt;
        if (ebp > 0) { if (--ecx === 0) break; } else break;
      }
      if (MASK[last] !== 0) return;
    }
    for (;;) {
      const px = x >>> 8, py = y >>> 8;
      if (px > 0x13b || py > 0xc3) return;
      this.dot(M + py * 320 + px);
      x = (x + sx) | 0; y = (y + sy) | 0;
    }
  }
  render(out, pal) {
    let si = this.p70 & 0xfff, bp = this.p74 & 0xfff, edx = 0x400;
    const X0 = (((SINE[si] * 0x400 * 0xa0 * 3) >> 14) + 0xa000), Y0 = ((SINE[bp] * 0x400 * 0x64) >> 15) + 0x6400;
    si += 0x9d;
    for (let i = 0; i < this.n28; i++) {
      const s = si & 0xfff, d = edx & 0x7ff;
      const x1 = ((SINE[s] * d * 0xa0) >> 11) + 0xa000, y1 = ((SINE[s + 1025] * d * 0x64) >> 11) + 0x6400;
      this.line(X0, Y0, x1, y1);
      edx = (edx + 0x9d) | 0; edx = ((edx << 11) | (edx >>> 21)) | 0; edx ^= 0x9d;
      si = (si + 0x9d) & 0xfff;
    }
    const A = this.A, B = this.B;
    for (let p = 0; p < 64000; p++) { const q = M + p, e = (A[q + 1] + A[q - 1] + A[q + 320] + A[q - 320]) >> 2; B[q] = e - (e >> 2); }
    for (let i = 0; i < 256; i++) for (let k = 0; k < 3; k++) {
      let v = (((SINE[[this.c88, this.c8c, this.c90][k]] + 0x2400) * i) >> 13) * this.fade >> 8; pal[i * 3 + k] = v < 0x3f ? v : 0x3f;
    }
    out.set(B.subarray(M, M + 64000)); this.A = B; this.B = A;
  }
}
// player API: n = ticks since the stage start (order 3 row 0); render n follows n updates; ticks use the libopenmpt order at that tick. Seek = replay from the start (<= ~800 frames). ponytail: n from music time is a model.
let cache = null;
export function render(t, ctx) {
  const T0 = at(3, 0), n = Math.max(1, Math.floor((t - T0) * TICK_HZ) + 1);
  if (!cache || cache.n > n) cache = { n: 0, s: new Sim(), idx: new Uint8Array(64000), pal: new Uint8Array(768) };
  const s = cache.s;
  while (cache.n < n) { cache.n++; s.tick(pos(T0 + (cache.n - 1) / TICK_HZ).order); s.render(cache.idx, cache.pal); }
  ctx.idx.set(cache.idx); for (let i = 0; i < 768; i++) ctx.pal[i] = (cache.pal[i] << 2) | (cache.pal[i] >> 4);
}
