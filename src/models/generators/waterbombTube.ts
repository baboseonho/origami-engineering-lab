import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2, Vec3 } from '../../core/geometry/vectors';

/** Energy fold target |ρ| of every crease (see waterbombTube). */
export const TUBE_TARGET = (120 * Math.PI) / 180;

export interface WaterbombTubeParams {
  /** bases (units) around the circumference */
  n: number;
  /** rows of bases along the axis */
  m: number;
  /** side d of one square base (the unit cell is d × d) */
  d: number;
}

/**
 * Waterbomb tube ("magic ball" family): the waterbomb tessellation of
 * waterbomb.ts (6-crease bases d × d, rows offset by d/2; horizontals and
 * verticals M, diagonals V) on a sheet n·d wide and m·d tall whose left and
 * right edges are joined, so the pattern is periodic around the tube.
 *
 * Reference (as-built) state: the sheet rolled into a prism over a regular
 * 2n-gon. Every vertex lies on one of the 2n meridians x = j·d/2, so every
 * triangle is planar and every edge keeps its flat length EXACTLY: an
 * isometric folded state with the 2n meridian creases (M) folded by the
 * polygon's exterior angle, ρ = −π/n, and every other crease at 0.
 *
 *     2n-gon side  d/2  →  R₀ = (d/2) / (2 sin(π/(2n)))       (exact)
 *     axial length L₀ = m·d                                    (exact)
 *
 * The tube is closed, so the rigid solver adds global loop-closure
 * constraints (see constraints.ts). Rotating by one unit (x → x + d) is a
 * symmetry of the pattern and of the reference, so the optional symmetry
 * links tie each crease to its images in the other n − 1 units (ratio 1).
 *
 * Source: crease pattern as waterbomb.ts (Chen et al., "Rigid origami tubes
 * based on the waterbomb pattern", PMC7171592); tube geometry: Y. Chen, H. Feng,
 * J. Ma, R. Peng, Z. You, "Symmetric waterbomb origami", Proc. R. Soc. A 472
 * (2016) 20150846.
 */
export function waterbombTube(p: WaterbombTubeParams): OrigamiModel {
  const n = Math.max(3, Math.round(p.n));
  const m = Math.max(1, Math.round(p.m));
  const { d } = p;
  const N2 = 2 * n;
  const R0 = d / 2 / (2 * Math.sin(Math.PI / N2));
  const coords: Vec2[] = [];
  const ref: Vec3[] = [];
  const onCyl = (i: number, z: number): Vec3 => {
    const t = (i * Math.PI) / n;
    return [R0 * Math.cos(t), R0 * Math.sin(t), z];
  };
  const ring = (k: number, i: number) => k * N2 + (((i % N2) + N2) % N2);
  for (let k = 0; k <= m; k++)
    for (let i = 0; i < N2; i++) { coords.push([(i * d) / 2, k * d]); ref.push(onCyl(i, k * d)); }
  const centre = (k: number, j: number) => (m + 1) * N2 + k * n + j;
  const faces: number[][] = [];
  const assign: Record<string, Assignment> = {};
  for (let k = 0; k < m; k++)
    for (let j = 0; j < n; j++) {
      const i0 = 2 * j + (k % 2); // ring index of the base's left edge
      coords.push([(i0 + 1) * (d / 2), k * d + d / 2]);
      ref.push(onCyl(i0 + 1, k * d + d / 2));
      const c = centre(k, j);
      const b0 = ring(k, i0), bm = ring(k, i0 + 1), b1 = ring(k, i0 + 2);
      const t0 = ring(k + 1, i0), tm = ring(k + 1, i0 + 1), t1 = ring(k + 1, i0 + 2);
      // counter-clockwise in the pattern (x around, y up) = counter-clockwise seen from outside
      faces.push([b0, bm, c], [bm, b1, c], [b1, t1, c], [t1, tm, c], [tm, t0, c], [t0, b0, c]);
      for (const v of [b0, b1, t0, t1]) assign[edgeKey(c, v)] = 'V';
      assign[edgeKey(c, bm)] = 'M';
      assign[edgeKey(c, tm)] = 'M';
    }
  // all remaining interior edges lie on ring lines or meridians: M
  const asg = (a: number, b: number): Assignment => assign[edgeKey(a, b)] ?? 'M';
  // Energy targets ("fold progress 1"): every crease at ±TUBE_TARGET by its assignment. Not ±180°:
  // in the bar-and-hinge model the base centres reach the axis near ±140° (n = 6..8) and the facets
  // then collide, so a fully flat-folded tube is not a physical end state (checked in tests).
  const targets: Record<string, number> = {};
  for (const f of faces) for (let q = 0; q < 3; q++) {
    const a = f[q], b = f[(q + 1) % 3];
    targets[edgeKey(a, b)] = (asg(a, b) === 'M' ? -1 : 1) * TUBE_TARGET;
  }
  const model = buildModel({
    name: `Waterbomb tube ${n}×${m}`,
    description: 'Waterbomb tessellation closed into a tube (rolled 2n-gon reference)',
    generator: 'waterbombTube',
    coords2D: coords,
    ref3D: ref,
    faces,
    assignment: asg,
    targets,
    params: { n, m, d },
  });
  model.edu.layout2D = { periodX: n * d };
  const rings = Array.from({ length: m + 1 }, (_, k) => Array.from({ length: N2 }, (_, i) => ring(k, i)));
  // end rings are deliberately NOT named bottom/top: the app clamps a 'bottom' group in the
  // energy solver, which would pin the tube's radius at one end and fake strain into the fold
  model.edu.groups = {
    endA: rings[0],
    endB: rings[m],
    centres: Array.from({ length: m * n }, (_, q) => (m + 1) * N2 + q),
    ...Object.fromEntries(rings.map((r, k) => [`ring${k}`, r])),
  };
  const midRow = Math.floor((m - 1) / 2);
  const c = centre(midRow, 0);
  model.edu.highlightVertices = [c];
  model.edu.baseFace = faces.findIndex((f) => f.includes(c));
  const diag = model.edges.find((e) => e.vertices.includes(c) && e.assignment === 'V')!;
  model.edu.defaultDrive = { edge: diag.id, angle: (60 * Math.PI) / 180 };
  let lab = 1;
  for (const e of model.edges) if (e.vertices.includes(c)) model.edu.creaseLabels[e.id] = `ρ${lab++}`;
  // rotational symmetry links: crease ↦ its image one unit around (x → x + d), ratio 1
  const shift = (v: number) => (v < (m + 1) * N2 ? v - (v % N2) + ((v % N2) + 2) % N2 : (m + 1) * N2 + Math.floor((v - (m + 1) * N2) / n) * n + (((v - (m + 1) * N2) % n) + 1) % n);
  const byKey = new Map(model.edges.map((e) => [edgeKey(e.vertices[0], e.vertices[1]), e.id]));
  const links: { a: number; b: number; ratio: number }[] = [];
  for (const e of model.edges) {
    if (e.faces[1] < 0) continue;
    // link the images in units 1..n−1 to the edge in unit 0 (orbit representative: smallest id)
    let [a, b] = e.vertices;
    const orbit = [e.id];
    for (let s = 1; s < n; s++) { a = shift(a); b = shift(b); orbit.push(byKey.get(edgeKey(a, b))!); }
    if (Math.min(...orbit) !== e.id) continue;
    for (const o of orbit.slice(1)) links.push({ a: o, b: e.id, ratio: 1 });
  }
  model.edu.symmetryLinks = links;
  return model;
}

