# MEGABLAST (Orange, 1996) - asm snippets worth reading

All addresses are linear addresses of the unpacked image (`DEMO.EXE` = PMODE/W 1.20 stub + Watcom C 32-bit flat code, dumped at the program entry by
`re/unpack_clean.py`; the live code is at 0x1b000..0x62000, `re/low.bin` = linear 0x10000..). The listings were regenerated for this write-up with
`objdump -D -b binary -m i386 -M intel --adjust-vma=0x10000 --start-address=A --stop-address=B re/low.bin` (capstone is not installed on the machine, objdump gives the
same Intel syntax; operand sizes are as objdump prints them, the pointer prefixes `DWORD PTR ds:` are shortened here). The same code is what ran under Unicorn to produce the
oracle frames (`re/NOTES.md`). Data addresses (0x3705e, 0x44980...) are the program's static data.

The demo is a 1996 DOS demo for a 486/Pentium: no MMX, no SSE, x87 only in the vortex, **mode 13h** (320x200x256, linear 0xA0000, palette through ports 0x3c8/0x3c9). Almost every
effect is the same recipe written in hand-allocated asm: a **byte-per-pixel feedback plane**, a tiny **unrolled dot/line** drawn into it, a **4-neighbour blur done on four pixels at a time in a
32-bit register**, and a **palette generated from sines**. The tricks below are the ones that make that recipe cheap.

---

## 1. A fixed-step logic loop with catch-up (0x1c13a..0x1c16b, repeated 17 times)

```
1c13a: call 0x1be68           ; poll the S3M player: order -> [4ab11], row -> [4ab15]
1c13f: call 0x1e752           ; update() of this stage (one logic tick)
1c144: inc  dword [0x52870]   ; ticks done in this loop
1c14a: mov  eax,[0x52888]     ; ticks elapsed (interrupt counter)
1c14f: mov  edi,[0x5288c]
1c155: mov  ebp,[0x52870]
1c15b: sub  eax,edi
1c15d: cmp  eax,ebp
1c15f: ja   0x1c13a           ; while (elapsed - last > done) update()
1c161: mov  eax,[0x52890]     ; snapshot taken before the loop
1c166: mov  [0x5288c],eax
1c16b: call 0x1e535           ; render() of this stage, once
1c170: cmp  dword [0x4ab19],1 ; end flag set by update()
```

The timer callback is a single instruction (`1be10: inc dword [0x52888]`, called once per retrace by the lib at 0x27936..0x27ca1). The main loop turns it into a
**fixed 70 Hz logic with a variable render rate**: if a render was slow, the loop runs several `update()` before the next `render()`; if it was fast, it renders with nothing to update.
Consequence for the port: every effect is a function of the number of updates `n` since the stage start, not of the frame number (the port uses `n = floor((t-T0)*70.086)+1`,
a model, see the README). Each stage ends on a compare of the S3M order (`cmp [4ab11], N` at the loop head, e.g. 0x1c0b1 for stage 1), so **the music is the script**.

## 2. Blur of four pixels in one 32-bit register (0x20c14..0x20c4e, fx04)

```
20c14: mov eax,[esi-2]        ; the 4 pixels left-shifted by 2 pixels
20c17: add eax,[esi+2]        ; 2 pixels right
20c1a: add eax,[esi+0x280]    ; 2 rows down (0x280 = 2*320)
20c20: add eax,[esi-0x280]    ; 2 rows up
20c26: shr eax,2              ; mean of the 4 neighbours ...
20c29: and eax,0x3f3f3f3f     ; ... and kill the bits that crossed from the neighbouring byte
20c2e: mov ebx,eax
20c30: shr ebx,2
20c33: and ebx,0x3f3f3f3f
20c39: sub eax,ebx            ; x (1 - 1/4): the decay of the feedback
20c3b: mov [edi],eax          ; next feedback plane
20c3d: add eax,[edx]          ; + background picture, 4 pixels at once
20c3f: mov [ebp],eax          ; straight into VRAM (ebp = 0xa0000)
 ... add esi/edi/ebp/edx,4 ; dec ecx ; jne 20c14        ; ecx = 0x3e80 = 16000 dwords
```

Why it is nice:

