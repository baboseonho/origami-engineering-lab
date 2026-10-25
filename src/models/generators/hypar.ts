import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export type HyparVariant = 'classic' | 'triangulated';

export interface HyparParams {
  /** number of concentric square creases (the paper edge is the next square out) */
  rings: number;
  /** half side of the square sheet */
  L: number;
  /**
   * 'classic': concentric squares + both full diagonals (quad trapezoids).
   * 'triangulated': Demaine et al.'s "alternating asymmetric triangulation"
   * (their Fig. 4b): one diagonal per trapezoid, alternating ring by ring, and
   * the central square split by ONE diagonal into two triangles.
   */
  variant: HyparVariant;
}

const DEG = Math.PI / 180;
/** Energy targets used as "fold progress 1" (see the comment in hypar()). */
export const HYPAR_TARGET = { square: 100 * DEG, diagonal: 100 * DEG };

/**
 * Pleated hyperbolic paraboloid ("hypar", Bauhaus / J. Albers, 1927–28).
 *
 * Source for the crease pattern and its assignment:
 *   E. D. Demaine, M. L. Demaine, V. Hart, G. N. Price, T. Tachi,
 *   "(Non)existence of pleated folds: how paper folds between creases",
 *   Graphs and Combinatorics 27 (2011) 377–397 (arXiv:0906.4747), Fig. 1(a),
 *   Lemma 17 and the proof of Theorem 18.
 *
 * Squares k = 1..rings at half side r_k = k·L/(rings+1) alternate V, M, V, …
 * (square 1 = innermost). The diagonals are cut by the squares into segments.
 * Do the diagonal segments alternate? YES. At a square corner (sectors 45°,
 * 45°, 135°, 135° between square edge, inner diagonal, square edge, outer
 * diagonal) Lemma 17 (and, for the flat case, Maekawa + big–little–big)
 * forces the INNER diagonal to be the unique crease whose sign differs from
 * the other three. Hence the diagonal segment in ring j (between squares j
 * and j+1) has the sign of square j, all four diagonal segments of a ring
 * agree, and the sign alternates from ring to ring. The four central
 * segments (inside square 1) are opposite to square 1, so all four agree:
 * the centre vertex is all-valley / all-mountain.
 *
 * What this pattern can and cannot do (all checked in tests):
 *  • Every square corner is locally flat-foldable (Kawasaki + Maekawa + BLB).
 *  • The centre vertex (4 equal creases, 90° sectors) violates Maekawa, so the
 *    sheet as a whole is NOT flat-foldable, and by Lemma 16 it has no rigid
 *    folding at the centre either. Demaine et al. prove (Thm 18) that the
 *    classic hypar does not fold with exactly these creases at all: the
 *    trapezoids MUST bend. That is why it is an Energy-solver model: the
 *    bar-and-hinge triangulation of every trapezoid (a facet hinge, F) lets
 *    the facets bend, and folding all creases partially yields a saddle.
 *  • The 'triangulated' variant adds one crease per trapezoid (assignment U:
 *    its sign is decided by the folding, not prescribed) and keeps only one
 *    central diagonal. Demaine et al. (Thm 19) show it has a proper folding
 *    uniquely determined by the central fold angle: a 1-DoF rigid mechanism.
 *
 * Fold targets: because ±180° on every crease is NOT a valid folded state
 * (centre vertex; Thm 18), the energy targets (defaultTarget, which the
 * whole-pattern fold uses as "fold progress 1") are a PARTIAL fold,
 * |ρ| = HYPAR_TARGET on the square and original diagonal creases, so that
 * progress 1 means "every crease at its target", not "flat". The bar-and-hinge
 * equilibrium then trades crease error against facet bending; it does not
 * reach the targets exactly, and no referenceState is claimed.
 */
