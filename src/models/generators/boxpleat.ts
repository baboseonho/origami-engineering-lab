import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export type BoxpleatPreset = 'tray' | 'pleat' | 'grid';

export interface BoxpleatParams {
  /** grid cells per side */
  n: number;
  preset: BoxpleatPreset;
  /** side of one grid cell (default 1) */
  size?: number;
}

/**
 * Box-pleating framework: a square grid with both diagonals in every cell
 * (only 0°, 45°, 90° directions). A design is a SUBSET of this framework
 * given a mountain/valley assignment; unused grid lines stay flat ('F').
 * One framework → many target shapes: the presets below select different
 * subsets of the same grid.
 *
 *  grid  : nothing assigned (framework only)
 *  pleat : alternating M/V grid lines in x (accordion, 0°/90° only)
 *  tray  : square base, walls folded up 90°, 45° corner gussets
 *
 * Source: R. Lang, "Origami Design Secrets" (2nd ed., 2011), box pleating;
 * E. Demaine et al., "Box pleating is hard" (2016).
 */
export function boxpleat(p: BoxpleatParams): OrigamiModel {
  const { n } = p;
  const sz = p.size ?? 1;
  const coords: Vec2[] = [];
  const g = (i: number, j: number) => i * (n + 1) + j; // grid point (x=j, y=i)
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) coords.push([j * sz, i * sz]);
  const ctr = (i: number, j: number) => (n + 1) * (n + 1) + i * n + j; // cell centre
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) coords.push([(j + 0.5) * sz, (i + 0.5) * sz]);
  const faces: number[][] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const c = ctr(i, j), a = g(i, j), b = g(i, j + 1), cc = g(i + 1, j + 1), d = g(i + 1, j);
      faces.push([a, b, c], [b, cc, c], [cc, d, c], [d, a, c]);
    }
  const assign: Record<string, Assignment> = {};
  const targets: Record<string, number> = {};
  const set = (a: number, b: number, x: Assignment, t: number) => { assign[edgeKey(a, b)] = x; targets[edgeKey(a, b)] = t; };
  if (p.preset === 'pleat') {
    for (let j = 1; j < n; j++) for (let i = 0; i < n; i++) set(g(i, j), g(i + 1, j), j % 2 ? 'V' : 'M', (j % 2 ? 1 : -1) * Math.PI * 0.9);
  } else if (p.preset === 'tray') {
    // base = [1, n-1]^2, walls of width 1, corner cells fold as 45° gussets
    const lo = 1, hi = n - 1;
    for (let k = lo; k < hi; k++) {
      set(g(lo, k), g(lo, k + 1), 'V', Math.PI / 2); // bottom base edge (y = lo)
      set(g(hi, k), g(hi, k + 1), 'V', Math.PI / 2); // top base edge
      set(g(k, lo), g(k + 1, lo), 'V', Math.PI / 2); // left base edge (x = lo)
      set(g(k, hi), g(k + 1, hi), 'V', Math.PI / 2); // right base edge
    }
    const corners: [number, number, number, number][] = [
      [0, 0, lo, lo], [0, hi, lo, hi], [hi, 0, hi, lo], [hi, hi, hi, hi],
    ];
    for (const [ci, cj, vi, vj] of corners) {
      const c = ctr(ci, cj);
      const inner = g(vi, vj);
      const outer = g(ci + (vi === ci ? 1 : 0), cj + (vj === cj ? 1 : 0));
      set(inner, c, 'M', -Math.PI);
      set(c, outer, 'M', -Math.PI);
      // corner-cell edges shared with the walls
      const sideA = vi === lo ? g(ci, vj) : g(ci + 1, vj);
      const sideB = vj === lo ? g(vi, cj) : g(vi, cj + 1);
      set(inner, sideA, 'V', Math.PI / 2);
      set(inner, sideB, 'V', Math.PI / 2);
    }
  }
  const model = buildModel({
    name: `Box pleat ${n}×${n} (${p.preset})`,
    description: 'Box-pleating grid framework with a selected design',
    generator: 'boxpleat',
    coords2D: coords,
    faces,
    assignment: (a, b) => assign[edgeKey(a, b)] ?? 'F',
    targets,
    params: { n, preset: p.preset, size: sz },
  });
  model.edu.baseFace = faces.findIndex((f) => f.includes(ctr(Math.floor(n / 2), Math.floor(n / 2))));
  const d = model.edges.find((e) => e.assignment === 'V');
  if (d) model.edu.defaultDrive = { edge: d.id, angle: Math.PI / 3 };
  return model;
}
