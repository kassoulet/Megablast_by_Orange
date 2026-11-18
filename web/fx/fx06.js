// fx06 = stage 7 "vortex" (render 0x23288, init 0x231c4, tables 0x22b80, warp 0x22dfc, rotation matrix 0x28190 + product 0x28318; orders 0x10-0x13). x87 code, ported with float32 stores (Math.fround) and
// double arithmetic in place of the 80-bit stack (differences only where a double-rounded result lands on a float32/integer tie; checked against the oracle, see README).
// No update loop: the animation is a function of the absolute tick [0x52888] (A = 30*tick as float32) and of a few float32 accumulators carried from render to render (a3c a40 a44 = 3 angles of the next
// matrix, a48, a4c, a50, a5c = previous A), all zero at the init. Per render: matrix = Rx(a3c) * Ry(a40) * Rz(a44) (float32 stores), 41x26 lattice points (x,y) -> (U,V) ints via a sqrt-by-bit-trick,
// perspective-like divide and fpatan (U = atan2 turn * 131072, V = 128 * (rho + M11)), then 40x25 cells of 8x8 px (8 rows each, the whole 200-row screen) bilinearly interpolating (U,V) (wrapped +-0x2000 steps)
// into a 512x512 texture lookup: texel[((2V + (wave[(U>>8)&511] << 9)) & 0x3fe00) + ((U>>8)&511)], wave = a 64-step triangle table of float32 sums (0..30).
// Palette = the PCX palette >> 2, set once. Seek: the accumulators need the renders before the frame -> replay from the stage start (only the cheap part, drawing happens once).
import { at } from './timeline.js';
export const TICK_HZ = 70.086;
const f = Math.fround;
let C, PAL, TEX;
const T = new Int32Array(512);
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx06.bin')).arrayBuffer());
  C = new Float64Array(b.slice(0, 200).buffer); PAL = b.subarray(200, 968); TEX = b.subarray(968, 968 + 262144);
  let w = 0, st = 0;
  for (let k = 1; k <= 64; k++) {
    w = f(w + st); if (w < 0) w = 0; st = f(st + K(0x362fc)); const v = re(w);
    for (let r = 0; r < 4; r++) { T[128 * r + k - 1] = v; T[128 * r + 128 - k] = v; }
  }
}
const K = a => C[(a - 0x362a4) >> 3];
const re = v => { if (!(Math.abs(v) < 2147483648)) return -2147483648; const fl = Math.floor(v), d = v - fl; return d < .5 ? fl : d > .5 ? fl + 1 : (fl % 2 === 0 ? fl : fl + 1); };   // fistp, round to nearest even
const F32 = new Float32Array(1), I32 = new Int32Array(F32.buffer);
const bits = x => { F32[0] = x; return I32[0]; }, unbits = b => { I32[0] = b; return F32[0]; };
const bt = x => { const b = bits(x), m = b & 0x7fffff, e = (b - 0x3f800000) | 0; return unbits(((m | (e & 0x800000)) >> 1) + (((e & 0xff000000) >> 1) + 0x3f800000) | 0); };   // halves exponent+mantissa: rough sqrt
const mul = (P, Q) => {   // 0x28318: P = P * Q (12 floats: 3x3 rows + translation row)
  const R = new Float32Array(12);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const p0 = P[3 * r], p1 = P[3 * r + 1], p2 = P[3 * r + 2];
    R[3 * r + c] = p1 * Q[3 + c] + p0 * Q[c] + p2 * Q[6 + c] + (r === 3 ? Q[9 + c] : 0);
  }
  P.set(R);
};
const rotm = (a1, a2, a3) => {   // 0x28190
  const M = new Float32Array(12), B = new Float32Array(12), Z = new Float32Array(12);
  let s = Math.sin(a1), c = Math.cos(a1); M[0] = 1; M[4] = c; M[5] = s; M[7] = -s; M[8] = c;
  s = Math.sin(a2); c = Math.cos(a2); B[0] = c; B[2] = -s; B[4] = 1; B[6] = s; B[8] = c;
  s = Math.sin(a3); c = Math.cos(a3); Z[0] = c; Z[1] = s; Z[3] = -s; Z[4] = c; Z[8] = 1;
  mul(M, B); mul(M, Z); return M;
};
export class Sim {
  constructor() { this.a3c = 0; this.a40 = 0; this.a44 = 0; this.a48 = 0; this.a4c = 0; this.a50 = 0; this.a5c = 0; }
  step(tick) {   // 0x23288 up to the table call; returns the matrix
    const A = f(30 * tick), M = rotm(this.a3c, this.a40, this.a44);
    const s1 = Math.sin(A * K(0x36304)), s2 = Math.sin(A * K(0x3631c)), s3 = Math.sin(A * K(0x3633c)), s4 = Math.sin(A * K(0x36324)), s5 = Math.sin(A * K(0x3632c));
    const u1 = s1 * K(0x3630c) * K(0x36314), u2 = s2 * K(0x3630c) * K(0x36314), w3 = (s3 + 1) * K(0x36344), w4 = s4 * s5 * K(0x36334);
    const d = f(A - this.a5c), w3sq = w3 * w3;
    this.a5c = d; this.a3c = f(u1); this.a40 = f(u2); this.a48 = f(w3sq); this.a44 = f(w4);
    if (w3sq < K(0x3634c)) this.a4c = f((K(0x3634c) - w3sq) * (d * K(0x36354)));
    const e1 = 1 - d * K(0x3635c), g = A * K(0x36364), h = this.a4c;
    const p = f(h + this.a50), e = f(e1 * h);
    this.a5c = A; this.a50 = p; M[11] = f(g); this.a4c = e;
    return M;
  }
}
const wrap = x => x < -0x2000 ? x + 0x4000 : x > 0x2000 ? x - 0x4000 : x;
export function tables(M) {   // 0x22b80
  const U = new Int32Array(41 * 52), a = f(0.51), r0 = f(a * a), M0 = M[0], M1 = M[1], M2 = M[2], M3 = M[3], M4 = M[4], M5 = M[5], M6 = M[6], M7 = M[7], M8 = M[8], M11 = M[11];
  for (let j = 0; j < 26; j++) {
    let r = r0;
    for (let i = 0; i < 41; i++) {
      const xx = (2 * i - 40 + 1) * K(0x362b4), yy = (2 * j - 25 + 1) * K(0x362bc) * K(0x362c4), x32 = f(xx), y32 = f(yy);
      const s = bt(f(xx * x32 + yy * y32 + r)), inv = 1 / s, nx = x32 * inv, ny = y32 * inv, nx32 = f(nx), ny32 = f(ny);
      r = f(inv * r);
      const Px = ny * M3 + nx32 * M0 + r * M6, Py = nx * M1 + ny32 * M4 + r * M7, Pz = nx32 * M2 + ny32 * M5 + r * M8;
      const x2 = f(Px), y2 = f(Py), e12 = (Px * x2) * K(0x362cc) + (Py * y2) * K(0x362cc), q = bt(f(e12)), k = q / e12;
      const th = Math.atan2(x2 * k, y2 * k) * K(0x362d4), rho = k * f(Pz), V = rho + M11;
      U[i * 52 + j * 2] = re(th * 256 * 512); U[i * 52 + j * 2 + 1] = re(V * K(0x362a4));
    }
  }
  return U;
}
export function draw(M, out) {   // 0x22dfc
  const U = tables(M);
  out.fill(0);
  for (let j = 0; j < 25; j++) for (let i = 0; i < 40; i++) {
    const P = i * 52 + j * 2;
    let ua = U[P], va = U[P + 1], uc = U[P + 52], vc = U[P + 53];
    const w1 = wrap((U[P + 2] - ua) >> 3), w2 = wrap((U[P + 3] - va) >> 3), w3 = wrap((U[P + 54] - uc) >> 3), w4 = wrap((U[P + 55] - vc) >> 3);
    for (let row = 0; row < 8; row++) {
      const du = wrap((uc - ua) >> 3), dv = wrap((vc - va) >> 3);
      let u = ua, v = va, o = j * 2560 + row * 320 + i * 8;
      ua = (ua + w1) | 0; uc = (uc + w3) | 0; va = (va + w2) | 0; vc = (vc + w4) | 0;
      for (let c = 0; c < 8; c++) {
        const col = (u >> 8) & 0x1ff;
        out[o++] = TEX[(((2 * v + (T[col] << 9)) & 0x3fe00) + col) & 0x3ffff];
        v = (v + dv) | 0; u = (u + du) | 0;
      }
    }
  }
}
// player: render k (1 = the first, at the stage start) runs at tick TICK0 + k - 1 (one render per tick, as in the K=1 oracle: 1536 renders over ticks 6505..8040); the stage has no update loop,
// so the absolute tick matters (A = 30*tick). TICK0 = the oracle's first tick; the real original's tick at that point depends on its startup timing (model, like n in the other stages).
const TICK0 = 6505;
let cache = null;
const T6 = () => at(0x10, 0);
export function render(t, ctx) {
  const k = Math.max(1, Math.floor((t - T6()) * TICK_HZ) + 1);
  if (!cache || cache.k > k) cache = { k: 0, s: new Sim(), M: null, idx: new Uint8Array(64000) };
  const c = cache;
  while (c.k < k) { c.M = c.s.step(TICK0 + c.k); c.k++; c.fr = false; }
  if (!c.fr) { c.fr = true; draw(c.M, c.idx); }
  ctx.idx.set(c.idx);
  for (let i = 0; i < 768; i++) ctx.pal[i] = ((PAL[i] >> 2) << 2) | (PAL[i] >> 6);
}
