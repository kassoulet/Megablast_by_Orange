// fx14 = stage 15 of the demo: bar photo + megablast logo (update 0x22b1c, render 0x227ea, init 0x22602). Feedback effect, so STATEFUL: replay from the stage start.
// Init: 64 KB-aligned work area = LUT (16 KB shade table, asset 19) | buf1 | buf2 | buf3 (buf2, buf3 zero). Photo (asset 20) -> PH0 = max(b-0x80,0)>>1, PH1 = 0x40 - ((b>>2)+1) (padding rows = 0x7f -> 0 / 0x20).
// Particle tables: 2048 x (pos 24 bit, speed 0x3f..0x7e) from the generator at 0x22736. Palette = asset 16 (set once).
// Per tick: order -> [4f3bc]; a (4f3b4) += 13, b (4f3c0) += 32, c (4b040) += 13, d (4b044) += 15 (all & 0xfff).
// Per render: shade table SH[k] = ((k-31)*A >> 11) + 31, A = sin[a]+0x400; from order 0x2b: 2048 particles add 4 dwords into the current buffer (carry across bytes!); blur cur -> other
// (4 neighbours with 16-bit wrapped addresses, (sum>>2 & 0x3f3f3f3f) minus 1/8); four wobble offsets from b; warp: buf3[i] = logo[i + dx + 320 dy] with (dx,dy) = gradient of the blurred buffer; swap cur/other;
// screen rows 8..183: LUT[ SH[ clamp((PH1[i+o1]+..+PH1[i+o4]) - 0x60) + PH0[i] ] << 8 | buf3[i] ]. Rows outside stay as they were before the stage.
import { at, pos } from './timeline.js';
import * as f13 from './fx13.js';
export const TICK_HZ = 70.086;
let S, LUT, PHOTO, PAL, WIN; const WINO = 0x5000;
export async function init(assets) {
  if (assets === undefined) await f13.init();   // player only (the node check passes assets and uses Sim alone)
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx14.bin')).arrayBuffer());
  S = new Int32Array(b.slice(0, 20484).buffer); LUT = b.subarray(20484, 36868); PHOTO = b.subarray(36868, 100868); PAL = b.subarray(100868, 101636); WIN = b.subarray(101636, 101636 + 64000 + 2 * WINO);
}
const PAD = 0x1400, rol = (v, n) => ((v << n) | (v >>> (32 - n))) | 0;
export class Sim {
  constructor() {
    this.M = new Uint8Array(0x40000 + 0x2000); this.V = new DataView(this.M.buffer); this.M.set(LUT, 0); this.cur = 0x20000; this.oth = 0x10000;
    this.PH0 = new Uint8Array(0x12200); this.PH1 = new Uint8Array(0x12200);
    for (let i = 0; i < 0x12200; i++) { const p = i - PAD, b = p >= 0 && p < 64000 ? PHOTO[p] : 0x7f; this.PH0[i] = Math.max(b - 0x80, 0) >> 1; this.PH1[i] = 0x40 - ((b >> 2) + 1); }
    this.pos = new Int32Array(0x800); this.sp = new Int32Array(0x800); let e = 0x34c297 | 0;
    for (let i = 0; i < 0x800; i++) { this.pos[i] = e & 0xffffff; e = (e + 0x9d) | 0; e = rol(e, 11) ^ 0x9d; }
    for (let i = 0; i < 0x800; i++) { this.sp[i] = (e & 0x3f) + 0x3f; e = (e + 0x9d) | 0; e = rol(e, 11) ^ 0x9d; }
    this.ord = 0; this.a = 0; this.b = 0; this.c = 0; this.d = 0; this.off = [0, 0, 0, 0]; this.SH = new Uint8Array(64);
  }
  tick(o) { this.ord = o; this.a = (this.a + 13) & 0xfff; this.b = (this.b + 32) & 0xfff; this.c = (this.c + 13) & 0xfff; this.d = (this.d + 15) & 0xfff; }
  dw(o) { return this.V.getInt32(o, true); }
  add(o, v) { this.V.setInt32(o, (this.V.getInt32(o, true) + v) | 0, true); }
  render(out) {
    const M = this.M, A = S[this.a] + 0x400;
    for (let k = 0; k < 64; k++) this.SH[k] = ((((k - 31) * A) >> 11) + 0x1f) & 255;
    if (this.ord >= 0x2b) {
      let eax = A, ebp = this.c, ebx = this.d;
      for (let i = 0; i < 0x800; i++) {
        const sp = this.sp[i]; this.pos[i] = (this.pos[i] + sp) | 0;
        let e = (Math.imul(this.pos[i] >>> 10, 320) + sp + eax) | 0;
        e += S[ebp] >> 7; eax = Math.imul(S[ebx] >> 7, 320); e = ((e + eax) & 0xffff) + this.cur;
        this.add(e, 0x10100); this.add(e + 320, 0x1020201); this.add(e + 640, 0x1020201); this.add(e + 960, 0x10100);
        ebp = (ebp + 0x92f) & 0xfff; ebx = (ebx + 0x14c9) & 0xfff;
      }
    }
    const cur = this.cur, oth = this.oth;
    for (let k = 0; k < 0x4000; k++) {
      const s = (0xffff + 4 * k) & 0xffff, b = (1 + 4 * k) & 0xffff, d = (0x140 + 4 * k) & 0xffff, p = (0xfec0 + 4 * k) & 0xffff;
      let v = (this.dw(cur + s) + this.dw(cur + p) + this.dw(cur + d) + this.dw(cur + b)) | 0;
      v = (v >>> 2) & 0x3f3f3f3f; v = (v - ((v >>> 3) & 0x0f0f0f0f)) | 0;
      this.V.setInt32(oth + 4 * k, v, true);
    }
    this.V.setInt32(oth, 0, true);
    let q = this.b;
    for (let j = 0; j < 4; j++, q = (q + 0x400) & 0xfff) this.off[j] = Math.imul(S[q + 0x401] >> 7, 320) + ((S[q] * 5) >> 9);
    const B3 = 0x30000, w0 = WINO + 0xa00;
    for (let i = 0; i < 0xe600; i++) {
      const s = oth + 0xa00 + i, dx = ((M[s - 4] - M[s + 4]) << 24) >> 24, dy = ((M[s - 0x500] - M[s + 0x500]) << 24) >> 24;
      M[B3 + 0xa00 + i] = WIN[w0 + i + dx + dy * 320];
    }
    this.cur = oth; this.oth = cur;
    const [o1, o2, o3, o4] = this.off, { PH0, PH1, SH } = this;
    for (let i = 0; i < 0xe600; i++) {
      const p = PAD + 0xa00 + i;
      let v = ((PH1[p + o1] + PH1[p + o2] + PH1[p + o3] + PH1[p + o4]) & 255) - 0x60; if (v < 0) v = 0;
      v = (v + PH0[p]) & 255; if (v >= 0x3f) v = 0x3f;
      out[0xa00 + i] = LUT[(SH[v] << 8) | M[B3 + 0xa00 + i]];
    }
  }
}
export const palette = out => { for (let i = 0; i < 768; i++) out[i] = PAL[i]; };
// player API: n = ticks since the stage start (order 0x2a row 0), render n follows n updates. Seek = replay from the start (<= ~1550 frames), checkpoints every 128.
// Rows 0-7 and 192-199 are not written by the stage: they hold fx13's last frame (see render).
let cache = null; const orderAt = t => pos(t).order;
// false = black bars on rows 0-7 / 192-199 (the stale fx13 frame under fx14's palette shows as green garbage); true = what the emulated original shows
export const KEEP_FX13_BORDER = false;
export function render(t, ctx) {
  const T0 = at(0x2a, 0), n = Math.max(1, Math.floor((t - T0) * TICK_HZ) + 1);
  if (!cache || cache.n > n) cache = { n: 0, s: new Sim(), idx: new Uint8Array(64000) };
  const s = cache.s;
  if (cache.n < n) { while (cache.n < n) { cache.n++; s.tick(orderAt(T0 + (cache.n - 1) / TICK_HZ)); if (cache.n < n) s.render(cache.idx); } s.render(cache.idx); }
  // rows 0-7 / 192-199 are never written by this stage: VRAM still holds fx13's last frame (oracle: all 5120 px equal to fx13 at n=1533 = its last render; ideal model: its last tick before order 0x2a)
  const nEnd = Math.floor((at(0x2a, 0) - at(0x26, 0)) * TICK_HZ - 1e-9) + 1, b = new Uint8Array(64000); f13.renderN(nEnd, b, new Uint8Array(768));
  ctx.idx.set(cache.idx); if (KEEP_FX13_BORDER) { ctx.idx.set(b.subarray(0, 8 * 320), 0); ctx.idx.set(b.subarray(192 * 320, 64000), 192 * 320); } else { ctx.idx.fill(0, 0, 8 * 320); ctx.idx.fill(0, 192 * 320, 64000); } const p = new Uint8Array(768); palette(p); for (let i = 0; i < 768; i++) ctx.pal[i] = (p[i] << 2) | (p[i] >> 4);
}
