# megademo - "Megablast" (Orange, Dec 1996)
Port status: **started, 1 of 17 effects ported** (fx13 "crowd - Dali"); the other 16 show a placeholder in the player. Own `.git` in this folder (not used for commits); originals untouched.
Files: DEMO.EXE (PMODE/W 1.20 + Watcom C + MIDAS-like lib), DATA.DAT (4 MB blob, 24 assets by offset table), MUSTAKS.S3M (music, 285 s used), PLASTI3D.PCX (texture).
Run the player: `cd web && python3 -m http.server 8000` (shell copied from `../stv/web`: pause, seek, effect list, 4:3). Test: `node tools/uitest.mjs` (headless Chrome: play/pause/seek, ported effect renders, seek determinism; passes).
## What is bit-exact vs not
- **Timeline**: S3M order/row -> seconds from libopenmpt (`tools/mk_timeline_openmpt.py`); the own S3M walker that drove the Unicorn clock agrees with it on all 3435 rows with max 0.34 s difference (0.1 %). Stage start rows come from the 10 fps golden run: exact (row 0 of the order) for all but fx02->fx03 (5,12), only +-0.1 s.
- **fx13 (crowd - Dali, stage 14)**: ported from the disassembly (`web/fx/fx13.js`), diffed against a per-frame oracle of the original under Unicorn (`re/fx_oracle.py`, `tools/fx13check.mjs`): 1538 frames, palette identical, **161 differing pixels, all the same pixel (314,193), in frames with animation frame 6**: the original reads past the end of its own frame buffer there (uninitialised/dynamic memory), my port reads 0. Not fully bit-exact, cause not resolved (see `re/NOTES.md`). Seek: pure function of the tick count, exact. The tick count from music time (n = floor((t-t_start)*70.086)+1) is a model: the original's own count depends on real timing.
- Other 16 stages: only identified visually (`re/NOTES.md` table), update/render function addresses known, not ported. Helicopter (asset 4, 2.8 MB) and assets 5 are still undecoded.
- Golden frames `re/golden/` (K=7, 10 fps) are the original code's own output on a fake clock.
See `re/NOTES.md`.