* **SWAR** ("SIMD within a register"): one `add` sums 4 pixels, one `shr`+`and` divides 4 bytes by 4 without letting a byte's low bits leak into its neighbour; the decay is the same
  trick (`x - (x>>2 & mask)`). 16000 iterations instead of 64000.
* The blur, the decay, the feedback store and the blit to VRAM are **one pass**: the dword is stored twice (feedback plane and screen) and the background is added on the way.
* The neighbours are at +-2 pixels and +-2 rows (not +-1): a wider kernel for free, because a dword load at `[esi-2]` already is "4 pixels shifted by 2". Unaligned dword loads cost nothing on a 486.
* The picture is **additive in palette space**: the background is a second plane that the DAC sees summed with the feedback (`add eax,[edx]`). The palette (snippet 10) is built so that sums make sense. Carries between bytes
  are real in the original (the sum of four neighbours can exceed 255 in a byte when the feedback is saturated near the limit); the port keeps them (`re/NOTES.md`, fx04).
* The decay and the mask are per effect constants, read straight from the code: fx04 `>>2` (x0.75, 0x20c30), fx05 `>>3` with `0x1f1f1f1f` (x0.875), fx09 `>>2` (x0.75), fx14 `>>3` with `0x0f0f0f0f` (0x22931),
  the shared 0x2217d engine `>>1` (x0.5, 0x22040: `shr ebx,1`). The kernel offsets are +-2/+-2 rows (fx04, fx11/15/16), +-4 / +-4 rows (fx05, 0x500 = 4 rows), +-3 / +-3 rows (fx09, 0x3c0 = 3 rows).

## 3. The 12-pixel dot, unrolled with a saturating add (0x2090a..0x209c4, fx04)

```
2090a: add edi,[0x44980]               ; plane base + y*320 + x
20910: cmp byte [edi+1],0x3e
20914: jae 0x2091a
20916: add byte [edi+1],1              ; weight 1
2091a: cmp byte [edi+2],0x3e ; jae ; add byte [edi+2],1
20924: cmp byte [edi+0x140],0x3e ... add byte [edi+0x140],1
2093d: add byte [edi+0x141],2          ; the four middle pixels get weight 2
20954: ... [edi+0x143],1 ; [edi+0x280],1 ; [edi+0x281],2 ; [edi+0x282],2 ; [edi+0x283],1
209a4: ... [edi+0x3c1],1 ; [edi+0x3c2],1
```

The "pixel" of the ray/line effects is a 4x4 blob without corners: weights `. 1 1 .` / `1 2 2 1` / `1 2 2 1` / `. 1 1 .` (offsets 1,2 / 0x140..0x143 / 0x280..0x283 / 0x3c1,0x3c2),
**fully unrolled** (no inner loop, no pattern table) with a per-byte saturation `cmp ..,0x3e ; jae skip ; add`. The threshold is a per-effect constant: 0x3e (fx04), 0xf0 (fx01), 0x38 (fx05), 0x3c (the 0x2217d engine, a *signed* `jge`), and fx09 uses a 16x16 pattern table
instead (0x1ea40, 256 `mov al,[pattern+k]; cmp ..; add` triplets, the pattern pre-shifted `>> 2` once at init by `lods/shr al,2/stos`, 0x1e8f4). The threshold keeps a bright pixel under the blur's
byte-overflow limit (4 neighbours x 0x3e = 0xf8 < 0x100), which is also why the palette only uses 0..0x3f for the feedback part.

## 4. Free texture wrap-around from 16-bit register arithmetic (0x20564..0x2057d, fx12)

```
205b6: or  eax,0xffff            ; init: align the buffers up to a 64 KB boundary
205bb: inc eax
...
20564: mov bx,[ebp+0]            ; per-pixel texture offset (precomputed word table, asset 5)
20568: add bx,si                 ; + camera offset: 16-bit add, WRAPS inside the 64 KB texture
2056b: mov al,[ebx]              ; ebx high word = texture base, low word = the wrapped offset
2056d: add ebp,2
20570: mov [edi],al              ; screen pixel
20572: mov al,[eax]              ; ah = shade level (prepared at 0x2054f/0x20555), al = texel -> shaded texel
20574: mov [edx],al              ; into the next frame's texture (stride 256)
```

