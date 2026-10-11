import { signedFoldAngle } from '../geometry/angles';
import { newellNormal, polygonArea } from '../geometry/normals';
import { earClip } from '../geometry/triangulation';
import { cross, dist, dot, normalize, sub, type Vec2, type Vec3 } from '../geometry/vectors';
import { TOL } from '../numerics/tolerances';
import type { Assignment, EducationalMetadata, OrigamiEdge, OrigamiFace, OrigamiModel, OrigamiVertex } from './types';

export const edgeKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

export interface ModelSpec {
  name: string;
  description: string;
  generator: string;
  coords2D: Vec2[];
  /** Reference 3D configuration. Defaults to the flat sheet (x, y, 0). */
  ref3D?: Vec3[];
  /** Faces as vertex lists, CCW when viewed from the front side. */
  faces: number[][];
  /** Assignment for interior edges, keyed by edgeKey. Unlisted interior edges become 'U'. */
  assignment: Record<string, Assignment> | ((a: number, b: number) => Assignment | undefined);
  /** Optional default energy targets (radians) keyed by edgeKey. */
  targets?: Record<string, number>;
  stiffness?: Record<string, number>;
  params?: Record<string, number | string | boolean>;
  edu?: Partial<EducationalMetadata>;
  units?: string;
  /** Flip faces so that 2D signed area is positive (only for flat references). */
  autoOrient?: boolean;
}

/** Project polygon points to 2D in the polygon plane (for triangulation). */
function projectToPlane(pts: Vec3[], n: Vec3): Vec2[] {
  const a = Math.abs(n[0]) < 0.9 ? ([1, 0, 0] as Vec3) : ([0, 1, 0] as Vec3);
  const u = normalize(cross(a, n));
  const w = cross(n, u);
  return pts.map((p) => [dot(p, u), dot(p, w)]);
}

export function buildModel(spec: ModelSpec): OrigamiModel {
  const ref: Vec3[] = spec.ref3D ?? spec.coords2D.map(([x, y]) => [x, y, 0]);
  if (ref.length !== spec.coords2D.length) throw new Error('ref3D / coords2D length mismatch');

  const facesIn = spec.faces.map((f) => [...f]);
  if (spec.autoOrient !== false && !spec.ref3D) {
    for (const f of facesIn) {
      let s = 0;
      for (let i = 0; i < f.length; i++) {
        const p = spec.coords2D[f[i]], q = spec.coords2D[f[(i + 1) % f.length]];
        s += p[0] * q[1] - q[0] * p[1];
      }
      if (s < 0) f.reverse();
    }
  }

  const faces: OrigamiFace[] = facesIn.map((vs, id) => {
    const pts = vs.map((v) => ref[v]);
    const n = normalize(newellNormal(pts), [0, 0, 1]);
    const tri2 = earClip(projectToPlane(pts, n));
    return {
      id,
      vertices: vs,
      triangles: tri2.map(([a, b, c]) => [vs[a], vs[b], vs[c]] as [number, number, number]),
      area: polygonArea(pts),
      normal: n,
    };
  });

  // Edges from face boundaries
  const edgeMap = new Map<string, OrigamiEdge & { inconsistent?: boolean }>();
  const edges: (OrigamiEdge & { inconsistent?: boolean })[] = [];
  const getAssign = (a: number, b: number): Assignment | undefined =>
    typeof spec.assignment === 'function' ? spec.assignment(a, b) : spec.assignment[edgeKey(a, b)];

  for (const f of faces) {
    const vs = f.vertices;
    for (let i = 0; i < vs.length; i++) {
      const a = vs[i], b = vs[(i + 1) % vs.length];
      const key = edgeKey(a, b);
      const existing = edgeMap.get(key);
      if (!existing) {
        const e: OrigamiEdge = {
          id: edges.length,
          vertices: [a, b],
          faces: [f.id, -1],
          assignment: 'B',
          restLength: dist(ref[a], ref[b]),
          referenceFoldAngle: 0,
          defaultTarget: 0,
          stiffness: spec.stiffness?.[key] ?? 1,
        };
        edgeMap.set(key, e);
        edges.push(e);
      } else {
        if (existing.faces[1] !== -1) throw new Error(`Non-manifold edge ${key}`);
        existing.faces[1] = f.id;
        if (existing.vertices[0] === a) existing.inconsistent = true;
      }
    }
  }

  for (const e of edges) {
    const key = edgeKey(e.vertices[0], e.vertices[1]);
    if (e.faces[1] === -1) {
      e.assignment = 'B';
      continue;
    }
    e.assignment = getAssign(e.vertices[0], e.vertices[1]) ?? 'U';
    const nL = faces[e.faces[0]].normal, nR = faces[e.faces[1]].normal;
    const axis = sub(ref[e.vertices[1]], ref[e.vertices[0]]);
    const rho0 = signedFoldAngle(nL, nR, axis);
    e.referenceFoldAngle = Math.abs(rho0) < TOL.angle ? 0 : rho0;
    const t = spec.targets?.[key];
    e.defaultTarget = t ?? (e.assignment === 'M' ? -Math.PI : e.assignment === 'V' ? Math.PI : e.referenceFoldAngle);
  }

  const boundaryV = new Set<number>();
  for (const e of edges) if (e.faces[1] === -1) { boundaryV.add(e.vertices[0]); boundaryV.add(e.vertices[1]); }

  const vertices: OrigamiVertex[] = ref.map((p, id) => ({
    id,
    initialPosition2D: spec.coords2D[id],
    referencePosition: p,
    mass: 1,
    boundary: boundaryV.has(id),
  }));

  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of ref) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  const scale = Math.max(Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), 1e-6);

  const model: OrigamiModel = {
    metadata: {
      name: spec.name,
      description: spec.description,
      generator: spec.generator,
      units: spec.units ?? 'unit length',
      developable: true,
    },
    vertices,
    edges,
    faces,
    params: spec.params ?? {},
    edu: {
      creaseLabels: {},
      symmetryLinks: [],
      notes: [],
      ...spec.edu,
    },
    scale,
  };
  model.metadata.developable = checkDevelopable(model);
  return model;
}

/** Interior corner angle of face f at vertex v (reference configuration). */
export function cornerAngle(model: OrigamiModel, f: OrigamiFace, v: number): number {
  const vs = f.vertices;
  const i = vs.indexOf(v);
  const p = model.vertices[v].referencePosition;
  const a = model.vertices[vs[(i + 1) % vs.length]].referencePosition;
  const b = model.vertices[vs[(i + vs.length - 1) % vs.length]].referencePosition;
  const u = sub(a, p), w = sub(b, p);
  // signed angle about the face normal, CCW from u to w; interior angle in (0, 2pi)
  const s = dot(cross(u, w), f.normal);
  const c = dot(u, w);
  let ang = Math.atan2(s, c);
  if (ang < 0) ang += 2 * Math.PI;
  return ang;
}

/** Sum of reference corner angles at each vertex. */
export function angleSums(model: OrigamiModel): Float64Array {
  const sums = new Float64Array(model.vertices.length);
  for (const f of model.faces) for (const v of f.vertices) sums[v] += cornerAngle(model, f, v);
  return sums;
}

function checkDevelopable(model: OrigamiModel): boolean {
  const sums = angleSums(model);
  for (const v of model.vertices) {
    if (v.boundary) continue;
    if (Math.abs(sums[v.id] - 2 * Math.PI) > 1e-6) return false;
  }
  return true;
}
