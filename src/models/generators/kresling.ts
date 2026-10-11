import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2, Vec3 } from '../../core/geometry/vectors';

export interface KreslingParams {
  /** polygon sides */
  n: number;
  /** circumradius */
  R: number;
  /** height of one cell in the reference (deployed) state */
  H: number;
  /** relative twist of one cell's top polygon w.r.t. its bottom (radians) */
  phi: number;
  /** number of stacked cells */
  cells: number;
  /** chirality: +1 diagonals lean one way, −1 mirror image */
  chirality: 1 | -1;
  /** include rigid end polygons (enforces planar, rigid rings) */
  caps: boolean;
}

/**
 * Kresling cylinder: n-gon rings at height kH rotated by k·φ; each cell is
 * 2n triangles with edges a (polygon side), b (B_i T_i), c (B_i T_{i+1}).
 *
 *   a = 2R sin(π/n)
 *   b² = H² + 2R²(1 − cos φ)
 *   c² = H² + 2R²(1 − cos(φ + 2π/n))
 *
 * A second state with the SAME a, b, c exists (bistability):
 *   φ' = π − 2π/n − φ,   H'² = H² + 2R²(cos φ' − cos φ)
 * Between them no configuration keeps all triangle edge lengths: the motion
 * requires panel deformation (see analysis/kreslingCompat.ts).
 *
 * Source: B. Kresling (2008); Guest & Pellegrino, J. Appl. Mech. 61 (1994);
 * Cai, Deng, Zhou, Feng (2015).
 */
export function kreslingSecondState(p: Pick<KreslingParams, 'n' | 'R' | 'H' | 'phi'>): { H: number; phi: number } | null {
  const phi2 = Math.PI - (2 * Math.PI) / p.n - p.phi;
  const H2sq = p.H * p.H + 2 * p.R * p.R * (Math.cos(phi2) - Math.cos(p.phi));
  if (!(H2sq > 1e-9)) return null;
  return { H: Math.sqrt(H2sq), phi: phi2 };
}

export function kresling(p: KreslingParams): OrigamiModel {
  const { n, R, H, cells, caps } = p;
  const phi = p.chirality * p.phi;
  const al = (2 * Math.PI) / n;
  const ref: Vec3[] = [];
  const coords: Vec2[] = [];
  const id = (k: number, i: number) => k * n + (((i % n) + n) % n);
  const a = 2 * R * Math.sin(Math.PI / n);
  for (let k = 0; k <= cells; k++)
    for (let i = 0; i < n; i++) {
      const t = i * al + k * phi;
      ref.push([R * Math.cos(t), R * Math.sin(t), k * H]);
      // unrolled crease pattern: ring k shifted by the twist projected on the arc (schematic development)
      coords.push([i * a + (k * phi * a) / al, k * H]);
    }
  const faces: number[][] = [];
  const assign: Record<string, Assignment> = {};
  for (let k = 0; k < cells; k++)
    for (let i = 0; i < n; i++) {
      const B0 = id(k, i), B1 = id(k, i + 1), T0 = id(k + 1, i), T1 = id(k + 1, i + 1);
      if (p.chirality === 1) {
        faces.push([B0, B1, T1], [B0, T1, T0]);
        assign[edgeKey(B0, T1)] = 'V';
        assign[edgeKey(B0, T0)] = 'M';
        assign[edgeKey(B1, T1)] = 'M';
      } else {
        faces.push([B0, B1, T0], [B1, T1, T0]);
        assign[edgeKey(B1, T0)] = 'V';
        assign[edgeKey(B0, T0)] = 'M';
        assign[edgeKey(B1, T1)] = 'M';
      }
    }
  for (let k = 1; k < cells; k++) for (let i = 0; i < n; i++) assign[edgeKey(id(k, i), id(k, i + 1))] = 'M';
  if (caps) {
    faces.push(Array.from({ length: n }, (_, i) => id(0, n - 1 - i)));
    faces.push(Array.from({ length: n }, (_, i) => id(cells, i)));
    for (let i = 0; i < n; i++) {
      assign[edgeKey(id(0, i), id(0, i + 1))] = 'U';
      assign[edgeKey(id(cells, i), id(cells, i + 1))] = 'U';
    }
  }
  const model = buildModel({
    name: `Kresling n=${n}, ${cells} cell${cells > 1 ? 's' : ''}`,
    description: 'Twisted-polygon cylinder (Kresling pattern)',
    generator: 'kresling',
    coords2D: coords,
    ref3D: ref,
    faces,
    assignment: assign,
    params: { n, R, H, phiDeg: (p.phi * 180) / Math.PI, cells, chirality: p.chirality, caps },
  });
  model.edu.layout2D = { periodX: n * a };
  model.edu.groups = {
    bottom: Array.from({ length: n }, (_, i) => id(0, i)),
    top: Array.from({ length: n }, (_, i) => id(cells, i)),
  };
  model.edu.baseFace = caps ? faces.length - 2 : 0;
  const diag = model.edges.find((e) => e.assignment === 'V');
  if (diag) model.edu.defaultDrive = { edge: diag.id, angle: diag.referenceFoldAngle + (10 * Math.PI) / 180 };
  return model;
}
