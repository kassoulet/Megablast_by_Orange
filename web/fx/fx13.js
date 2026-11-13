// fx13 = stage 14 of the demo: crowd photo -> Dali face (update 0x203c4, render 0x201ea, init 0x200de). Matches the Unicorn oracle on 1538 frames except ONE pixel (314,193) in frames with anim frame 6 (see re/NOTES.md, unresolved).
// State after n updates (70.086 Hz ticks since the stage start): [47200]=min(n,0x4b0) picture scroll (>>3 = rows), [46610]=n%14 anim frame (>>1 = 160x100 frame 0..6), [46cec]=(n*0x20)&0xfff sine index.
export const TICK_HZ = 70.086;
let PAL, SINE, FR, PIC;   // FR = 7 frames x 16000 (RLE-decoded, 0x20163), PIC = 320x350
export async function init(assets) {
  const b = new Uint8Array(assets ?? await (await fetch('assets/fx13.bin')).arrayBuffer());
  PAL = b.subarray(0, 768); SINE = new Int16Array(b.slice(768, 768 + 8192).buffer);
  const a17 = b.subarray(768 + 8192, 768 + 8192 + 69020); PIC = b.subarray(768 + 8192 + 69020);
  FR = new Uint8Array(7 * 16000); let s = 0, d = 0;
  for (let f = 0; f < 7; f++) {   // 0x20163: literal byte, or (b&0xc0)==0xc0: count=b&63, value=next; until the frame has 16000 bytes
    let e = 0;
    while (e !== 16000) { const v = a17[s++]; if ((v & 0xc0) === 0xc0) { const c = v & 63, x = a17[s++]; FR.fill(x, d, d + c); d += c; e += c; } else { FR[d++] = v; e++; } }
  }
}
const BUF = new Uint8Array(64000), LA = new Uint8Array(256), LB = new Uint8Array(256);
export function renderN(n, out, pal) {   // out: 64000 indices, pal: 768 bytes (6-bit DAC values if pal6, else 8-bit)
  const c47200 = Math.min(n, 0x4b0), f = n % 14, c46cec = (n * 0x20) & 0xfff;
  const A = (SINE[c46cec] + 0x400) >> 3, B = 0x100 - A;
  for (let i = 0; i < 256; i++) { LA[i] = (i * A) >> 8; LB[i] = (i * B) >> 11; }
  // 0x20454: 160x100 frame -> 320x200 buffer (2x, blended; 16-bit word ops incl. cross-byte carry, as the asm)
  BUF.fill(0); let si = (f >> 1) * 16000 + 0x320, di = 0x77b;
  for (let r = 0; r < 0x5e; r++) {
    si += 5; di += 10;
    for (let c = 0; c < 0x9b; c++, si++, di += 2) {
      const al = FR[si], ah = FR[si + 1];
      BUF[di] = al; BUF[di + 1] = ((ah + al) & 255) >> 1;
      const bl = FR[si + 0xa0], bh = FR[si + 0xa1], bh2 = ((bh + bl) & 255) >> 1;
      const w = (((((ah + al) & 255) >> 1) << 8 | al) + (bh2 << 8 | bl)) & 0xffff;
      const v = (w >> 1) & 0x3f3f; BUF[di + 0x140] = v & 255; BUF[di + 0x141] = v >> 8;
    }
    di += 0x140;
  }
  const po = (c47200 >> 3) * 320;
  for (let p = 0; p < 64000; p++) out[p] = (LA[BUF[p]] + LB[PIC[po + p]]) & 255;
  for (let i = 0; i < 768; i++) pal[i] = PAL[i];
}
// player API. Time -> n: the stage starts at S3M order 0x26 row 0 (the previous stage's loop ends when order >= 0x26); n = ticks since then (+1: the first render follows one update). ponytail: real-time n also depends on the init time of the original (not reproducible), so this alignment is a model.
import { at } from './timeline.js';
const T0 = () => at(0x26, 0);
export function render(t, ctx) {
  const n = Math.max(1, Math.floor((t - T0()) * TICK_HZ) + 1);
  renderN(n, ctx.idx, ctx.pal); for (let i = 0; i < 768; i++) ctx.pal[i] = (ctx.pal[i] << 2) | (ctx.pal[i] >> 4);
}