export interface WaterbombTubeMetrics {
  /** mean distance of the ring vertices from the tube axis, per ring (bottom → top) */
  ringRadius: number[];
  /** mean radius over all ring vertices */
  R: number;
  /** mean distance of the base centres from the axis */
  Rcentre: number;
  /** distance between the bottom and top ring centroids */
  L: number;
  /** closed forms; valid exactly in the as-built (rolled, unfolded) state only */
  formula: { R0: number; L0: number; note: string };
}

/**
 * Measured vs formula geometry of a waterbomb tube for positions x (xyz
 * interleaved). The axis is the line through the bottom and top ring
 * centroids. Closed forms (exact in the reference state, where every vertex is
 * on a regular 2n-gon prism):
 *     R₀ = d / (4 sin(π/(2n)))      L₀ = m·d
 * Once the bases fold, the ring vertices leave that prism (radii of corners,
 * mid-points and centres differ and the rows shorten), and no closed form is
 * claimed: R and L are then measured. Note R₀ ≠ d / (2 sin(π/n)): the unit
 * width d spans TWO polygon sides of length d/2, not one chord.
 */
export function waterbombTubeMetrics(model: OrigamiModel, x: Float64Array): WaterbombTubeMetrics {
  const { n, m, d } = model.params as { n: number; m: number; d: number };
  const g = model.edu.groups!;
  const P = (v: number): Vec3 => [x[3 * v], x[3 * v + 1], x[3 * v + 2]];
  const centroid = (vs: number[]): Vec3 => {
    const s: Vec3 = [0, 0, 0];
    for (const v of vs) { const q = P(v); s[0] += q[0]; s[1] += q[1]; s[2] += q[2]; }
    return [s[0] / vs.length, s[1] / vs.length, s[2] / vs.length];
  };
  const c0 = centroid(g.endA), c1 = centroid(g.endB);
  const ax: Vec3 = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]];
  const L = Math.hypot(ax[0], ax[1], ax[2]);
  const u: Vec3 = L > 1e-12 ? [ax[0] / L, ax[1] / L, ax[2] / L] : [0, 0, 1];
  const radial = (v: number) => {
    const q = P(v);
    const w: Vec3 = [q[0] - c0[0], q[1] - c0[1], q[2] - c0[2]];
    const t = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
    return Math.hypot(w[0] - t * u[0], w[1] - t * u[1], w[2] - t * u[2]);
  };
  const mean = (a: number[]) => a.reduce((s, y) => s + y, 0) / a.length;
  const ringRadius = Array.from({ length: m + 1 }, (_, k) => mean(g[`ring${k}`].map(radial)));
  return {
    ringRadius,
    R: mean(ringRadius),
    Rcentre: mean(g.centres.map(radial)),
    L,
    formula: {
      R0: d / (4 * Math.sin(Math.PI / (2 * n))),
      L0: m * d,
      note: 'R0 = d / (4 sin(π/(2n))) and L0 = m·d hold exactly in the as-built (rolled 2n-gon) state; folded values are measured',
    },
  };
}
