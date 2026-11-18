# MEGABLAST (Orange, Dec 1996) - the 17 scenes and the art behind them

Companion of `WRITEUP-asm.md` (the asm tricks, with addresses). Everything here comes from the code and notes in this folder (`README.md`, `re/NOTES.md`, `web/fx/*.js`, `tools/export_*.py`, the disassembly of `re/low.bin`)
and from decoding `DATA.DAT` with `python -I`. Where something is a model or a fit, it says so. Addresses are linear addresses of the unpacked program (see `WRITEUP-asm.md`).

## At a glance

* DOS, PMODE/W 1.20 + Watcom C, **mode 13h** (320x200, 256 colours, palette through ports 0x3c8/0x3c9). The pixels are not square: show it at **4:3**.
* One executable, one 4 MB data blob (`DATA.DAT`, 24 assets), one texture (`PLASTI3D.PCX`), one S3M module (`MUSTAKS.S3M`, played to order 0x34 = 284.9 s, then text mode and the string "pertti").
* 17 stages in a straight-line list, each `init(); loop { update() x catch-up; render() } until S3M order >= N`. **The music is the script**: stage ends are S3M order thresholds (`re/NOTES.md`).
* The demo has almost no polygon or sprite engine. Eleven of the 17 scenes are the same recipe: a byte plane that is fed by tiny splats/lines, blurred 4 pixels at a time in a 32-bit register, with a palette made of sine ramps.
* Port: `web/` (ES modules, no build, libopenmpt in `web/vendor`). All 17 stages are ported; 16 are 0 differing pixels against a Unicorn oracle, fx13 differs by one pixel (details at the end).

## Timeline

Stage start = S3M (order,row) (`web/timetable.js`); times from libopenmpt (`tools/mk_timeline_openmpt.py`), they agree with the own S3M walker that drove the oracle clock on all 3435 rows (max 0.34 s).

| # | scene | starts at order | render / update | kind (see below) |
|---|---|---|---|---|
| fx00 | helicopter | 0 | 0x2032b / 0x20401 | precomputed RLE movie, 2x blit |
| fx01 | light rays | 3 | 0x1e535 / 0x1e752 | rays + blur feedback |
| fx02 | moire plasma | 5 row 12 | 0x1d770 / 0x1de0a | texture-coordinate mesh warp |
| fx03 | moire + logo | 9 | 0x1d378 / 0x1df1e | mesh warp |
| fx04 | light lines | 0x0b | 0x20a13 / 0x20c7a | lines + blur feedback |
| fx05 | cube grid | 0x0e | 0x2111b / 0x2143a | 3D wire grid + blur feedback |
| fx06 | vortex | 0x10 | 0x23288 / none | x87 tunnel/vortex on a texture |
| fx07 | voronoi wire | 0x14 | 0x21840 / 0x21c3b | 3D wire graph + tile counters |
| fx08 | star logo | 0x16 | 0x1dade / 0x1df98 | mesh warp |
| fx09 | flower blob | 0x18 | 0x1e8fc / 0x1ffba | sum-of-sines point curve + blur feedback |
| fx10 | megablast logo | 0x1c | 0x1d574 / 0x1df98 | mesh warp |
| fx11 | blue ring | 0x20 | 0x2217d / 0x2243d | shared splat-grid engine |
| fx12 | checker tunnel | 0x24 | 0x20659 / 0x206c1 | precomputed offset table + shading feedback |
| fx13 | crowd - Dali | 0x26 (row 0 of order 38 = 0x26) | 0x201ea / 0x203c4 | two-picture cross-fade |
| fx14 | bar photo + logo | 0x2a | 0x227ea / 0x22b1c | particles + blur + displacement |
| fx15 | blue sphere | 0x2e | 0x2217d / 0x224e9 | shared engine |
| fx16 | green blob | 0x30 | 0x2217d / 0x2243d | shared engine |

