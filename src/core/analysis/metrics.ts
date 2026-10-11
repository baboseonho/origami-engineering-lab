/**
 * Geometric measurements derived from the current configuration.
 */
import { safeAcos } from '../geometry/angles';
import { kawasaki } from '../constraints/kawasaki';
import { maekawa } from '../constraints/maekawa';
import { generalizedFlatFold, generalizedMaekawa } from '../constraints/generalizedFlatFold';
import { checkMVAssignment } from '../constraints/mvAssignment';
import { vertexStar } from '../topology/adjacency';
import type { Assignment, OrigamiModel } from '../topology/types';

type V3 = [number, number, number];
const P = (x: Float64Array, i: number): V3 => [x[3 * i], x[3 * i + 1], x[3 * i + 2]];
const centroid = (x: Float64Array, ids: number[]): V3 => {
  const c: V3 = [0, 0, 0];
  for (const i of ids) { c[0] += x[3 * i]; c[1] += x[3 * i + 1]; c[2] += x[3 * i + 2]; }
  return ids.length ? [c[0] / ids.length, c[1] / ids.length, c[2] / ids.length] : c;
};
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface SheetDims {
  /** distance between the centroids of the left and right boundary */
  W: number;
  /** distance between the centroids of the bottom and top boundary */
  L: number;
  /** extent normal to the W-L plane (folded thickness) */
  T: number;
  /** footprint area W·L relative to the flat sheet */
  areaRatio: number;
  axisW: V3;
  axisL: V3;
}

/** Overall dimensions of a sheet with left/right/bottom/top groups (Miura etc.). */
export function sheetDims(model: OrigamiModel, x: Float64Array): SheetDims | null {
  const g = model.edu.groups;
  if (!g?.left || !g?.right || !g?.bottom || !g?.top) return null;
  const w = sub(centroid(x, g.right), centroid(x, g.left));
  const l = sub(centroid(x, g.top), centroid(x, g.bottom));
  const n = cross(w, l);
  const nl = len(n) || 1;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < model.vertices.length; i++) {
    const d = dot(P(x, i), n) / nl;
    lo = Math.min(lo, d); hi = Math.max(hi, d);
  }
  const ref = Float64Array.from(model.vertices.flatMap((v) => v.referencePosition));
  const w0 = len(sub(centroid(ref, g.right), centroid(ref, g.left)));
  const l0 = len(sub(centroid(ref, g.top), centroid(ref, g.bottom)));
  return { W: len(w), L: len(l), T: hi - lo, areaRatio: (len(w) * len(l)) / (w0 * l0), axisW: w, axisL: l };
}

/**
 * Discrete Gaussian curvature by angle defect, K_v ≈ 2π − Σ incident angles,
 * on a (coarse) triangle surface. For the paper itself the defect is
 * identically 0 at interior vertices (developable); positive values on the
 * COARSE surface through e.g. waterbomb base centres indicate an effective
 * dome-like (synclastic) shape.
 */
export function angleDefects(x: Float64Array, tris: [number, number, number][], vertices: number[]): Map<number, number> {
  const sum = new Map<number, number>();
  const valence = new Map<number, number>();
  const edgeCount = new Map<string, number>();
  for (const t of tris)
    for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k + 1) % 3], c = t[(k + 2) % 3];
      const u = sub(P(x, b), P(x, a)), w = sub(P(x, c), P(x, a));
      const ang = safeAcos(dot(u, w) / ((len(u) * len(w)) || 1));
      sum.set(a, (sum.get(a) ?? 0) + ang);
      valence.set(a, (valence.get(a) ?? 0) + 1);
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  // interior coarse vertices: every incident coarse edge shared by two triangles
  const boundary = new Set<number>();
  for (const [k, c] of edgeCount) if (c === 1) { const [a, b] = k.split('-').map(Number); boundary.add(a); boundary.add(b); }
  const out = new Map<number, number>();
  for (const v of vertices) if (!boundary.has(v) && sum.has(v)) out.set(v, 2 * Math.PI - sum.get(v)!);
  return out;
}

/** Paper-level angle defect at the model's interior vertices (should be ≈ 0 when developable). */
export function paperAngleDefects(model: OrigamiModel, x: Float64Array): number {
  const tris: [number, number, number][] = model.faces.flatMap((f) => f.triangles);
  const d = angleDefects(x, tris, model.vertices.filter((v) => !v.boundary).map((v) => v.id));
  let m = 0;
  for (const v of d.values()) m = Math.max(m, Math.abs(v));
  return m;
}

export interface VertexReport {
  vertex: number;
  interior: boolean;
  edges: number[];
  sectors: number[];
  assignments: Assignment[];
  kawasaki: ReturnType<typeof kawasaki>;
  maekawa: ReturnType<typeof maekawa>;
  generalized: ReturnType<typeof generalizedFlatFold>;
  generalizedMaekawa: ReturnType<typeof generalizedMaekawa>;
  mvCheck: ReturnType<typeof checkMVAssignment> | null;
}

