// fx09 = stage 10 of the demo: white "flower" blob (update 0x1ffba, render 0x1e8fc, init 0x1e89e, orders 0x18-0x1b). Feedback effect (splat/blur buffer persists): STATEFUL, replay from the stage start.
// Per tick: [465ac] += 5 (& 0x1fff), spin s += 1 (& 0xfff), 8 phase accumulators p0..p7 += 11,-14,15,7,-13,-16,-8,12 (& 0xfff), palette phases += 0x39, 0x32, -0x33.
// Render: 1024 points; radius = sum of 8 sines of copies of p0..p7 (advancing 0x14,0x14,0x10,0x400,0x100,0x4a0,0x200,0x300 per point) + (sin[a>>1]+0x200)*8; point = (sin[s]*r >> 16 + 0xa0, cos[s]*r >> 16 + 0x64), s += 4 per point;
// inside x < 0x130, y < 0xb8 a 16x16 pattern (init: asset bytes >> 2) is added byte-wise with saturation test < 0x3c into buffer A; then blur (dwords at +-3 B / +-0x3c0 B, x3/4) into B, VRAM = B + background (asset 18, dword add), swap. Palette = 3 sine gradients.
import { at, pos } from './timeline.js';
export const TICK_HZ = 70.086;
let SINE, PAT, BG;
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx09.bin')).arrayBuffer());
  SINE = new Int16Array(b.slice(0, 10242).buffer); PAT = b.subarray(10242, 10498); BG = b.subarray(10498, 10498 + 64000);
}
const M = 0x1400, DP = [0x14, 0x14, 0x10, 0x400, 0x100, 0x4a0, 0x200, 0x300], TP = [11, -14, 15, 7, -13, -16, -8, 12];
export class Sim {
  constructor() {
    this.A = new Uint8Array(64000 + 2 * M); this.B = new Uint8Array(64000 + 2 * M);
    this.a = 2048; this.s = 0; this.p = new Int32Array(8); this.q = [0, 0, 0];
  }
  tick() {
    this.a = (this.a + 5) & 0x1fff; this.s = (this.s + 1) & 0xfff;
    for (let i = 0; i < 8; i++) this.p[i] = (this.p[i] + TP[i]) & 0xfff;
    this.q[0] = (this.q[0] + 0x39) & 0xfff; this.q[1] = (this.q[1] + 0x32) & 0xfff; this.q[2] = (this.q[2] - 0x33) & 0xfff;
  }
  render(out, pal) {
    const A = this.A, c = Int32Array.from(this.p), base = (SINE[this.a >> 1] + 0x200) << 3;
    let s = this.s;
    for (let n = 0; n < 0x400; n++) {
      let r = base;
      for (let i = 0; i < 8; i++) r += SINE[c[i]];
      const x = ((SINE[s] * r) >> 16) + 0xa0, y = ((SINE[s + 1025] * r) >> 16) + 0x64;
      if (x >= 0 && y >= 0 && x < 0x130 && y < 0xb8) {
        const e = M + y * 320 + x;
        for (let k = 0; k < 256; k++) { const o = e + (k >> 4) * 320 + (k & 15); if (A[o] < 0x3c) A[o] += PAT[k]; }
      }
      s = (s + 4) & 0xfff;
      for (let i = 0; i < 8; i++) c[i] = (c[i] + DP[i]) & 0xfff;
    }
    const B = this.B, rd = p => (A[p] | A[p + 1] << 8 | A[p + 2] << 16 | A[p + 3] << 24) >>> 0;
    for (let p = 0; p < 64000; p += 4) {
      const q = M + p;
      let e = (((rd(q - 3) + rd(q + 3) + rd(q + 0x3c0) + rd(q - 0x3c0)) >>> 0) >>> 2) & 0x3f3f3f3f;
      e = (e - ((e >>> 2) & 0x3f3f3f3f)) | 0;
      B[q] = e; B[q + 1] = e >>> 8; B[q + 2] = e >>> 16; B[q + 3] = e >>> 24;
      const g = (e + (BG[p] | BG[p + 1] << 8 | BG[p + 2] << 16 | BG[p + 3] << 24)) >>> 0;
      out[p] = g; out[p + 1] = g >>> 8; out[p + 2] = g >>> 16; out[p + 3] = g >>> 24;
    }
    for (let i = 0; i < 256; i++) for (let k = 0; k < 3; k++) { const v = ((SINE[this.q[k]] + 0x4400) * i) >> 13; pal[i * 3 + k] = v < 0x3f ? v : 0x3f; }
    this.A = B; this.B = A;
  }
}
// player API: n = ticks since the stage start (order 0x18 row 0); render n follows n updates. Seek = replay from the start (<= ~1550 frames). ponytail: n from music time is a model.
let cache = null;
export function render(t, ctx) {
  const n = Math.max(1, Math.floor((t - at(0x18, 0)) * TICK_HZ) + 1);
  if (!cache || cache.n > n) cache = { n: 0, s: new Sim(), idx: new Uint8Array(64000), pal: new Uint8Array(768) };
  const s = cache.s;
  while (cache.n < n) { cache.n++; s.tick(); if (cache.n < n) s.render(cache.idx, cache.pal); }
  s.render(cache.idx, cache.pal);
  ctx.idx.set(cache.idx); for (let i = 0; i < 768; i++) ctx.pal[i] = (cache.pal[i] << 2) | (cache.pal[i] >> 4);
}
