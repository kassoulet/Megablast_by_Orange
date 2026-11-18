// moire family = stages fx02 (render 0x1d770, update 0x1de0a, init 0x1ceb6), fx03 (0x1d378, 0x1df1e, 0x1d26f), fx08 (0x1dade, 0x1df98, 0x1d166), fx10 (0x1d574, 0x1df98, 0x1d023).
// All four: an 81x51 vertex mesh of (x,y) texture coordinates (24.8 fixed point, built per render from sine-driven counters) over a 256x256 RIX texture (asset 0), drawn as 80x50 cells of 4x4
// pixels with a bilinear (per-cell linear) walk; palette = base*fade>>8 (fade 0x100 at rest, flashes to 0x200 / row table); screen = LUT16K[bg<<8 | warp] (asset 1 = 16 KB colour table, bg = PCX picture).
// No framebuffer feedback: a frame is a pure function of the counter state; the counters are linear except the fade events (order change / row change), so seek = replay ticks from the stage start.
// Counters persist across stages (never reset, only the 8 corner phases are cleared by each init; fx10's init also resets 36bda/447c2..447d6): stages are chained (startState).
import { at, pos } from './timeline.js';
export const TICK_HZ = 70.086, M = 0xfff;
let SIN, TEX, PAL, LUT, BG, ROWF;
let loading = null;
export const loadAssets = buf => buf ? load(buf) : (loading ??= load());
async function load(buf) {
  const b = buf ? new Uint8Array(buf) : new Uint8Array(await (await fetch('assets/moire.bin')).arrayBuffer());
  SIN = new Int32Array(b.slice(0, 5121 * 4).buffer); let o = 5121 * 4;
  TEX = b.subarray(o, o += 65536); PAL = b.subarray(o, o += 768); LUT = b.subarray(o, o += 16384);
  BG = []; for (let i = 0; i < 7; i++) BG.push(b.subarray(o, o += 64000));
  ROWF = new Int32Array(b.slice(o, o + 280).buffer);
}
const init0 = () => ({ fade: 0x100, v4479a: 0, v4479e: 0, v447a2: 0, v447a6: 0, v447ba: 0, v447be: 0, v447da: 0, v36bda: 0, v36be2: 0, v36bea: 0, v36bf2: 0, v37016: 0, v3701a: 0, v37026: 0, v3702a: 0,
  v37036: 0, v3703a: 0, v37046: 0, v3704a: 0, v37056: 0, v3705a: 0, v447c2: 0, v447c6: 1024, v447ca: 2048, v447ce: 3072, v447d6: 0, v44922: 23475, v4491e: 0, v36bca: -1, bg: 0 });
