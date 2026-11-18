// fx07 = stage 8 "voronoi wire" (update 0x21c3b, render 0x21840, init 0x217de, line walker 0x2157c; orders 0x14-0x15). Integer only (no x87).
// Per tick: 8 sine phases += 3,-5,8,4,-7,-3,5,4 (&0xfff), rotation angles += 5,3,7 (&0x1fff, sine index >> 1), fade -= 2 to 0x100, flash 0x140 on S3M rows 0,6,0x12,0x1c,0x2a,0x32,0x3e (re-armed every tick, as fx05).
// Per render: x/y offsets = half the sum of 4 sines; 32 LCG steps (rol/xor) bump byte counters of a 64x20 tile grid; the grid is drawn as 5x9 patterns chosen by counter&15 (the 10th row of each
// cell stays 0); 20 vertices x3 rotations, perspective by idiv; 30 edges walked by 0x2157c into a CLEARED buffer as 3x3 splats of 4; screen rows 1..198 = (4-neighbour sum >> 2 per byte) + background + tiles
// as 32-bit adds (carries between bytes are real). The only state that survives a frame is the counters + LCG, so a frame needs the renders before it: replay from the stage start (counters only, no drawing).
// Assumptions (not verifiable from the oracle): memory before the splat buffer reads 0. VRAM rows 0 and 199 are not written by the stage (fx06's last picture stays there): drawn black here.
import { at, pos } from './timeline.js';
export const TICK_HZ = 70.086;
let SIN, VERT, EDGE, TILE, PAL, BG;
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx07.bin')).arrayBuffer()); let o = 0;
  SIN = new Int32Array(b.slice(0, 5121 * 4).buffer); o = 5121 * 4; VERT = new Int32Array(b.slice(o, o + 240).buffer); o += 240; EDGE = new Int32Array(b.slice(o, o + 240).buffer); o += 240;
  TILE = b.subarray(o, o + 720); o += 720; PAL = b.subarray(o, o + 768); o += 768; BG = b.subarray(o, o + 64000);
}
const FLASH = new Set([0, 6, 0x12, 0x1c, 0x2a, 0x32, 0x3e]), PH = [3, -5, 8, 4, -7, -3, 5, 4];
export class Sim {
  constructor() { this.ph = [0, 213, 145, 343, 1234, 1213, 2145, 343]; this.ang = [1024, 1024, 1024]; this.fade = 0x100; this.rng = 345858; this.cnt = new Uint8Array(0x500); }
  tick(row) {
    for (let i = 0; i < 8; i++) this.ph[i] = (this.ph[i] + PH[i]) & 0xfff;
    if (this.fade !== 0x100) this.fade -= 2;
    if (row !== 34 && FLASH.has(row)) this.fade = 0x140;
    this.ang[2] = (this.ang[2] + 7) & 0x1fff; this.ang[1] = (this.ang[1] + 3) & 0x1fff; this.ang[0] = (this.ang[0] + 5) & 0x1fff;
  }
  advance() {   // the LCG part of a render
    let e = this.rng;
    for (let i = 0; i < 32; i++) { e = (e + 0x9d) | 0; e = (e << 11 | e >>> 21) ^ 0x9d; let k = e & 0x7ff; if (k >= 0x500) k -= 0x500; this.cnt[k]++; }
    this.rng = e;
  }
  draw(out, pal) {
    const S = this.ph, ox = (SIN[S[0]] + SIN[S[1]] + SIN[S[2]] + SIN[S[3]]) >> 1, oy = (SIN[S[4]] + SIN[S[5]] + SIN[S[6]] + SIN[S[7]]) >> 1;
    const T = new Uint8Array(64000);
    for (let tr = 0; tr < 20; tr++) for (let tc = 0; tc < 64; tc++) { const p = (this.cnt[tr * 64 + tc] & 15) * 5; for (let k = 0; k < 9; k++) for (let j = 0; j < 5; j++) T[(tr * 10 + k) * 320 + tc * 5 + j] = TILE[k * 80 + p + j]; }
    const rot = (x, y, a) => { const s = SIN[a >> 1], c = SIN[(a >> 1) + 1025]; return [((Math.imul(x, c) - Math.imul(y, s)) | 0) >> 10, ((Math.imul(y, c) + Math.imul(x, s)) | 0) >> 10]; };
    const P = [];
    for (let i = 0; i < 20; i++) {
      let x = VERT[i * 3] << 6, y = VERT[i * 3 + 1] << 6, z = VERT[i * 3 + 2] << 6;
      [x, y] = rot(x, y, this.ang[0]); [y, z] = rot(y, z, this.ang[1]); [x, z] = rot(x, z, this.ang[2]);
      y += oy; x += ox; z += 6656;
      if (z <= 0x80) P.push(null); else { const xx = (x * 5) >> 2; P.push([Math.trunc(xx * 64 / z) + 0xa0, Math.trunc(y * 64 / z) + 0x64]); }
    }
    const B = new Uint8Array(64000 + 0x200), O = 0x200;   // zero pad in front (memory before the buffer)
    const splat = (x, y) => { const d = O + y * 320 + x - 0x141; for (let r = 0; r < 3; r++) B[d + r * 320] = B[d + r * 320 + 1] = B[d + r * 320 + 2] = 4; };
    for (let e = 0; e < 30; e++) {
      const a = P[EDGE[e * 2]], b = P[EDGE[e * 2 + 1]]; if (!a || !b) continue;
      const [x0, y0] = a, [x1, y1] = b; let c = Math.max((x0 - x1) ^ ((x0 - x1) >> 31), (y0 - y1) ^ ((y0 - y1) >> 31)); if (c === 0) c = 1;   // cdq/xor without sub: |d|-1 for negative d
      const bx = Math.trunc(((x1 - x0) * 256) / c), by = Math.trunc(((y1 - y0) * 256) / c); let X = x0 * 256, Y = y0 * 256;
      if ((x0 < 2 && x1 < 2) || (x1 < 2 && x0 < 2) || (y0 < 2 && y1 < 2) || (x0 > 0x13d && x1 > 0x13d) || (y0 > 0xc5 && y1 > 0xc5)) continue;
      for (; c > 0; c--, X += bx, Y += by) { const px = X >>> 8, py = Y >>> 8; if (px >= 2 && py >= 2 && px <= 0x13d && py <= 0xc5) splat(px, py); }
    }
    const g = (a, i) => a[i] | a[i + 1] << 8 | a[i + 2] << 16 | a[i + 3] << 24;   // dword (a[i-1].. may be the zero pad)
    out.fill(0);
    for (let d = 0; d < 0x3de0; d++) {
      const i = O + d * 4; let q = 0;
      for (let k = 0; k < 4; k++) q |= (((B[i + k + 0x140] + B[i + k - 1] + B[i + k + 1] + B[i + k - 0x140]) >> 2) & 0x3f) << (8 * k);
      const v = (q + g(BG, d * 4) + g(T, d * 4)) | 0, p = 0x140 + d * 4;
      out[p] = v & 255; out[p + 1] = v >> 8 & 255; out[p + 2] = v >> 16 & 255; out[p + 3] = v >>> 24;
    }
    for (let i = 0; i < 768; i++) { const v = (PAL[i] * this.fade) >> 8; pal[i] = v > 0x3f ? 0x3f : v & 255; }
  }
}
// K0 re-check (fx06 ported, K=1 oracle): stage 7 lasts 1536 ticks (6505..8040) = floor((T7-T6)*70.086) = 1536 from the libopenmpt timeline, so K0 is consistent. The oracle's first n=1540 here is the K=7 batching of that run (7*220).
// player: render k (1 = first, at the stage start) follows K0+k ticks: stage 7 (fx06, no update loop) lets the tick counter run, so the first loop of fx07 runs ALL of fx06's ticks at once (oracle: first n = 1540 = 21.97 s)
// with the row of that moment (row 0 -> flash re-armed each time); one LCG advance per render. Model k = floor((t-T7)*70.086)+1 as for the other stages.
let cache = null;
const T7 = () => at(0x14, 0), K0 = () => Math.floor((at(0x14, 0) - at(0x10, 0)) * TICK_HZ);
export function render(t, ctx) {
  const k = Math.max(1, Math.floor((t - T7()) * TICK_HZ) + 1);
  if (!cache || cache.k > k) cache = { k: 0, s: new Sim(), idx: new Uint8Array(64000), pal: new Uint8Array(768) };
  const c = cache, s = c.s;
  if (c.k < k) {
    while (c.k < k) {
      if (c.k === 0) { const r0 = pos(T7()).row; for (let i = 0; i < K0(); i++) s.tick(r0); }
      c.k++; s.tick(pos(T7() + (c.k - 1) / TICK_HZ).row); s.advance();
    }
    c.fr = false;
  }
  if (!c.fr) { c.fr = true; s.draw(c.idx, c.pal); }
  ctx.idx.set(c.idx); for (let i = 0; i < 768; i++) ctx.pal[i] = (c.pal[i] << 2) | (c.pal[i] >> 4);
}