The 256x256 texture sits at a 64 KB aligned address, so `bx` is the only part of the pointer that changes: **the texture wraps by itself** with no `and`, no compare. Moving the camera = adding one 16-bit word `si` (`(da>>4) + ((de>>4)<<8)`)
to every offset. The second line is a **second table lookup in the same loop**: `ah` holds the shade level, `al` the texel, so `[eax]` is a 64x256 shade table indexed `level<<8 | texel`.
The same trick makes the fx14 blur toroidal (0x22904: `sub si,1 / add bx,1 / add dx,0x140 / sub bp,0x140`, then `add si,4`...: the four neighbour pointers are **16-bit registers** and wrap inside the 64 KB plane,
so the blur has no edge test at all), and the plane of fx14 is allocated the same way (0x22619: `or eax,0xffff; inc eax`).

## 5. 2D table lookup from two byte registers (0x1dac2..0x1dadb, moire; 0x227d2, fx14)

```
1dac2: mov ebx,[0x37006]         ; 64 KB-aligned colour table, low word 0
1dac8: mov ebp,[0x3c676]         ; background picture
1dace: mov bl,[esi]              ; low byte  = moire pixel (warped texture)
1dad0: mov bh,[ebp+0]            ; high byte = background pixel
1dad3: mov al,[ebx]              ; table[bg<<8 | warp]
1dad5: mov [edi],al              ; VRAM
```

Three instructions of work per pixel: the **colour mixing is a lookup in a 16 KB table indexed by two bytes**, built by putting the two inputs in `bl` and `bh`. The palette/table pair was designed so that the table does the arithmetic
(blend of the moire with the picture). fx14 does the same with `mov bl,[edx] ; mov bh,al ; mov al,[ebx]` (0x227d2..0x227d6) where `al` is the shade level computed from the photo.

## 6. 24.8 coordinates whose integer parts are registers (0x1d93e..0x1da46, moire cells)

```
1d93e: push ecx / push edx          ; ecx = y (24.8), edx = x (24.8)
       mov bh,ch                    ; integer part of y = bits 8..15 = ch
       mov bl,dh                    ; integer part of x = dh
       mov al,[ebx]                 ; texel of the 256x256 texture (ebx high word = base)
       add ecx,esi / add edx,ebp    ; step in texture space
       mov bh,ch / mov bl,dh / mov ah,[ebx]
       ... rol eax,0x10 ... mov al,[ebx] ... mov ah,[ebx] ... rol eax,0x10
       mov [edi],eax                ; 4 texels written as one dword
```

Texture coordinates are 8.8 fixed point with the texture 256 wide: **the integer part is exactly one byte of the register**, so there is no shift and no mask: `bh=ch, bl=dh` is the texel address.
Four pixels are collected in `eax` (two in `ax`, `rol eax,16`, two more) and stored with one `mov [edi],eax`. The cell is 4x4 pixels (one such block repeated for the four rows with per-row `add edx,[0x36bf6]` / `add ecx,[0x36bfa]`,
all unrolled) and the 81x51 mesh of (x,y) texture coordinates (built per frame, 24.8) is walked with a bilinear step `(corner - corner) >> 2`: **the whole warp costs one lookup per pixel**, the rest is on 4080 mesh points.

## 7. Cross-fading two images with two 256-byte tables (0x20228..0x202a5, fx13)

```
2021f: mov eax,edx / imul eax,[0x469e4]    ; i * A
20228: mov [edi+0x47000],ah                ; LA[i] = (i*A) >> 8   (ah = bits 8..15: no shift)
2022e: mov eax,edx / imul eax,[0x469e8]    ; i * B   (B = 0x100 - A)
20237: shr eax,3 / mov [edi+0x47100],ah    ; LB[i] = (i*B) >> 11
 ...
20295: mov al,[esi]                        ; pixel of the animated 160x100 frame (already 2x upscaled)
20297: mov bl,[edx]                        ; pixel of the 320x350 photo
20299: mov al,[eax+0x47000]                ; LA[al]
2029f: add al,[ebx+0x47100]                ; + LB[bl]
202a5: mov [edi],al                        ; VRAM
```