export function analyzeVertex(model: OrigamiModel, v: number, assignments?: Assignment[]): VertexReport {
  const st = vertexStar(model, v);
  const asg = assignments ?? st.edges.map((e) => model.edges[e].assignment);
  const folding = st.edges.map((_, i) => asg[i] === 'M' || asg[i] === 'V');
  // flat-foldability is analysed on the folding creases only: merge sectors across F creases
  const creases: number[] = [], creaseAsg: Assignment[] = [], sectors: number[] = [];
  if (st.interior) {
    const n = st.edges.length;
    const start = folding.indexOf(true);
    if (start >= 0) {
      let acc = 0;
      for (let k = 0; k < n; k++) {
        const i = (start + k) % n;
        if (folding[i] && k > 0) { sectors.push(acc); acc = 0; }
        if (folding[i]) { creases.push(st.edges[i]); creaseAsg.push(asg[i]); }
        acc += st.sectors[i];
      }
      sectors.push(acc);
    }
  }
  const gen = generalizedFlatFold(sectors);
  const mvOk = creaseAsg.every((a) => a === 'M' || a === 'V');
  return {
    vertex: v,
    interior: st.interior,
    edges: creases,
    sectors,
    assignments: creaseAsg,
    kawasaki: kawasaki(sectors),
    maekawa: maekawa(creaseAsg),
    generalized: gen,
    generalizedMaekawa: generalizedMaekawa(gen.windingClass, creaseAsg),
    mvCheck: st.interior && mvOk && creases.length >= 2 && Math.abs(gen.total - 2 * Math.PI) < 1e-6 ? checkMVAssignment(sectors, creaseAsg as ('M' | 'V')[], creases) : null,
  };
}

/** Kresling rigid-compatibility check along a prescribed (b-preserving) path. */
export function kreslingCompatibility(n: number, R: number, H0: number, phi0: number, H1: number, samples = 40) {
  const al = (2 * Math.PI) / n;
  const b2 = H0 * H0 + 2 * R * R * (1 - Math.cos(phi0));
  const c0 = Math.sqrt(H0 * H0 + 2 * R * R * (1 - Math.cos(phi0 + al)));
  const out: { h: number; phi: number; cStrain: number }[] = [];
  for (let k = 0; k <= samples; k++) {
    const h = H0 + ((H1 - H0) * k) / samples;
    const cphi = 1 - (b2 - h * h) / (2 * R * R);
    if (cphi < -1 || cphi > 1) continue;
    const phi = Math.acos(cphi);
    const c = Math.sqrt(h * h + 2 * R * R * (1 - Math.cos(phi + al)));
    out.push({ h, phi, cStrain: (c - c0) / c0 });
  }
  return out;
}

/**
 * Stepwise analytic derivation for the symmetric (Miura) degree-4 vertex,
 * sectors α, π−α, π−α, α ; c1, c3 collinear (minor), c2, c4 major.
 *  (1) law of cosines at c1:  cos δ = cos²α − sin²α cos ρ1   (δ = angle c2–c4)
 *  (2) symmetry: c2, c4 are mirror images in the plane M ⊃ c1, c3
 *  (3) projection/orthogonality: p = proj_M(c2), |p| = cos(δ/2),
 *      cos θ1 = cos α / cos(δ/2)   (θ1 = angle between c1 and p)
 *  (4) symmetry: γ = angle(c1, c3) = π − 2θ1
 *  (5) law of cosines at c2:  cos γ = −cos²α − sin²α cos ρ2
 *      ⇒ cos ρ2 = −(cos γ + cos²α) / sin²α
 *  (6) ρ3 = −ρ1 (opposite assignment), ρ4 = ρ2.
 */
export function miuraStepwise(alpha: number, rho1: number) {
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const cosDelta = ca * ca - sa * sa * Math.cos(rho1);
  const delta = safeAcos(cosDelta);
  const cosTheta1 = ca / Math.cos(delta / 2);
  const theta1 = safeAcos(cosTheta1);
  const gamma = Math.PI - 2 * theta1;
  const cosRho2 = -(Math.cos(gamma) + ca * ca) / (sa * sa);
  const rho2 = safeAcos(cosRho2);
  return { delta, theta1, gamma, rho2Magnitude: rho2, cosDelta, cosTheta1, cosRho2 };
}

/** Analytic Miura in-plane Poisson ratio (Schenk & Guest 2013): ν = −cos²θ tan²γ. */
export const miuraPoissonAnalytic = (theta: number, gamma: number) => -(Math.cos(theta) ** 2) * Math.tan(gamma) ** 2;