export function hypar(p: HyparParams): OrigamiModel {
  const R = Math.max(1, Math.round(p.rings));
  const { L } = p;
  const tri = p.variant === 'triangulated';
  const coords: Vec2[] = [];
  // corner c of square k (k = 1..R+1, k = R+1 is the paper edge); c = 0..3 at 45°, 135°, 225°, 315°
  const Q: number[][] = [[]];
  const dirs: Vec2[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  let O = -1;
  if (!tri) { O = 0; coords.push([0, 0]); }
  for (let k = 1; k <= R + 1; k++) {
    const r = (k * L) / (R + 1);
    Q.push(dirs.map(([x, y]) => { coords.push([r * x, r * y]); return coords.length - 1; }));
  }
  const faces: number[][] = [];
  if (tri) {
    faces.push([Q[1][0], Q[1][1], Q[1][2]], [Q[1][2], Q[1][3], Q[1][0]]);
  } else {
    for (let c = 0; c < 4; c++) faces.push([O, Q[1][c], Q[1][(c + 1) % 4]]);
  }
  const extra = new Set<string>();
  /** classic: the facet-hinge diagonal of each trapezoid (the same alternating layout) */
  const quadSplit: [number, number][] = [];
  for (let j = 1; j <= R; j++) {
    for (let c = 0; c < 4; c++) {
      const c1 = (c + 1) % 4;
      const P0 = Q[j][c], P1 = Q[j][c1], Q0 = Q[j + 1][c], Q1 = Q[j + 1][c1];
      // asymmetric triangulation: outer corners of one parity connect to the inner corners of the
      // other; the parity flips from ring to ring ("alternating asymmetric", Demaine et al. Fig. 4b)
      const outerEven = j % 2 === 1;
      const split: [number, number] = (c % 2 === 0) === outerEven ? [Q0, P1] : [Q1, P0];
      if (!tri) { faces.push([P0, Q0, Q1, P1]); quadSplit.push(split); continue; }
      if (split[0] === Q0) faces.push([P0, Q0, P1], [P1, Q0, Q1]);
      else faces.push([P0, Q0, Q1], [P0, Q1, P1]);
      extra.add(edgeKey(split[0], split[1]));
    }
  }
  const sq = (k: number): Assignment => (k % 2 === 1 ? 'V' : 'M');
  const opp = (a: Assignment): Assignment => (a === 'M' ? 'V' : 'M');
  const assign: Record<string, Assignment> = {};
  const targets: Record<string, number> = {};
  const set = (a: number, b: number, s: Assignment, t: number) => {
    assign[edgeKey(a, b)] = s;
    targets[edgeKey(a, b)] = (s === 'M' ? -1 : 1) * t;
  };
  for (let k = 1; k <= R; k++) for (let c = 0; c < 4; c++) set(Q[k][c], Q[k][(c + 1) % 4], sq(k), HYPAR_TARGET.square);
  for (let j = 1; j <= R; j++) for (let c = 0; c < 4; c++) set(Q[j][c], Q[j + 1][c], sq(j), HYPAR_TARGET.diagonal);
  if (tri) set(Q[1][0], Q[1][2], opp(sq(1)), HYPAR_TARGET.diagonal);
  else for (let c = 0; c < 4; c++) set(O, Q[1][c], opp(sq(1)), HYPAR_TARGET.diagonal);
  for (const k of extra) { assign[k] = 'U'; targets[k] = 0; }

  const model = buildModel({
    name: tri ? `Triangulated hypar (${R} rings)` : `Hypar (${R} rings)`,
    description: tri
      ? 'Hyperbolic paraboloid with one added crease per trapezoid: a 1-DoF rigid mechanism (Demaine et al. 2011)'
      : 'Pleated hyperbolic paraboloid: concentric squares + diagonals; not rigid-foldable, the facets must bend',
    generator: 'hypar',
    coords2D: coords,
    faces,
    assignment: assign,
    targets,
    params: { rings: R, L, variant: p.variant },
  });
  // Classic: bar-and-hinge triangulation of each trapezoid along the same alternating diagonals
  // (instead of the arbitrary ear-clip choice), so facet bending can follow the foldable layout.
  if (!tri) {
    let qi = 0;
    for (const f of model.faces) {
      if (f.vertices.length !== 4) continue;
      const [u, w] = quadSplit[qi++];
      const vs = f.vertices, i = vs.indexOf(u), j = vs.indexOf(w);
      const arc = (a: number, b: number) => { const out: number[] = []; for (let k = a; ; k = (k + 1) % 4) { out.push(vs[k]); if (k === b) break; } return out as [number, number, number]; };
      f.triangles = [arc(i, j), arc(j, i)];
    }
  }
  const find = (a: number, b: number) => model.edges.find((e) => edgeKey(e.vertices[0], e.vertices[1]) === edgeKey(a, b))!;
  // base: a central triangle. Drive: triangulated → an innermost-square crease (the solver leaves the
  // singular flat state cleanly from it and follows the 1-DoF branch to 170°; tested). Classic → a
  // central diagonal, which locks at once (no rigid motion exists).
  model.edu.baseFace = 0;
  const drive = tri ? find(Q[1][0], Q[1][1]) : find(O, Q[1][0]);
  model.edu.defaultDrive = { edge: drive.id, angle: (drive.assignment === 'M' ? -1 : 1) * 60 * DEG };
  // vertex inspector: a square-1 corner (locally flat-foldable) and, in the classic pattern, the centre (fails Maekawa)
  const v1 = Q[1][0];
  model.edu.highlightVertices = tri ? [v1, Q[2][0]] : [v1, O];
  // label the creases at v1, counter-clockwise from the outer diagonal
  const around = model.edges.filter((e) => e.vertices.includes(v1) && e.faces[1] >= 0 && e.assignment !== 'U');
  const ang = (eid: number) => {
    const e = model.edges[eid];
    const o = e.vertices[0] === v1 ? e.vertices[1] : e.vertices[0];
    let t = Math.atan2(coords[o][1] - coords[v1][1], coords[o][0] - coords[v1][0]) - Math.PI / 4;
    while (t < -1e-9) t += 2 * Math.PI;
    return t;
  };
  // no ρ labels: the centre creases are too short for labels to stay readable
  void around; void ang;
  // coarse surface through the square corners (and centre): its angle defects estimate the
  // effective Gaussian curvature of the folded sheet
  const cv: number[] = [], ct: [number, number, number][] = [];
  if (!tri) { cv.push(O); for (let c = 0; c < 4; c++) ct.push([O, Q[1][c], Q[1][(c + 1) % 4]]); }
  else ct.push([Q[1][0], Q[1][1], Q[1][2]], [Q[1][2], Q[1][3], Q[1][0]]);
  for (let k = 1; k <= R + 1; k++) cv.push(...Q[k]);
  for (let j = 1; j <= R; j++)
    for (let c = 0; c < 4; c++) {
      const c1 = (c + 1) % 4;
      ct.push([Q[j][c], Q[j + 1][c], Q[j + 1][c1]], [Q[j][c], Q[j + 1][c1], Q[j][c1]]);
    }
  model.edu.coarseSurface = { vertices: cv, triangles: ct };
  if (tri) model.edu.symmetryLinks = symmetryLinksD2(model, coords);
  model.edu.groups = { diagonalA: [...(tri ? [] : [O]), ...Q.slice(1).flatMap((q) => [q[0], q[2]])], diagonalB: [...(tri ? [] : [O]), ...Q.slice(1).flatMap((q) => [q[1], q[3]])] };
  return model;
}

/**
 * The triangulated pattern is invariant under the half-turn and under the
 * mirrors in both diagonals (the dihedral group D2). Each mirror plane
 * contains the sheet normal, so it maps a folded state to a folded state
 * with the SAME signed fold angles: crease orbits share one angle (ratio 1).
 * Demaine et al. show the folding is unique for a given central angle, so the
 * symmetric folding is that folding; the links only help the solver find it.
 */
function symmetryLinksD2(model: OrigamiModel, coords: Vec2[]) {
  const key = ([x, y]: Vec2) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
  const idOf = new Map(coords.map((c, i) => [key(c), i]));
  const edgeOf = new Map(model.edges.map((e) => [edgeKey(e.vertices[0], e.vertices[1]), e.id]));
  const maps: ((p: Vec2) => Vec2)[] = [([x, y]) => [-x, -y], ([x, y]) => [y, x], ([x, y]) => [-y, -x]];
  const links: { a: number; b: number; ratio: number }[] = [];
  const done = new Set<number>();
  for (const e of model.edges) {
    if (e.faces[1] < 0 || done.has(e.id)) continue;
    done.add(e.id);
    for (const f of maps) {
      const a = idOf.get(key(f(coords[e.vertices[0]]))), b = idOf.get(key(f(coords[e.vertices[1]])));
      const img = a !== undefined && b !== undefined ? edgeOf.get(edgeKey(a, b)) : undefined;
      if (img === undefined || done.has(img)) continue;
      done.add(img);
      links.push({ a: img, b: e.id, ratio: 1 });
    }
  }
  return links;
}