The mix ratio changes every frame (`A = (sin[idx]+0x400)>>3`), but instead of multiplying 64000 pixels the code **rebuilds two 256-entry tables** (512 multiplies) and does two lookups and an add per pixel. `mov [..],ah` after
`imul` is a free `>>8`. The palette fade uses the same: `movzx eax,byte [esi] ; imul eax,edx ; mov [edi],ah` (0x20376..0x2037c) = `(c * fade) >> 8` for 768 DAC bytes, fade 0x100 = unity (the flashes of the other stages set 0x140/0x200).

## 8. Interpolating 2x upscale inside 16-bit registers (0x20470..0x2049c, fx00 / fx13)

```
20470: mov ax,[esi]             ; two source pixels: al = p0, ah = p1
20473: add ah,al                ; ah = p0 + p1 (8-bit wrap)
20475: shr ah,1                 ; ah = (p0+p1)/2 : the pixel BETWEEN them
20477: mov [edi],ax             ; destination pixels (p0, mid)
2047a: mov bx,[esi+0xa0]        ; same two pixels one source row below (160 = source width)
20481: add bh,bl / shr bh,1     ; mid of the lower pair
20485: add ax,bx                ; average the two rows, both bytes at once ...
20488: shr ax,1
2048b: and ax,0x3f3f            ; ... and clear the bits that crossed bytes (6-bit data)
2048f: mov [edi+0x140],ax       ; next destination row
```

A 160x100 frame is stretched to 320x200 with bilinear interpolation for about 8 instructions per **2x2 output pixels**: horizontal interpolation in `ah`, vertical interpolation by adding the two words as 16-bit values.
The `and ax,0x3f3f` works because the frame data is 6-bit (palette indices 0..0x3f); it also means the bit that `shr ax,1` moves from `ah` into `al` is masked away instead of being wrong. `add ah,al` can wrap
for 8-bit data, which the port reproduces on purpose (`((ah+al)&255)>>1`).

## 9. The same 3-instruction RNG at four sites (0x1e606, 0x218c1, 0x22747, 0x22770)

```
218c1: add ebp,0x9d
218c7: rol ebp,0xb
218ca: xor ebp,0x9d
```

`x = rol(x + 0x9d, 11) ^ 0x9d`: a **three-instruction PRNG** used for the ray radii (fx01, 0x1e606), the voronoi tile counters (fx07, 0x218c1, 32 steps per frame) and the particle tables of fx14 (0x22747 for 2048 positions, 0x22770 for
2048 speeds, seed 0x34c297, `and 0xffffff`/`and 0x3f + 0x3f`). Nearby variants exist (`rol 0xa` at 0x2205b in the shared blur loop, where the result is not read inside the loop; `ror 0xa` at 0x202e6). Small enough to inline everywhere,
which is also what makes the port easy: the generator is a closed form, so the "random" frames are reproducible bit by bit (no table to dump).

## 10. Palette from sines, uploaded in the retrace with `rep outsb` (0x20b51..0x20bf6, fx04)

```
20b60: mov esi,[0x47f30]            ; phase of the red ramp
20b66: mov eax,[esi*4+0x3705e]      ; sin table
20b6d: add eax,0x4400
20b72: imul eax,edx                 ; * colour index i (edx = 0..255)
20b75: sar eax,0xd
20b78: cmp eax,0x3f / jl / mov eax,0x3f   ; clamp to the 6-bit DAC range
20b82: mov [edi],al                 ; ... then the same for green ([0x47f34]) and blue ([0x47f38])
20bd5: mov dx,0x3da / in al,dx / test al,8 / je ...    ; wait for vertical retrace
20bde: ... jne ...
20be3: mov esi,0x47c30 / mov ecx,0x300 / mov dx,0x3c8 / mov al,0 / out dx,al / inc dx
20bf6: rep outs dx,byte [esi]       ; 768 bytes to the DAC
```

Each channel is a linear ramp of the index whose **slope is modulated by a sine** of a slowly moving phase (`(sin + 0x4400) * i >> 13`: slope 2.0..2.25 per index, clamped at 0x3f), so the three channels slowly drift against each other and the
whole picture changes colour without a single pixel being touched. The palette upload (768 `out`s in one instruction, started right after the retrace edge) is cheap enough to be done every frame. Variants: fx09 and fx01 use other
sine/offset constants (0x4400, 0x2400 and a fade factor, 0x1e535). In the 6-bit DAC range the blur's 0..0x3f feedback values index the first part of the ramp; the background picture's indices (added) index the rest.

