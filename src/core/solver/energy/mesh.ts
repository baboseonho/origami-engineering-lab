/**
 * Triangle/bar/hinge discretization used by the energy solver.
 *
 * Every polygon facet is triangulated; triangulation diagonals become
 * "facet hinges" (assignment F) that resist facet bending, while M/V/U
 * creases become "crease hinges" driven toward a target fold angle. Every
 * edge (crease, diagonal, boundary) is an axial bar.
 *
 * This is the bar-and-hinge idealisation used by Schenk & Guest (2011),
 * Liu & Paulino (MERLIN, 2017) and Ghassaei et al. (Origami Simulator, 2018).
 */
import { edgeKey } from '../../topology/build';
import { isCrease, type OrigamiModel } from '../../topology/types';

export interface Bar {
  a: number;
  b: number;
  l0: number;
  /** model edge id, or -1 for a triangulation diagonal */
  modelEdge: number;
}

export interface Hinge {
  /** hinge axis endpoints, ordered as traversed by the LEFT triangle */
  a: number;
  b: number;
  /** wing vertex of the left triangle (a, b, l) */
  l: number;
  /** wing vertex of the right triangle (b, a, r) */
  r: number;
  kind: 'crease' | 'facet';
  modelEdge: number;
  l0: number;
  /** reference fold angle (rest value for facet hinges) */
  rho0: number;
}

export interface TriMesh {
  nV: number;
  triangles: [number, number, number][];
  /** face id for each triangle */
  triFace: number[];
  bars: Bar[];
  hinges: Hinge[];
  /** hinge index for each model crease edge (or -1) */
  hingeOfEdge: Int32Array;
}

export function buildTriMesh(model: OrigamiModel): TriMesh {
  const tris: [number, number, number][] = [];
  const triFace: number[] = [];
  for (const f of model.faces) for (const t of f.triangles) { tris.push(t); triFace.push(f.id); }
  const modelEdgeOf = new Map<string, number>();
  for (const e of model.edges) modelEdgeOf.set(edgeKey(e.vertices[0], e.vertices[1]), e.id);

  // half-edge map: directed (a,b) -> [triangle index, wing vertex]
  const half = new Map<string, { t: number; w: number }>();
  tris.forEach((t, ti) => {
    for (let k = 0; k < 3; k++) half.set(`${t[k]},${t[(k + 1) % 3]}`, { t: ti, w: t[(k + 2) % 3] });
  });
  const bars: Bar[] = [];
  const hinges: Hinge[] = [];
  const hingeOfEdge = new Int32Array(model.edges.length).fill(-1);
  const seen = new Set<string>();
  const P = (v: number) => model.vertices[v].referencePosition;
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k + 1) % 3];
      const key = edgeKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      const me = modelEdgeOf.get(key) ?? -1;
      const pa = P(a), pb = P(b);
      const l0 = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      bars.push({ a, b, l0, modelEdge: me });
      const left = half.get(`${a},${b}`), right = half.get(`${b},${a}`);
      if (left && right) {
        const e = me >= 0 ? model.edges[me] : null;
        const kind: Hinge['kind'] = e && isCrease(e.assignment) ? 'crease' : 'facet';
        // orient the hinge like the model edge so rho signs agree with the model
        let ha = a, hb = b, hl = left.w, hr = right.w;
        if (e && e.vertices[0] !== a) { ha = b; hb = a; hl = right.w; hr = left.w; }
        const rho0 = e ? e.referenceFoldAngle : 0; // diagonals: reference faces are planar
        hinges.push({ a: ha, b: hb, l: hl, r: hr, kind, modelEdge: me, l0, rho0 });
        if (me >= 0) hingeOfEdge[me] = hinges.length - 1;
      }
    }
  }
  return { nV: model.vertices.length, triangles: tris, triFace, bars, hinges, hingeOfEdge };
}
