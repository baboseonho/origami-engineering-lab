import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export interface WaterbombParams {
  /** base square size d */
  d: number;
  /** number of bases per row */
  cols: number;
  rows: number;
}

/**
 * Waterbomb tessellation (6-crease bases, rows offset by d/2).
 * Recipe (Origami Simulator asset, cross-checked with Chen et al., "Rigid
 * origami tubes based on the waterbomb pattern", PMC7171592):
 *   • horizontal lines y = k d : M      • vertical lines x = j d/2 : M
 *   • in row k, bases start at x0 = j d + (k mod 2) d/2 ; both diagonals V
 * Vertex types (both satisfy Kawasaki and Maekawa):
 *   base centre      V45 M90 V135 V225 M270 V315
 *   row-boundary     M0 V45 M90 V135 M180 M270
 * The rectangular sheet is clipped at x ∈ [0, cols·d] (half bases at the ends
 * of offset rows).
 */
export function waterbomb(p: WaterbombParams): OrigamiModel {
  const { d, cols, rows } = p;
  const Wd = cols * d;
  const coords: Vec2[] = [];
  const idOf = new Map<string, number>();
  const V = (x: number, y: number) => {
    const k = `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
    let i = idOf.get(k);
    if (i === undefined) { i = coords.length; coords.push([x, y]); idOf.set(k, i); }
    return i;
  };
  const faces: number[][] = [];
  const assign: Record<string, Assignment> = {};
  const centres: { id: number; row: number; x: number }[] = [];
  for (let k = 0; k < rows; k++) {
    const off = (k % 2) * (d / 2);
    for (let j = -1; j <= cols; j++) {
      const x0 = j * d + off, y0 = k * d;
      const xm = x0 + d / 2, x1 = x0 + d, ym = y0 + d / 2, y1 = y0 + d;
      const tris: [Vec2, Vec2, Vec2][] = [
        [[x0, y0], [xm, y0], [xm, ym]],
        [[xm, y0], [x1, y0], [xm, ym]],
        [[x1, y0], [x1, y1], [xm, ym]],
        [[x1, y1], [xm, y1], [xm, ym]],
        [[xm, y1], [x0, y1], [xm, ym]],
        [[x0, y1], [x0, y0], [xm, ym]],
      ];
      let used = false;
      for (const t of tris) {
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        if (cx < -1e-9 || cx > Wd + 1e-9) continue;
        faces.push(t.map(([x, y]) => V(x, y)));
        used = true;
      }
      if (!used) continue;
      const c = V(xm, ym);
      if (xm > 1e-9 && xm < Wd - 1e-9) centres.push({ id: c, row: k, x: xm });
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) if (idOf.has(`${Math.round(x * 1e6)},${Math.round(y * 1e6)}`)) assign[edgeKey(c, V(x, y))] = 'V';
    }
  }
  // all axis-aligned edges are M (horizontal lines, vertical lines); diagonals already V
  const model = buildModel({
    name: `Waterbomb ${rows}×${cols}`,
    description: 'Waterbomb tessellation (6-crease bases, offset rows)',
    generator: 'waterbomb',
    coords2D: coords,
    faces,
    assignment: (a, b) => {
      const k = edgeKey(a, b);
      if (assign[k]) return assign[k];
      const [x0, y0] = coords[a], [x1, y1] = coords[b];
      if (Math.abs(x0 - x1) < 1e-9 || Math.abs(y0 - y1) < 1e-9) return 'M';
      return 'V';
    },
    params: { d, cols, rows },
  });
  // coarse surface through the base centres (for the effective-curvature estimate)
  const tri: [number, number, number][] = [];
  for (let k = 0; k + 1 < rows; k++) {
    const A = centres.filter((c) => c.row === k).sort((p1, p2) => p1.x - p2.x);
    const B = centres.filter((c) => c.row === k + 1).sort((p1, p2) => p1.x - p2.x);
    let i = 0, j = 0;
    while (i + 1 < A.length || j + 1 < B.length) {
      const advA = j + 1 >= B.length || (i + 1 < A.length && A[i + 1].x <= B[j + 1].x);
      if (advA) { tri.push([A[i].id, A[i + 1].id, B[j].id]); i++; }
      else { tri.push([A[i].id, B[j + 1].id, B[j].id]); j++; }
    }
  }
  model.edu.coarseSurface = { vertices: centres.map((c) => c.id), triangles: tri };
  const mid = centres[Math.floor(centres.length / 2)];
  if (mid) {
    model.edu.highlightVertices = [mid.id];
    model.edu.baseFace = faces.findIndex((f) => f.includes(mid.id));
    const diag = model.edges.find((e) => e.vertices.includes(mid.id) && e.assignment === 'V');
    if (diag) model.edu.defaultDrive = { edge: diag.id, angle: (60 * Math.PI) / 180 };
    let k = 1;
    for (const e of model.edges) if (e.vertices.includes(mid.id)) model.edu.creaseLabels[e.id] = `ρ${k++}`;
  }
  return model;
}

/**
 * Waterbomb base: square with both diagonals and both midlines (degree 8).
 * Origami-Simulator convention: diagonals M (−180°), midlines V (+90°).
 * With 4M/4V Maekawa fails, so this is a 3D (bistable) state, not a flat fold.
 */
export function waterbombBase(size = 1): OrigamiModel {
  const h = size / 2;
  const coords: Vec2[] = [[0, 0]];
  const ring: number[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const r = k % 2 === 0 ? h : h * Math.SQRT2;
    ring.push(coords.length);
    coords.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const faces = ring.map((v, k) => [0, v, ring[(k + 1) % 8]]);
  const assign: Record<string, Assignment> = {};
  const targets: Record<string, number> = {};
  ring.forEach((v, k) => {
    const key = edgeKey(0, v);
    assign[key] = k % 2 === 0 ? 'V' : 'M';
    targets[key] = k % 2 === 0 ? Math.PI / 2 : -Math.PI;
  });
  const model = buildModel({
    name: 'Waterbomb base',
    description: 'Degree-8 waterbomb base (diagonals M, midlines V)',
    generator: 'waterbombBase',
    coords2D: coords,
    faces,
    assignment: assign,
    targets,
    params: { size },
  });
  ring.forEach((v, k) => {
    const e = model.edges.find((ed) => ed.vertices.includes(0) && ed.vertices.includes(v));
    if (e) model.edu.creaseLabels[e.id] = `ρ${k + 1}`;
  });
  model.edu.highlightVertices = [0];
  const first = model.edges.find((e) => e.vertices.includes(0) && e.assignment === 'M');
  if (first) model.edu.defaultDrive = { edge: first.id, angle: (-90 * Math.PI) / 180 };
  // symmetric folding links: all diagonals equal, all midlines equal
  const diag = model.edges.filter((e) => e.vertices.includes(0) && e.assignment === 'M');
  const midl = model.edges.filter((e) => e.vertices.includes(0) && e.assignment === 'V');
  model.edu.symmetryLinks = [
    ...diag.slice(1).map((e) => ({ a: e.id, b: diag[0].id, ratio: 1 })),
    ...midl.slice(1).map((e) => ({ a: e.id, b: midl[0].id, ratio: 1 })),
  ];
  return model;
}
