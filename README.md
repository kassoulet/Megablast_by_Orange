# megademo - "Megablast" (Orange, Dec 1996)
Port status: **not started**; phase 1 (reverse-engineering harness) done. Own `.git` in this folder; original files untouched.
Files: DEMO.EXE (PMODE/W 1.20 + Watcom C + MIDAS-like lib), DATA.DAT (4 MB blob, 24 assets by offset table), MUSTAKS.S3M (music, 285 s used), PLASTI3D.PCX (texture).
What exists: the unpacked program runs under Unicorn (`re/harness.py`, `re/golden.py`) through all 17 effect stages up to the normal exit at ~285 s, with a virtual clock and music position from the S3M; `re/golden/` has a 320x200 frame every 2 s; scenes and timings are in `re/NOTES.md`. VGA mode 13h 320x200 (show 4:3), player needs pause + seek.
Bit-exact vs approximated: nothing ported yet; golden frames are the original code's own output on a fake clock (10 fps grid, music position derived by my own S3M walker, not yet cross-checked with libopenmpt).
See `re/NOTES.md`.
