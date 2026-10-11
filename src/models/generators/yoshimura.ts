import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2, Vec3 } from '../../core/geometry/vectors';

export interface YoshimuraParams {
  /** circumferential divisions (diamonds around) */
  n: number;
  R: number;
  /** total height */
  height: number;
  /** axial rows (rings − 1) */
  rows: number;
  /**
   * 'creased' : ring edges V, diagonals M, low crease stiffness (pre-creased Yoshimura)
   * 'smooth'  : every edge is a facet hinge with uniform bending stiffness (an
   *             unfolded thin cylinder discretised on the Yoshimura lattice)
   */
  variant: 'creased' | 'smooth';
  /** deterministic radial imperfection amplitude (fraction of R) */
  imperfection: number;
  /** rigid end polygons (needed for twist/compression with free lateral ends) */
  caps?: boolean;
}

/**
 * Yoshimura (diamond) cylinder: rings of n vertices, alternate rings offset
 * by half a step; each ring pair forms 2n triangles. The triangulation is
 * aligned with the diamond pattern, so a buckling mode that bends along
 * these lines is representable (note: mesh-aligned, see MODELS.md).
 *
 * Source: Y. Yoshimura, "On the mechanism of buckling of a circular
 * cylindrical shell under axial compression", NACA TM 1390 (1955).
 */
export function yoshimura(p: YoshimuraParams): OrigamiModel {
  const { n, R, height, rows } = p;
  const al = (2 * Math.PI) / n;
  const h = height / rows;
  const ref: Vec3[] = [];
  const coords: Vec2[] = [];
  const id = (k: number, i: number) => k * n + (((i % n) + n) % n);
  const s = 2 * R * Math.sin(al / 2);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; k <= rows; k++)
    for (let i = 0; i < n; i++) {
      const t = (i + (k % 2) * 0.5) * al;
      const interior = k > 0 && k < rows;
      const r = R * (1 + (interior ? p.imperfection * rnd() : 0));
      ref.push([r * Math.cos(t), r * Math.sin(t), k * h]);
      coords.push([(i + (k % 2) * 0.5) * s, k * h]);
    }
  const faces: number[][] = [];
  const assign: Record<string, Assignment> = {};
  const ringA: Assignment = p.variant === 'creased' ? 'V' : 'F';
  const diagA: Assignment = p.variant === 'creased' ? 'M' : 'F';
  for (let k = 0; k < rows; k++)
    for (let i = 0; i < n; i++) {
      if (k % 2 === 0) {
        // bottom even (angles i), top odd (angles i+1/2)
        const B0 = id(k, i), B1 = id(k, i + 1), T0 = id(k + 1, i), Tm = id(k + 1, i - 1);
        faces.push([B0, B1, T0], [B0, T0, Tm]);
        assign[edgeKey(B0, T0)] = diagA;
        assign[edgeKey(B1, T0)] = diagA;
      } else {
        // bottom odd (i+1/2), top even (i)
        const B0 = id(k, i), B1 = id(k, i + 1), T1 = id(k + 1, i + 1), T0 = id(k + 1, i);
        faces.push([B0, B1, T1], [B0, T1, T0]);
        assign[edgeKey(B0, T1)] = diagA;
        assign[edgeKey(B1, T1)] = diagA;
      }
    }
  for (let k = 1; k < rows; k++) for (let i = 0; i < n; i++) assign[edgeKey(id(k, i), id(k, i + 1))] = ringA;
  if (p.caps) {
    faces.push(Array.from({ length: n }, (_, i) => id(0, n - 1 - i)));
    faces.push(Array.from({ length: n }, (_, i) => id(rows, i)));
    for (let i = 0; i < n; i++) {
      assign[edgeKey(id(0, i), id(0, i + 1))] = "U";
      assign[edgeKey(id(rows, i), id(rows, i + 1))] = "U";
    }
  }
  const model = buildModel({
    name: `Yoshimura n=${n}, ${rows} rows (${p.variant})`,
    description: 'Diamond-pattern cylinder for axial compression experiments',
    generator: 'yoshimura',
    coords2D: coords,
    ref3D: ref,
    faces,
    assignment: assign,
    params: { n, R, height, rows, variant: p.variant, imperfection: p.imperfection, caps: !!p.caps },
  });
  model.edu.layout2D = { periodX: n * s };
  model.edu.groups = {
    bottom: Array.from({ length: n }, (_, i) => id(0, i)),
    top: Array.from({ length: n }, (_, i) => id(rows, i)),
  };
  return model;
}