export const initialState = init0;
const add = (S, k, d) => { S[k] = (S[k] + d) & M; };
function tail(S) {   // 0x1dfe2
  S.v37056 += 0x64; S.v3705a += 0x9c;
  add(S, 'v36bda', 0x10); add(S, 'v37016', 6); add(S, 'v3701a', 5); add(S, 'v36be2', -12); add(S, 'v37026', -7); add(S, 'v3702a', -8); add(S, 'v36bea', 0x28);
  add(S, 'v37036', -9); add(S, 'v3703a', 6); add(S, 'v36bf2', 0x30); add(S, 'v37046', 7); add(S, 'v3704a', -9); add(S, 'v447da', 4); add(S, 'v447ba', 4); add(S, 'v447be', 1);
  S.v4479a += 0x20; S.v447a2 += 0x30; S.v4479e += 0x22; S.v447a6 += 0x2a;
  add(S, 'v447c2', 6); add(S, 'v447c6', 6); add(S, 'v447ca', 6); add(S, 'v447ce', 6); add(S, 'v447d6', 7);
}
const reset8 = S => { for (const k of ['v37016', 'v3701a', 'v37026', 'v3702a', 'v37036', 'v3703a', 'v37046', 'v3704a']) S[k] = 0; };
export function stageInit(S, stage) {   // inits 0x1ceb6 / 0x1d26f / 0x1d166 (clear the 8 corner phases), 0x1d023 (stage 10: also the mesh counters)
  reset8(S); if (stage === 10) { S.v36bda = 0; S.v447c2 = 0; S.v447c6 = 0x400; S.v447ca = 0x800; S.v447ce = 0xc00; S.v447d6 = 0; }
}
export function tick(S, stage, order, row) {   // one 70 Hz update; (order,row) = [0x4ab11],[0x4ab15]
  if (stage === 2) {
    S.v37056 += 0x64; S.v3705a += 0x9c; if (S.fade !== 0x100) S.fade -= 8;
    if (order !== S.v44922) { S.v44922 = order; S.fade = 0x200; }
    if (order === 5) { S.bg = 0; add(S, 'v447ba', 4); } if (order === 6) { S.bg = 1; add(S, 'v447ba', -4); }
    if (order === 7) { S.bg = 2; } if (order === 8) { S.bg = 3; add(S, 'v447ba', -4); }
    S.v4479a += 0x20; S.v447a2 += 0x30; S.v4479e += 0x22; S.v447a6 += 0x2a;
  } else if (stage === 3) {
    if (S.fade !== 0x100) S.fade -= 8;
    if (S.v36bca !== row && S.v4491e !== 1 && row >= 0xe) { S.v4491e = 1; S.fade = 0x200; }   // (0x36bca is never updated by 0x1df1e: -1 here)
    tail(S);
  } else {
    if (row !== S.v36bca) { S.v36bca = row; S.fade = ROWF[row]; }
    tail(S);
  }
}
// ---- meshes (Int32Array 51*81*2, x,y) ----
const fall = (dx, dy) => { let e = (Math.imul(dx, dx) + Math.imul(dy, dy)) | 0; e >>= 8; e = (0x100 - e) | 0; e = Math.imul(e, e) >> 8; e = Math.imul(e, e) >> 8; return Math.imul(e, e) >> 8; };
const cen = (S, a, b, kx, ky) => [(Math.imul(SIN[S[a]], kx) >> 3) + 0xa000, (Math.imul(SIN[S[b]], ky) >> 3) + 0x6400];
function mesh03(S, me) {   // 0x1c7c9
  const A0 = cen(S, 'v37016', 'v3701a', 0xf0, 0x96), A1 = cen(S, 'v37026', 'v3702a', 0xf0, 0x96), c0 = SIN[S.v36bda], c1 = SIN[S.v36be2];
  for (let by = 0, k = 0; by < 51; by++) for (let bx = 0; bx < 81; bx++, k += 2) {
    let x = bx << 10, y = by << 10;
    for (const [A, c] of [[A0, c0], [A1, c1]]) {
      const si = Math.imul(c, fall((x - A[0]) >> 8, (y - A[1]) >> 8)) >> 8 & M, s = SIN[si], co = SIN[si + 1025], ux = x - A[0], uy = y - A[1];
      x = (((Math.imul(ux, co) - Math.imul(uy, s)) | 0) >> 10) + A[0]; y = (((Math.imul(uy, co) + Math.imul(ux, s)) | 0) >> 10) + A[1];
    }
    me[k] = x; me[k + 1] = y;
  }
}
function mesh10(S, me) {   // 0x1ca71
  const sc = SIN[S.v447d6] + 0x400, f = (a, kk, off) => (Math.imul(Math.imul(SIN[S[a]], kk), sc) >> 14) + off;
  const A = [[f('v447c2', 0xf0, 0xa000), f('v447c6', 0x96, 0x6400)], [f('v447c6', 0xf0, 0xa000), f('v447ca', 0x96, 0x6400)], [f('v447ca', 0xf0, 0xa000), f('v447ce', 0x96, 0x6400)], [f('v447ce', 0xf0, 0xa000), f('v447c2', 0x96, 0x6400)]];
  const s0 = SIN[S.v447be], c0 = SIN[S.v447be + 1025];
  for (let by = 0, k = 0; by < 51; by++) for (let bx = 0; bx < 81; bx++, k += 2) {
    const ux = (bx << 10) - 0xa000, uy = (by << 10) - 0x6400;
    let x = (((Math.imul(ux, c0) - Math.imul(uy, s0)) | 0) >> 10) + 0xa000, y = (((Math.imul(uy, c0) + Math.imul(ux, s0)) | 0) >> 10) + 0x6400;
    for (const a of A) {
      const e = fall((x - a[0]) >> 8, (y - a[1]) >> 8); x -= a[0]; y -= a[1];
      const q = ((Math.imul(SIN[((e << 3) + S.v36bda) & M], e) * 3) >> 12) + 0x100;
      x = (Math.imul(x, q) >> 8) + a[0]; y = (Math.imul(y, q) >> 8) + a[1];
    }
    me[k] = x + S.v37056; me[k + 1] = y + S.v3705a;
  }
}
const rot = (x, y, a) => { const s = SIN[a], c = SIN[a + 1025]; return [((Math.imul(x, c) - Math.imul(y, s)) | 0) >> 10, ((Math.imul(y, c) + Math.imul(x, s)) | 0) >> 10]; };
function mesh02(S, me) {   // 0x1d770
  let aE = (S.v4479e >>> 2) & M, aF = (S.v447a6 >>> 2) & M;
  for (let by = 0, k = 0; by < 51; by++) {
    let aA = (S.v4479a >>> 2) & M, aB = (S.v447a2 >>> 2) & M;
    for (let bx = 0; bx < 81; bx++, k += 2) {
      const ex = (bx << 10) - 0xa000, ey = (by << 10) - 0x6400;
      const cx = SIN[aA] + SIN[aE] + 0xc00, cy = SIN[aB] + SIN[aF] + 0xc00;   // x scale uses edx = sin[447b2]+sin[447b6], y scale ecx = sin[447aa]+sin[447ae]
      const [x, y] = rot(Math.imul(ex, cy) >> 13, Math.imul(ey, cx) >> 13, S.v447ba);
      me[k] = x + 0x8000 + (S.v37056 >>> 3); me[k + 1] = y + 0x8000 + (S.v3705a >>> 3);
      aA = (aA + 0x5c) & M; aB = (aB + 0x40) & M;
    }
    aE = (aE + 0x5c) & M; aF = (aF + 0x40) & M;
  }
}
function mesh08(S, me) {   // 0x1dade (also overwrites 0x447ba)
  S.v447ba = SIN[S.v447da] << 1; let aE = S.v4479e & M, aF = S.v447a6 & M;
  for (let by = 0, k = 0; by < 51; by++) {
    let aA = S.v4479a & M, aB = S.v447a2 & M;
    for (let bx = 0; bx < 81; bx++, k += 2) {
      const ex = (bx << 10) - 0xa000, ey = (by << 10) - 0x6400, ang = (S.v447ba + ((SIN[aA] + SIN[aB] + SIN[aE] + SIN[aF]) >> 3)) & M;
      const [x, y] = rot(ex, ey, ang);
      me[k] = x + S.v37056 + 0x8000; me[k + 1] = y + S.v3705a + 0x8000;
      aA = (aA + 0x80) & M; aB = (aB + 0x40) & M;
    }
    aE = (aE + 0x80) & M; aF = (aF + 0x40) & M;
  }
}
const me = new Int32Array(51 * 81 * 2), fb = new Uint8Array(64000);
export function render(S, stage, out, pal) {
  ({ 2: mesh02, 3: mesh03, 8: mesh08, 10: mesh10 })[stage](S, me);
  for (let cy = 0; cy < 50; cy++) for (let cx = 0; cx < 80; cx++) {
    const i = (cy * 81 + cx) * 2, x0 = me[i], y0 = me[i + 1], bx = (me[i + 2] - x0) >> 2, by = (me[i + 3] - y0) >> 2, rx = (me[i + 162] - x0) >> 2, ry = (me[i + 163] - y0) >> 2;
    for (let r = 0; r < 4; r++) {
      let x = x0 + r * rx, y = y0 + r * ry, d = (cy * 4 + r) * 320 + cx * 4;
      for (let k = 0; k < 4; k++, x += bx, y += by) fb[d + k] = TEX[((y >> 8) & 255) << 8 | ((x >> 8) & 255)];
    }
  }
  const bg = BG[stage === 2 ? S.bg : stage === 3 ? 4 : stage === 8 ? 5 : 6];
  for (let i = 0; i < 64000; i++) out[i] = LUT[bg[i] << 8 | fb[i]];
  for (let i = 0; i < 768; i++) { if (stage === 8) { pal[i] = PAL[i]; continue; }   // 0x1dade has no palette code: the DAC keeps the init palette
    const v = (PAL[i] * S.fade) >> 8; pal[i] = v > 0x3f ? 0x3f : v & 255; }
}
// ---- player side: a Stage = one effect, replayed from its start state ----
const STAGES = { 2: [[5, 12], [9, 0]], 3: [[9, 0], [11, 0]], 8: [[22, 0], [24, 0]], 10: [[28, 0], [32, 0]] };
const nAt = (stage, t) => Math.max(1, Math.floor((t - at(...STAGES[stage][0])) * TICK_HZ) + 1);
// ticks a stage ran in the Unicorn oracle run (K=7 batches overshoot the ideal count by up to 7; the real count is timing dependent): the next stage's start state depends on them
const END = { 2: 1477, 3: 770, 8: 770 }, prev = { 3: 2, 8: 3, 10: 8 }, startCache = {};
function runTicks(S, stage, from, to) {
  const T0 = at(...STAGES[stage][0]);
  for (let n = from; n < to; n++) { const p = pos(T0 + n / TICK_HZ); tick(S, stage, p.order, p.row); }   // tick n+1 sees the position at its time
}
function startState(stage) {   // state right after the stage's init: the previous stage's end state in the chain (cached)
  if (startCache[stage]) return startCache[stage];
  let S;
  if (!prev[stage]) S = init0(); else { S = { ...startState(prev[stage]) }; runTicks(S, prev[stage], 0, END[prev[stage]]); }
  stageInit(S, stage); return startCache[stage] = S;
}
const caches = {};
export function renderAt(stage, t, idx, pal6) {
  const n = nAt(stage, t); let c = caches[stage];
  if (!c || c.n > n) { c = caches[stage] = { n: 0, S: { ...startState(stage) } }; }
  runTicks(c.S, stage, c.n, n); c.n = n; render(c.S, stage, idx, pal6);
}