## 11. Square root from the float bits (0x22c8a..0x22cb7, fx06 vortex)

```
22c86: fstp dword [esp+0x58]       ; x as float32
22c8a: mov eax,[esp+0x58]
22c8e: mov edx,eax
22c90: and eax,0x7fffff            ; mantissa
22c95: sub edx,0x3f800000          ; remove the exponent bias
22c9b: mov ebx,edx
22c9d: and edx,0xff000000          ; exponent part
22ca3: and ebx,0x800000            ; exponent's low bit
22ca9: sar edx,1                   ; exponent / 2
22cab: or  eax,ebx                 ; the odd exponent bit becomes the mantissa's top bit
22cad: add edx,0x3f800000          ; re-bias
22cb3: sar eax,1                   ; mantissa / 2
22cb5: add eax,edx
22cb7: mov [esp+0x58],eax          ; ~ sqrt(x), as float32
```

An IEEE float read as an integer is roughly its own logarithm, so halving it halves the logarithm: a **square root with a few integer instructions** (no `fsqrt`, which cost dozens of cycles on a Pentium).
It is used for the 41x26 lattice of the vortex (0x22b80, twice per point; the second time the result goes through an exact `fdivr` to normalise the vector, so the approximation only bends the shape). The port reproduces it
with float32 bit casts (`bt()` in `web/fx/fx06.js`). The rest of the vortex is stack-heavy compiled-looking x87 code (locals spilled at `[esp+..]`, `fistp` through the stack), unlike the register-resident loops of the other stages.

## 12. Cheap multiplications by 320 and by 5/512 (0x21f37, 0x2296f)

```
21f37: lea ebx,[ebx+ebx*4]    ; y*5
21f3a: shl ebx,6              ; *64   = y*320
21f3d: add ebx,eax            ; + x
 ...
2296f: lea eax,[eax+eax*4]    ; sin * 5
22972: sar eax,9              ; * 5/512 : wobble amplitude in pixels
```

`y*320` is `lea` + `shl` (two cheap instructions on the 486/Pentium, no `imul` latency); fx14's wobble offsets use `lea [eax+eax*4]` and a shift to get a non-power-of-two amplitude (5/512 of a +-1023 sine) for the horizontal part and
`sar ebx,7 ; imul ebx,ebx,0x140` for the vertical (0x22975). Elsewhere (0x21f3a, 0x22a5c) `shl ebx,6 ; lea ebx,[ebx+ebx*4]` is `*320` after a signed byte difference.

## 13. Displacement from a signed byte difference (0x22a44..0x22a6d, fx14)

```
22a44: mov al,[esi-4]
22a47: sub al,[esi+4]          ; horizontal gradient of the blurred plane, as a signed byte
22a4a: movsx edx,al            ; -> displacement in pixels
22a4d: mov al,[esi-0x500]
22a53: sub al,[esi+0x500]      ; vertical gradient (4 rows)
22a59: movsx ebx,al
22a5c: shl ebx,6
22a5f: lea ebx,[ebx+ebx*4]     ; * 320 = rows
22a62: add edx,ebx
22a64: mov al,[edx+ebp]        ; source pixel (asset 16's picture) at i + dx + 320*dy
22a67: mov [edi],al
```

A warp (the logo is refracted by the glowing blurred plane) in **eight instructions per pixel**: the 8-bit subtraction wraps, `movsx` sign-extends, and the result is directly the memory offset into the source picture (no table).
No clamp: the source is in a 64 KB-aligned region and the displacement range is small (+-0x80 rows would not fit; the effect only ever produces small gradients, the port reproduces it with the same wraps).

## 14. Dword splats: four pixels per `add [mem],imm32` (0x2289a..0x228be, fx14)

```
2289a: add dword [edi],0x10100       ; bytes 00 01 01 00  (little endian: +0,+1,+1,+0)
228a0: add edi,0x140
228a6: add dword [edi],0x1020201     ; bytes 01 02 02 01
228ac: add edi,0x140 ; 228b2: add dword [edi],0x1020201
228b8: add edi,0x140 ; 228be: add dword [edi],0x10100
```