Start orders are the "until order" of the previous stage in the table of `re/NOTES.md` (stage N ends at the next stage's start order). fx02's start (5,12) is the only one that is not row 0: it is read on a
10 fps grid (+-0.1 s), then confirmed by fx01's own end flag (its fade reaching 0, 832 oracle ticks = 11.87 s after order 3). Not derived.

## Display and timing

* `Tick = inc [0x52888]`, called once per vertical retrace, assumed 70.086 Hz. `update()` runs `ticks elapsed - ticks done` times, then `render()` once. So the animation is a function of the tick count n, not of the
  frame count. The port uses `n = floor((t - T0) * 70.086) + 1` (a model: the original's own n depends on its real speed).
* Seek classes (what the player does when you drag the bar): **pure function of n** (fx00, fx13: compute n, draw), **replay** (every feedback or accumulating scene: fx01, 04, 05, 07, 09, 11, 12, 14, 15, 16 replay from the
  stage start, at most about 1550 ticks, with a cache; fx06 replays only its cheap per-render state and draws once), and **chained** (fx02, fx03, fx08, fx10 share counters that are never reset, so a stage starts from a state replayed through the previous ones).
* Palettes are 6-bit (0..63 per DAC channel); the port shows them as `c*4` (see `WRITEUP-asm.md` section 10 for how they are generated).

---

## fx00 - helicopter (stage 1, orders 0-2)

A grey helicopter flying over snow mountains. This is a **movie**: asset 4 (2,804,544 bytes at DATA.DAT offset 0x2f4db) is **240 RLE frames of 160x80** (`0x2018a`, 12,800 bytes each), a new one every 6.5 ticks.
Render (0x2032b): decode the next frame if the "new frame" flag is set, then a 2x blit at screen rows 20..177 with horizontal and vertical interpolation done in 16-bit registers (`WRITEUP-asm.md` sections 8 and 16), palette = static 6-bit palette (0x46624) times a fade (0x100 = 1.0, +2 per tick).
Frame index (from the port): `min(floor((1 + 2n) / 13), 237)`.
Update: fade += 2; a counter += 2, on reaching 13 subtract 13 and advance the frame.
Exactness: **bit-exact** (1505 oracle frames, 0 differing pixels, 0 palette bytes). Pure function of n, exact seek.

## fx01 - light rays (stage 2, orders 3-5)

Radial streaks from a moving bright centre, masked by a picture (asset 2, a 320x200 two-value mask). Per tick the number of rays is `((sine[s2c] + 0xc00) * fade >> 11) + 1`; each ray's radius follows the 3-instruction LCG
(`rol(x+0x9d,11)^0x9d`, 0x1e606, `WRITEUP-asm.md` section 9). A ray is walked pixel by pixel with a budget (`s30`, +4 per tick up to 0x400, reset at order 4) **while skipping pixels where the mask is non-zero**, and then, if the last tested pixel
was 0, on to the screen edge without restriction. Each pixel is a saturating 4x4 dot (threshold 0xf0), the plane is blurred x0.75 and the palette is three sine gradients times the fade. From order 5 the fade drops by 4 per tick and the stage ends when it
reaches 0 (flag `[0x4ab19]`): this is the only stage whose end is not an S3M threshold, and it fixes fx02's start.
Exactness: **bit-exact** (832 frames). Feedback: replay from the stage start (about 830 ticks).

## fx02 / fx03 / fx08 / fx10 - the moire family (stages 3, 4, 9, 11)

Four stages, one engine (`web/fx/moire.js`): green-teal moire plasma over a picture (fx02: the brain/face pictures; fx03: "ACCEPT NO LIMITATIONS" logo; fx08: star logo in a circle; fx10: the megablast logo with a crosshair).
Mechanism: an **81x51 mesh of (x,y) texture coordinates** in 24.8 fixed point is rebuilt every render from sine-driven counters, over the 256x256 texture of asset 0. The picture is drawn as 80x50 cells of 4x4 pixels, each cell
walking the texture with a linear step between mesh corners (`WRITEUP-asm.md` section 6). The colour of a pixel is `LUT[(background << 8) | warp]` with the 16 KB table of asset 1 (section 5): the table mixes the moire with the background picture.
Palette = the texture's own palette times a fade (0x100 at rest, flashes to 0x200 on the beat; fx08 has no fade at all in its render and keeps the init palette).
Mesh generators: 0x1d770 (fx02), 0x1c7c9 (fx03), 0x1dade (fx08), 0x1ca71 (fx10); the tail 0x1dfe2 is shared. No framebuffer feedback: a frame is a function of the counters.
Exactness: **bit-exact** (1478 / 765 / 765 / 1538 oracle frames). The counters are never reset between the stages, so the port starts each stage from a replayed state; the tick counts of the previous stages (1477, 770, 770) come from
the oracle's own run and depend on its timing, so the start phase is **a fit to that run**, not derived.

## fx04 - light lines (stage 5, orders 0x0b-0x0d)

256 grey light lines on a bright background picture (asset 9, a 7-value picture). Each line has two endpoints from the sine table (angles advanced by +0x9d/+0x1c9 and +0x1d7/+0x303 per ray, wobbled by two more sines `<< 3`);
it is walked to the screen edge with the line walker of `WRITEUP-asm.md` section 15 and stamped with the 12-pixel dot of section 3 (saturation 0x3e). The plane is then blurred x0.75 with the SWAR kernel of section 2 and the picture is added as dwords on the way into VRAM.
The palette is three slowly moving sine ramps (section 10).
Exactness: **bit-exact** (1149 frames). Replay from the stage start.

## fx05 - cube grid (stage 6, orders 0x0e-0x0f)

A red/orange rotating 4x4x4 lattice of points joined by lines (64 vertices, three edge families +1/+4/+16, 3x4x4 edges each), over a picture (asset 8, 4 values). Pure integer 3D: three successive rotations `(a*c - b*s) >> 10`,
perspective `x*128/z + 0xa0` by `idiv`, lines by the fx04-style walker (12-pixel dot, saturation 0x38), blur x0.875 over +-4 pixels / +-4 rows. The beat flash (palette x1.25) is armed by the **row** of the S3M (rows 0, 6, 0x12, 0x1c, 0x2a, 0x32, 0x3e), and
because the "previous row" comparison stores the old value back, every tick on such a row re-arms it.
Exactness: **bit-exact** (762 frames). Replay from the stage start.

## fx06 - vortex (stage 7, orders 0x10-0x13)

The only x87 scene: a grey stone texture (PLASTI3D.PCX, 512x512) seen through a rotating vortex. Per render: a rotation matrix from `fsin`/`fcos` (angles from sums of sines of A = 30 * tick), a **41x26 lattice** of 3D points whose distance is computed by the bit-trick square root
(`WRITEUP-asm.md` section 11), `fpatan` for the angle, texture coordinates `U` (2^17 per turn) and `V = 128 * (rho + g)`, then **40x25 cells of 8x8 pixels** bilinearly warping the texture. No tables are generated at init (it only loads the PCX and shifts the palette `>> 2`); there is no update loop (the tick itself is the clock).
Exactness: **0 differing pixels in 1536 frames**, but not exact by construction: the port uses float32 stores (`Math.fround`) and double arithmetic instead of the 80-bit stack, and JS `Math.sin`/`atan2` instead of the x87 instructions. A tie case would show as a diff; none occurred. The tick at the stage start (6505) is the oracle's.

## fx07 - voronoi wire (stage 8, orders 0x14-0x15)

A green 3D wire graph (20 vertices, 30 edges: each vertex has degree 3, i.e. a dodecahedron) over a background of tiles that flicker. Per render: 32 LCG steps bump byte counters of a 64x20 tile grid, which is drawn as 5x9 patterns selected by `counter & 15`; the 20 vertices go
through three rotations and an `idiv` perspective; the 30 edges are walked by 0x2157c (the line walker with the `|d|-1` quirk, section 15) into a cleared buffer as 3x3 splats of 4; the screen is the 4-neighbour sum plus background plus tiles, as dword adds with real carries.
Exactness: **0 differing pixels on rows 1..198**; rows 0 and 199 are not compared and are drawn black (not verified). The first oracle frame includes fx06's catch-up ticks, modelled by `K0 = 1536` in the player (consistent with the libopenmpt timeline).

## fx09 - flower blob (stage 10, orders 0x18-0x1b)

A white "flower" made of 1024 points. The radius of each point is a sum of 8 sines (phases advancing by +0x14, 0x14, 0x10, 0x400, 0x100, 0x4a0, 0x200, 0x300 per point) plus a slow breathing term; the angle is a spin that grows 4 per point. Each point is a 16x16 saturating splat
(pattern at 0x464ac, shifted `>> 2` at init; threshold 0x3c), then a blur over +-3 pixels / +-3 rows with a `>>2` decay, plus the background picture (asset 18, 3 values). Palette = sine ramps `(sin + 0x4400) * i >> 13`. The update counters do not depend on order or row.
Exactness: **bit-exact** (1533 frames). Replay from the stage start.

## fx11 / fx15 / fx16 - blue ring, blue sphere, green blob (stages 12, 16, 17)

One engine (render 0x2217d), three parameter sets (updates 0x2243d for fx11 and fx16, 0x224e9 for fx15). A **128x128 grid** is displaced by two sums of four sines, rotated twice, projected on a paraboloid and splatted as a 12-byte dot with a **signed** saturation test (`< 0x3c`);
the plane is blurred x0.5 (`shr ebx,1` at 0x22040; the header comment of `engine2217.js` says 0.75, the disassembly says 0.5) into VRAM and the other plane, then swapped. Palette static at 0x4ad24; stage 17 (green) swaps G and B in place.
Cross-stage state is part of the definition: the wave phases and amplitude are **not** reset between stages. Stage 16 starts with stage 12's final phases (1540 ticks), stage 17 keeps stage 16's planes and phases and only resets its steps.
Exactness: **bit-exact** over 1536 / 767 / 1100 oracle frames, with caveats: the fx16 oracle is checked with a K=7 history of stage 16 (a different run from the K=1 fx15 oracle), and stage 17's start state in the player is the oracle's (770 ticks), not derived from the music.

## fx12 - checker tunnel (stage 13, orders 0x24-0x25)

A black-and-white checkerboard tunnel. Asset 5 (128,000 bytes) is a **precomputed table of 320x200 16-bit texture offsets** (one word per screen pixel); asset 6 is the 256x256 texture with its palette; asset 7 the shade table. Each pixel is `tex[(OFF[p] + si) & 0xffff]`
(the wrap-around of `WRITEUP-asm.md` section 4), with `si = (da>>4) + ((de>>4)<<8)` the camera. For the first 200 columns the shaded texel is also written to a second 256x256 buffer (stride 256) which becomes the next frame's texture (feedback), then the buffers swap.
The camera moves with a table of motion words per order (static at 0x47506); the shade level grows +2 per tick up to 0xb0 after the first render; the palette is faded in by +4 per tick.
Exactness: **bit-exact** (765 frames). Replay from the stage start; the checker replays the oracle's per-render orders.

## fx13 - crowd to Dali (stage 14, orders 0x26-0x29)

A crowd animation morphs into a Dali picture. Asset 17 (69,020 bytes) is **7 RLE frames of 160x100** (0x20163, 16,000 bytes each); asset 21 is the 320x350 picture which scrolls by `min(n, 0x4b0) >> 3` rows (0 to 150 of 350). The animation frame is `(n % 14) >> 1`.
Every render rebuilds two 256-entry tables from a sine (`A = (sine + 0x400) >> 3`, `B = 0x100 - A`) and mixes: `pixel = LA[anim] + LB[pic]` (`WRITEUP-asm.md` section 7); the animation is first upscaled 2x with the register-level interpolation of section 8, rows 6..193 only. The palette is static (0x469ec) and never faded.
Exactness: **not fully bit-exact**: 161 differing pixels over 1538 frames (98.4 M pixels), all the same pixel (314,193), in frames where the animation frame is 6. The last output row of 0x20454 reads one source row past the end of the original's 112,000-byte buffer;
the port reads 0 and the original reads something that changes over time (not identified, not guessed). Palette identical. Pure function of n.

## fx14 - bar photo and logo (stage 15, orders 0x2a-0x2d)

A photo of people at a bar (asset 16) blended with the megablast logo (asset 20), disturbed by glowing particles. Per tick four phases advance (+13, +32, +13, +15, all `& 0xfff`). Per render: a shade table, from order 0x2b 2048 particles (positions and speeds from the LCG generator at 0x22736, seed 0x34c297) added as four dwords each (`WRITEUP-asm.md` section 14),
a toroidal 16-bit-pointer blur with `>>3` and mask 0x0f0f0f0f (section 4), four sine wobbles, and a **displacement warp** of the picture source by the gradient of the blurred plane (section 13). Final pixel `LUT[SH[...] << 8 | warp]` with the 16 KB LUT of asset 19. The picture warp reads outside the picture,
so the port keeps 0x5000 bytes of DATA.DAT around asset 16's pixels (`tools/export_fx14.py`). The stage writes rows 8..191 only (0xe600 bytes from 0xa00); the other rows keep fx13's last frame under fx14's palette (green bands in the emulator), and the player draws them black.
Exactness: **bit-exact** on the rows it writes (1538 frames); the real tick count per render and fx13's last render count (1533 in the oracle, because of K=7 batching) are timing dependent. The comment in `fx14.js` saying rows 8..183 is a typo: 0xe600 bytes from row 8 is rows 8..191.

---

## The art: where it lives, how it was decoded

There is **no polygon model, mesh file, font file or sprite sheet** in this demo. The 3D is procedural: fx05 is a 4x4x4 grid generated from index arithmetic, fx07 has a small vertex/edge table in the data segment (20 vertices, 30 edges, exported by `tools/export_fx07.py`), fx06 and the shared engine
generate their surfaces from sines. Text mode and the string "pertti" at the end are the C runtime, not an asset. The 2D art is the 24 assets of `DATA.DAT` plus `PLASTI3D.PCX`.

### Container

`DATA.DAT` (4,010,595 bytes) is a single blob that the program reads whole (open at 0x1e168, read at 0x1e172; the "TITANICS-cruncher" string in the CRT is a leftover, nothing is compressed). **24 offsets** in a table at 0x4ab1d (relocated by the load address in the loop at 0x21dd6)
index into it; an asset's size is the distance to the next offset. `re/extract_data.py` cuts them into `re/assets/NN_offset_size.bin`; `tools/export_*.py` repack what each effect needs into `web/assets/*.bin`. Which stage uses which asset was found from the code references to the table.

### Formats

| format | what it is | decoded by |
|---|---|---|
| **RIX3** (ColoRIX) | header `RIX3`, width, height (u16 each), flag 0xaf, palette at +10 (768 bytes, **6-bit**), then raw 8-bit pixels at +0x30a | `export_moire.py`, `export_fx12.py`, `export_fx14.py` |
| **PCX v5** | RLE (top two bits set = run), 8-bit, a 768-byte 8-bit palette after a 0x0c marker; the demo skips the 0x80 header and decodes until 64,000 bytes | 0x1c768 (moire backgrounds), `export_moire.py`; PLASTI3D by 0x231c4 |
| **raw 8-bit plane** | 64,000 bytes = 320x200, or 16,384 = a 64x256 table, or 128x128 | direct |
| **RLE animation** | frames of 160x80 or 160x100: byte&0xc0 == 0xc0 -> run of (byte&63) x next byte, else a literal, until exactly 12,800 / 16,000 bytes | 0x2018a / 0x20163 |

### Catalogue (previews in `figures/`)

Colour counts are the number of distinct pixel values actually used (measured with `python -I`). "6-bit" palettes are shown multiplied by 4. Preview palettes: RIX3 = its own; PCX = its own 8-bit palette (the moire stages use only the **indices** of the PCXs
and the palette of asset 0, so these previews show the picture, not what the stage shows); static palettes were read from the program's data at the addresses given.

| asset | offset in DATA.DAT | size | format | colours used | used by | preview |
|---|---|---|---|---|---|---|
| 0 | 0x000000 | 66,314 | RIX3 256x256 + palette | 91 | moire texture + palette (fx02/03/08/10) | [a00_rix.png](figures/a00_rix.png) |
| 1 | 0x01030a | 16,384 | raw 64x256 table | 255 | moire colour LUT `[bg<<8 \| warp]` | [a01_table.png](figures/a01_table.png) |
| 2 | 0x01430a | 64,000 | raw 320x200 | 2 | fx01 mask | [a02_index.png](figures/a02_index.png) |
| 3 | 0x023d0a | 47,057 | PCX 320x200 | 26 | fx03 background | [a03_pcx.png](figures/a03_pcx.png) |
| 4 | 0x02f4db | 2,804,544 | 240 RLE frames 160x80 | see below | fx00 movie (static palette at 0x46624) | [a04_fx00_frames.png](figures/a04_fx00_frames.png) |
| 5 | 0x2dc01b | 128,000 | 320x200 u16 offsets | 256 byte values | fx12 per-pixel texture offsets | (not an image) |
| 6 | 0x2fb41b | 66,314 | RIX3 256x256 + palette | 13 | fx12 tunnel texture | [a06_rix.png](figures/a06_rix.png) |
| 7 | 0x30b725 | 16,384 | raw 64x256 table | 137 | fx12 shade table | [a07_table.png](figures/a07_table.png) |
| 8 | 0x30f725 | 64,000 | raw 320x200 | 4 | fx05 background (static palette 0x47f60) | [a08_fx05bg.png](figures/a08_fx05bg.png) |
| 9 | 0x31f125 | 64,000 | raw 320x200 | 7 | fx04 background | [a09_index.png](figures/a09_index.png) |
| 10 | 0x32eb25 | 44,129 | PCX 320x200 | 28 | fx02 background (order 7) | [a10_pcx.png](figures/a10_pcx.png) |
| 11 | 0x339786 | 44,237 | PCX 320x200 | 29 | fx02 background (order 8) | [a11_pcx.png](figures/a11_pcx.png) |
| 12 | 0x344453 | 42,182 | PCX 320x200 | 24 | fx02 background (order 6) | [a12_pcx.png](figures/a12_pcx.png) |
| 13 | 0x34e919 | 26,404 | PCX 320x200 | 38 | fx08 background (star logo) | [a13_pcx.png](figures/a13_pcx.png) |
| 14 | 0x35503d | 36,437 | PCX 320x200 | 14 | fx02 background (order 5) | [a14_pcx.png](figures/a14_pcx.png) |
| 15 | 0x35de92 | 19,930 | PCX 320x200 | 42 | fx10 background | [a15_pcx.png](figures/a15_pcx.png) |
| 16 | 0x362c6c | 64,778 | RIX3 320x200 + palette | 183 | fx14 photo (bar) and its palette | [a16_rix.png](figures/a16_rix.png) |
| 17 | 0x372976 | 69,020 | 7 RLE frames 160x100 | 79 | fx13 animation | [a17_fx13_frames.png](figures/a17_fx13_frames.png) |
| 18 | 0x383712 | 64,000 | raw 320x200 | 3 | fx09 background | [a18_index.png](figures/a18_index.png) |
| 19 | 0x393112 | 16,384 | raw 64x256 table | 213 | fx14 colour LUT | [a19_table.png](figures/a19_table.png) |
| 20 | 0x397112 | 64,000 | raw 320x200 | 33 | fx14 megablast logo | [a20_index.png](figures/a20_index.png) |
| 21 | 0x3a6b12 | 112,000 | raw 320x350 | 16 | fx13 Dali picture (static palette 0x469ec) | [a21_fx13pic.png](figures/a21_fx13pic.png) |
| 22 | 0x3c2092 | 6,097 | PCX 320x200 | 3 | fx07 background | [a22_pcx.png](figures/a22_pcx.png) |
| 23 | 0x3c3863 | 64,000 | raw 320x200 | 19 | **not used by any stage**: only an uncalled routine (0x202ae) references it | [a23_unreached.png](figures/a23_unreached.png) |
| - | `PLASTI3D.PCX` (separate file) | 242,678 | PCX 512x512, 8-bit palette (max 251, the init shifts it `>> 2`) | 63 | fx06 vortex texture | [plasti3d.png](figures/plasti3d.png) |

Notes:

* Asset 4 (the helicopter) holds 240 frames decoded with the static palette at 0x46624; the preview sheet shows frames 0, 40, 80, 120, 160, 237. It was first labelled "unknown stream" in the early notes; the RLE and the frame size were found from the render code. Colour count not recomputed here.
* Assets 17 and 21 together are fx13; the preview of asset 21 uses the static palette at 0x469ec, 6-bit, set once at init.
* The asset-to-stage links come from the export scripts (`tools/export_moire.py`, `export_fx01/04/07/12/14.py`); fx02's backgrounds per order (assets 14, 12, 10, 11 for orders 5..8) are the ones in the `export_moire.py` docstring. Figure file names carry the asset number.
* fx11, fx15, fx16 and the fx05 lattice have no picture at all: their only data are the sine table (static, 0x3705e, 5121 dwords, +-1023, cosine = index + 0x401) and their palette (0x4ad24 for the shared engine).

## What is bit-exact and what is not

| scene | result vs the Unicorn oracle |
|---|---|
| fx00, 01, 04, 05, 09, 11, 12, 15, 16, 14 | 0 differing pixels, 0 palette bytes |
| fx02, 03, 08, 10 | 0 differing pixels, but the chained start counters are a fit to the oracle run |
| fx06 | 0 differing pixels in 1536 frames, exact only empirically (float32/double instead of 80-bit x87) |
| fx07 | 0 differing pixels on rows 1..198; rows 0 and 199 not compared |
| fx13 | 161 pixels differ, all at (314,193) in animation frame 6, cause unresolved |

For every scene the **tick count at a music time is a model** (`n = floor((t - T0) * 70.086) + 1`), not a derivation. The oracle itself is a deterministic Unicorn run on a virtual clock; the real original's frame count at a given music position depends on the machine.

## Known discrepancies in the existing comments

* `web/fx/engine2217.js` says the blur is x0.75; the asm at 0x22040 shifts by 1 (x0.5).
* `web/fx/fx14.js` says the stage writes rows 8..183; 0xe600 bytes from 0xa00 is rows 8..191.
