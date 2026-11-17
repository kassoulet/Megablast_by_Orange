// Shared engine of stages 12 (fx11), 16 (fx15), 17 (fx16): update 0x2243d / 0x224e9, render 0x2217d (+ 0x21e42 point loop, 0x2200c blur). A 128x128 grid of points is displaced by
// two sums of four sines (A[x] + B[y], bytes), rotated by two sine-driven angles, projected with a paraboloid depth term and splatted (12 bytes, saturating at 0x3c, SIGNED byte compare)
// into a 320x200 plane; the plane is blurred (4 neighbours at +-2 bytes / +-2 rows as dword adds, so carries cross bytes; x0.75) into VRAM and the other plane (feedback), then the planes swap.
// Stateful (feedback): replay from the stage start.
let S, PAL;
export async function loadAssets(a) {
  const b = new Uint8Array(a ?? await (await fetch('assets/fx11.bin')).arrayBuffer());
  S = new Int32Array(b.slice(0, 20484).buffer); PAL = b.subarray(20484, 20484 + 768);
}
export const palette = (out, swap = false) => { for (let i = 0; i < 256; i++) { out[3 * i] = PAL[3 * i]; out[3 * i + 1] = PAL[3 * i + (swap ? 2 : 1)]; out[3 * i + 2] = PAL[3 * i + (swap ? 1 : 2)]; } };
const PAD = 0x1400, SIZE = 0x12200 + 0x1400;
export class Sim {
  // variant: 0 = update 0x2243d (stage 12, 17), 1 = update 0x224e9 (stage 16); prev = Sim to continue from (stage 17 keeps stage 16's planes and phases; its init 0x220d7 only resets the steps)
  constructor(variant = 0, prev = null, keep = true) {
    this.variant = variant; this.amp = 256;
    this.ph = new Int32Array(16); this.ph.set([0, 0, 0, 0, 0, 0, 0, 0, 64, 128, 128, 64, 64, 128, 128, 64]);   // 4ac94..4acb0 phases, 4acb4..4acd0 steps
    this.p20 = 0; this.cur = new Uint8Array(SIZE); this.oth = new Uint8Array(SIZE); this.Z = new Uint8Array(16384);
    if (prev) {   // keep=false (stage 16): phases/amp/p20 survive from stage 12, planes cleared, steps default; keep=true (stage 17): planes kept, steps 0x40..
      this.amp = prev.amp; this.ph.set(prev.ph.subarray(0, 8)); this.p20 = prev.p20;
      if (keep) { this.cur.set(prev.cur); this.oth.set(prev.oth); this.ph.set([0x40, 0x30, 0x30, 0x40, 0x40, 0x30, 0x30, 0x100], 8); }
    }
  }
  tick() {
    const p = this.ph; if (this.amp !== 0) this.amp -= 4;
    const d = [15, 5, -6, -9, 13, -7, -8, 11]; for (let i = 0; i < 8; i++) p[i] = (p[i] + d[i]) & 0xfff;
    this.p20 = (this.p20 + 2) & 0xfff;
    if (this.variant) { const e = [2, -3, 3, -1, -2, -4, 2, 3]; for (let i = 0; i < 8; i++) p[8 + i] += e[i]; }
  }
  render(out, pal) {
    const p = this.ph, A = new Uint8Array(128), B = new Uint8Array(128), Z = this.Z;
    const amp = this.amp, sB = Math.imul(S[3072], amp) >> 8, sA = Math.imul(S[(3072 + 0x800) & 0xfff], amp) >> 8, k35 = sB + 0x400, k31 = sA + 0x400;   // 4b035 from phase 3072, 4b031 from +0x800
    for (let t = 0; t < 2; t++) {
      const ph = [p[4 * t], p[4 * t + 1], p[4 * t + 2], p[4 * t + 3]], st = p.slice(8 + 4 * t, 12 + 4 * t), T = t ? B : A;
      for (let i = 0; i < 128; i++) {
        T[i] = ((S[ph[0]] + S[ph[1]] + S[ph[2]] + S[ph[3]] + 0x1000) >> 6) & 255;
        for (let k = 0; k < 4; k++) ph[k] = (ph[k] + st[k]) & 0xfff;
      }
    }
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) Z[y * 128 + x] = (A[x] + B[y]) & 255;
    const sn = S[this.p20], cs = S[this.p20 + 0x401], sn2 = S[0], cs2 = S[0x401], I8 = new Int8Array(this.cur.buffer), c = this.cur;
    let o = 0;
    for (let a0 = -0x200, i = 0; i < 128; i++, a0 += 8) for (let b0 = -0x200, j = 0; j < 128; j++, b0 += 8, o++) {
      let ecx = -(Z[o] * 4), eax, ebx;
      eax = (Math.imul(a0, cs) - Math.imul(b0, sn)) >> 10; ebx = (Math.imul(b0, cs) + Math.imul(a0, sn)) >> 10;
      const nb = (Math.imul(ebx, cs2) - Math.imul(ecx, sn2)) >> 10, nc = (Math.imul(ecx, cs2) + Math.imul(ebx, sn2)) >> 10; ebx = nb; ecx = nc;
      eax = Math.imul(eax, k31) >> 10; ebx = Math.imul(ebx, k35) >> 10;
      ecx += 1280; ecx += (Math.imul(eax, eax) + Math.imul(ebx, ebx)) >> 9;
      if (ecx <= 1) continue;
      const y = Math.trunc((ebx * 256) / ecx) + 0x64, x = Math.trunc((eax * 256) / ecx) + 0xa0;   // xchg: the first idiv divides Y... see note below
      if (x < 0 || y < 0 || x > 0x13b || y > 0xc3) continue;
      const q = PAD + y * 320 + x, inc = (d, v) => { if (I8[q + d] < 0x3c) I8[q + d] += v; };
      inc(1, 1); inc(2, 1); inc(0x140, 1); inc(0x141, 3); inc(0x142, 3); inc(0x143, 1); inc(0x280, 1); inc(0x281, 3); inc(0x282, 3); inc(0x283, 1); inc(0x3c1, 1); inc(0x3c2, 1);
    }
    const V = new DataView(c.buffer), W = new DataView(this.oth.buffer);
    for (let k = 0; k < 16000; k++) {
      const q = PAD + 4 * k;
      let s = (V.getUint32(q - 2, true) + V.getUint32(q + 2, true) + V.getUint32(q + 0x280, true) + V.getUint32(q - 0x280, true)) >>> 0;
      let e = (s >>> 2) & 0x3f3f3f3f; e = (e - ((e >>> 1) & 0x3f3f3f3f)) >>> 0;
      W.setUint32(q, e, true); out[4 * k] = e & 255; out[4 * k + 1] = (e >>> 8) & 255; out[4 * k + 2] = (e >>> 16) & 255; out[4 * k + 3] = e >>> 24;
    }
    [this.cur, this.oth] = [this.oth, this.cur];
  }
}
export const TICK_HZ = 70.086;
// Player stage: n = max(1, floor((t - T0) * TICK_HZ) + 1) ticks (render n follows n updates), replayed from the stage start (cache; render() advances the planes so it runs once per tick).
// ponytail: the real tick count at each render is machine dependent (K=7 batching in the harness), same model as fx12/fx14.
export class Stage {
  constructor(T0, variant, mkPrev = null, keep = true) { this.T0 = T0; this.variant = variant; this.mkPrev = mkPrev; this.keep = keep; this.c = null; }
  start() { return new Sim(this.variant, this.mkPrev ? this.mkPrev() : null, this.keep); }
  render(t, idx, pal, swap = false) {
    const n = Math.max(1, Math.floor((t - this.T0) * TICK_HZ) + 1);
    if (!this.c || this.c.n > n) this.c = { n: 0, s: this.start(), idx: new Uint8Array(64000) };
    const c = this.c; while (c.n < n) { c.n++; c.s.tick(); if (c.n < n) c.s.render(c.idx); } if (c.done !== n) { c.s.render(c.idx); c.done = n; }
    idx.set(c.idx); const p = new Uint8Array(768); palette(p, swap); for (let i = 0; i < 768; i++) pal[i] = (p[i] << 2) | (p[i] >> 4);
  }
}
