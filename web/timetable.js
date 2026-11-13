// Pure helpers (no DOM): effect timetable + 4:3 display sizing.
import {at,ROWS} from './fx/timeline.js';
export const DUR = ROWS.find(r => r[0] === 0x34)[3];   // the demo leaves its main loop when S3M order 0x34 starts (then text mode, "pertti")
// stage start = S3M (order,row) at which the previous stage's loop ended, from the Unicorn run (re/NOTES.md). Stage 2 (light rays) starts at the first row after the ORDER 5 flag was set by its update (row seen on the 10 fps golden grid: +-0.1 s).
export const FX = [
  [0, 0, 'helicopter'], [3, 0, 'light rays'], [5, 12, 'moire plasma'], [9, 0, 'moire + logo'], [11, 0, 'light lines'], [14, 0, 'cube grid'], [16, 0, 'vortex'],
  [20, 0, 'voronoi wire'], [22, 0, 'star logo'], [24, 0, 'flower blob'], [28, 0, 'megablast logo'], [32, 0, 'blue ring'], [36, 0, 'checker tunnel'],
  [38, 0, 'crowd - Dali'], [42, 0, 'bar photo'], [46, 0, 'blue sphere'], [48, 0, 'green blob'],
].map(([o, r, name], i, a) => ({ i, t0: at(o, r), t1: i + 1 < a.length ? at(a[i + 1][0], a[i + 1][1]) : DUR, name }));
export const fxAt = t => { let k = 0; for (const e of FX) if (t >= e.t0) k = e.i; return k; };
export const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
// Display size in CSS px for a 320x200 source shown at 4:3: integer multiple of 320 device px when >=1, else fit.
export function displaySize(availW, availH, dpr = 1) {
  const fitW = Math.min(availW, availH * 4 / 3) * dpr, k = Math.floor(fitW / 320);
  const w = (k >= 1 ? 320 * k : fitW) / dpr;
  return { w, h: w * 3 / 4 };
}
