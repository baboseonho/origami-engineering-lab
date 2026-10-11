import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export interface MiuraParams {
  /** number of panel rows (along y) */
  rows: number;
  /** number of panel columns (along x) */
  cols: number;
  /** horizontal panel edge length a */
  a: number;
  /** slanted panel edge length b */
  b: number;
  /** acute parallelogram angle α (radians) */
  alpha: number;
}

/**
 * Miura-ori crease pattern (parallelogram panels).
 *
 * Vertex (i, j), i = 0..rows, j = 0..cols:
 *     x = j·a + (i odd ? b cos α : 0),   y = i · b sin α
 * Straight lines are i = const (horizontal); zig-zag lines are j = const.
 *
 * M/V: each zig-zag line has a uniform assignment alternating between
 * neighbouring zig-zag lines; along the straight lines the assignment
 * alternates segment by segment, giving 3:1 (Maekawa) at every interior
 * vertex. Verified in tests by the crimp/big-little-big checker.
 *
 * Source: K. Miura (1985), "Method of packaging and deployment of large
 * membranes in space"; Schenk & Guest, PNAS 110 (2013) 3276.
 */
export function miura(p: MiuraParams): OrigamiModel {
  const { rows, cols, a, b, alpha } = p;
  const id = (i: number, j: number) => i * (cols + 1) + j;
  const coords: Vec2[] = [];
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j <= cols; j++) coords.push([j * a + (i % 2 === 1 ? b * Math.cos(alpha) : 0), i * b * Math.sin(alpha)]);
  const faces: number[][] = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) faces.push([id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i + 1, j)]);
  const assign: Record<string, Assignment> = {};
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j < cols; j++) assign[edgeKey(id(i, j), id(i, j + 1))] = (i + j) % 2 === 0 ? 'M' : 'V';
  for (let i = 0; i < rows; i++)
    for (let j = 0; j <= cols; j++) assign[edgeKey(id(i, j), id(i + 1, j))] = j % 2 === 0 ? 'V' : 'M';

  const ci = Math.floor(rows / 2), cj = Math.floor(cols / 2);
  const model = buildModel({
    name: `Miura-ori ${rows}×${cols}`,
    description: 'Parallelogram Miura-ori tessellation (rigid-foldable, 1 DoF)',
    generator: 'miura',
    coords2D: coords,
    faces,
    assignment: assign,
    params: { rows, cols, a, b, alphaDeg: (alpha * 180) / Math.PI },
  });
  // label the four creases around a central interior vertex
  const v = id(Math.max(1, ci), Math.max(1, cj));
  const around = model.edges.filter((e) => e.vertices.includes(v) && e.faces[1] >= 0);
  const ang = (eid: number) => {
    const e = model.edges[eid];
    const o = e.vertices[0] === v ? e.vertices[1] : e.vertices[0];
    const [x0, y0] = coords[v], [x1, y1] = coords[o];
    let t = Math.atan2(y1 - y0, x1 - x0);
    if (t < -1e-9) t += 2 * Math.PI;
    return t;
  };
  around.sort((e1, e2) => ang(e1.id) - ang(e2.id));
  around.forEach((e, k) => (model.edu.creaseLabels[e.id] = `ρ${k + 1}`));
  model.edu.highlightVertices = [v];
  // base facet: one adjacent to the labelled vertex
  model.edu.baseFace = faces.findIndex((f) => f.includes(v));
  // drive a straight-line (minor) crease by default
  const minor = around.find((e) => Math.abs(coords[e.vertices[0]][1] - coords[e.vertices[1]][1]) < 1e-9);
  if (minor) model.edu.defaultDrive = { edge: minor.id, angle: ((minor.assignment === 'M' ? -70 : 70) * Math.PI) / 180 };
  model.edu.groups = {
    left: Array.from({ length: rows + 1 }, (_, i) => id(i, 0)),
    right: Array.from({ length: rows + 1 }, (_, i) => id(i, cols)),
    bottom: Array.from({ length: cols + 1 }, (_, j) => id(0, j)),
    top: Array.from({ length: cols + 1 }, (_, j) => id(rows, j)),
  };
  return model;
}