fx14's 2048 particles are drawn as a 4x4 dot (the same shape as snippet 3) with **four dword read-modify-writes** instead of twelve byte compares: no saturation test at all (the later blur masks with 0x3f3f3f3f and the carries are part of the look), and the
particle address is the sum of two sines scaled by the speed plus the particle's own position `(pos >> 10) * 320 + speed + ...` masked `and edi,0xffff` into the 64 KB plane (0x2288e), so particles wrap around.

## 15. Line walker: |d| without the `sub`, a count in half-pixels, and step by division (0x207fe..0x2083e, fx04; same code at 0x1e1b1, 0x20d46, 0x2157c)

```
207fe: mov eax,[0x47bf8] / sub eax,[0x47bfc] / cdq / xor eax,edx   ; |dx| (-1 for negatives!)
2080e: mov eax,[0x47c00] / sub eax,[0x47c04] / cdq / xor eax,edx   ; |dy|
2081c: cmp eax,ecx / jl / mov ecx,eax                              ; max
20822: shr ecx,9               ; steps = max(|dx|,|dy|) / 512  (coordinates are 24.8: 256 = 1 pixel)
20825: cmp ecx,0 / jne / inc ecx
2082b: mov eax,[0x47bfc] / sub eax,[0x47bf8] / cdq / idiv ecx / mov [0x47c08],eax    ; step x
```

`cdq ; xor eax,edx` is the textbook branch-free absolute value, **missing its `sub eax,edx`**: for a negative difference it yields |d|-1. The port keeps the quirk (`dx ^= dx >> 31`), because the step count depends on it (`re/NOTES.md`,
fx07). Coordinates are 24.8 fixed point (0xa000 = pixel 160), so `max >> 9` is *half* the pixel length: the walker steps about 2 pixels at a time and the 4x4 dot of snippet 3 fills the gaps. The line is not a Bresenham: two `idiv`s per line, then
one `add` per axis per step (0x209c4). The loop also has no clipping per step: both endpoints are tested up front (eight `cmp`/`jl/jg` at 0x2085d..0x208c8) and only the walk's own `shr 8` coordinate is checked against 0x13b / 0xc3 at each step (0x208eb..0x208fc).

## 16. Run-length decoder shared by all animation frames (0x2018a, 0x20163)

```
2018f: lods al,[esi]
20190: mov bl,al / and bl,0xc0 / cmp bl,0xc0 / jne 0x201a6      ; PCX-style: top two bits set = run
2019a: and al,0x3f / movzx ecx,al / add edx,ecx / lods al,[esi]   ; count (1..63), value
201a2: rep stos [edi],al
201a6: inc edx / stos [edi],al                                     ; literal
201a8: cmp edx,0x3200 / jne 0x2018f                                ; until exactly 12800 bytes (160x80)
```

Same format as PCX (the PCX decoder of the pictures is the same idea with `>= 0xc0`). 0x2018a decodes a 160x80 frame, 0x20163 a 160x100 frame (`cmp edx,0x3e80`, 16000 bytes): the frame counter is the only thing
that moves, one frame is decoded per animation step directly into a fixed buffer (the helicopter of fx00 is 238+ such frames, 2.8 MB of DATA.DAT, decoded on demand: `[46608]` is the frame counter, `cmp [46608],0xf0` stops at 240).

## 17. Raster-time marker on the space bar (0x22a89..0x22acf, fx14)

```
22a89: in al,0x60 / cmp al,0x39 / jne ...        ; space bar make code
22a8f: mov al,0 / mov dx,0x3c8 / out dx,al / inc dx
22a98: mov al,0x20 / out dx,al / mov al,0x10 / out dx,al / mov al,0x30 / out dx,al   ; colour 0 = (0x20,0x10,0x30)
 ... wait for retrace ...
22ac2: mov al,0 / out dx,al ... colour 0 = black again
```

Not an optimisation, but the typical demo-coder "how long does my frame take" bar: while space is held the border/background colour turns purple for the duration of the heavy part of the frame and is reset to black right after the retrace. It is present in
fx14 only (I did not find it in the other stages' loops); the port does not implement it.
