/**
 * Hinge (dihedral) angle and its gradient — shared by crease torsion and
 * facet bending.
 *
 * Hinge a→b with left triangle (a, b, l) and right triangle (b, a, r):
 *   nL = unit((b−a)×(l−a)),  nR = unit((a−b)×(r−b))
 *   ρ  = atan2( (nR×nL)·ê , nR·nL )               (valley > 0, see angles.ts)
 * Gradient (h = distance of a wing vertex from the hinge line):
 *   ∂ρ/∂x_l = nL / h_l,      ∂ρ/∂x_r = nR / h_r
 *   ∂ρ/∂x_a = −(1−t_l) ∂ρ/∂x_l − (1−t_r) ∂ρ/∂x_r
 *   ∂ρ/∂x_b = −t_l ∂ρ/∂x_l − t_r ∂ρ/∂x_r
 * where t_w = ((x_w − x_a)·e)/|e|² is the projection parameter of the wing.
 * (Translation and rotation invariance are exact; verified numerically in
 * tests against finite differences.) Equivalent to the formulas of
 * Liu & Paulino, Proc. R. Soc. A 473 (2017) and Ghassaei et al. (2018).
 *
 * Energies:  V_crease = ½ k_c L (ρ − ρ_target)²,  V_facet = ½ k_f L (ρ − ρ0)²
 * (k per unit hinge length, as in Origami Simulator).
 */
import { TOL } from '../../numerics/tolerances';

export interface HingeEval {
  rho: number;
  /** gradient, 12 numbers: d/dx_a, d/dx_b, d/dx_l, d/dx_r */
  grad: Float64Array;
  ok: boolean;
}

export function hingeAngleGrad(x: Float64Array, a: number, b: number, l: number, r: number, prevRho?: number, out?: Float64Array): HingeEval {
  const grad = out ?? new Float64Array(12);
  const ax = x[3 * a], ay = x[3 * a + 1], az = x[3 * a + 2];
  const ex = x[3 * b] - ax, ey = x[3 * b + 1] - ay, ez = x[3 * b + 2] - az;
  const lx = x[3 * l] - ax, ly = x[3 * l + 1] - ay, lz = x[3 * l + 2] - az;
  const rx = x[3 * r] - ax, ry = x[3 * r + 1] - ay, rz = x[3 * r + 2] - az;
  const e2 = ex * ex + ey * ey + ez * ez;
  const eLen = Math.sqrt(e2);
  // nL ∝ e × (l−a)
  let nLx = ey * lz - ez * ly, nLy = ez * lx - ex * lz, nLz = ex * ly - ey * lx;
  // nR ∝ (a−b) × (r−b) = (−e) × (r − a − e) = (−e) × (r−a) = (r−a) × e
  let nRx = ry * ez - rz * ey, nRy = rz * ex - rx * ez, nRz = rx * ey - ry * ex;
  const aL = Math.hypot(nLx, nLy, nLz), aR = Math.hypot(nRx, nRy, nRz);
  if (!(eLen > TOL.geometry) || !(aL > TOL.geometry) || !(aR > TOL.geometry)) {
    grad.fill(0);
    return { rho: prevRho ?? 0, grad, ok: false };
  }
  nLx /= aL; nLy /= aL; nLz /= aL;
  nRx /= aR; nRy /= aR; nRz /= aR;
  const hL = aL / eLen, hR = aR / eLen;
  const cx = nRy * nLz - nRz * nLy, cy = nRz * nLx - nRx * nLz, cz = nRx * nLy - nRy * nLx;
  const s = (cx * ex + cy * ey + cz * ez) / eLen;
  const c = nRx * nLx + nRy * nLy + nRz * nLz;
  let rho = Math.atan2(s, c);
  if (prevRho !== undefined && Number.isFinite(prevRho)) {
    // unwrap so the angle stays continuous through ±π
    let d = rho - prevRho;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    rho = prevRho + d;
  }
  const tl = (lx * ex + ly * ey + lz * ez) / e2;
  const tr = (rx * ex + ry * ey + rz * ez) / e2;
  const gl = [nLx / hL, nLy / hL, nLz / hL];
  const gr = [nRx / hR, nRy / hR, nRz / hR];
  for (let k = 0; k < 3; k++) {
    grad[k] = -(1 - tl) * gl[k] - (1 - tr) * gr[k];
    grad[3 + k] = -tl * gl[k] - tr * gr[k];
    grad[6 + k] = gl[k];
    grad[9 + k] = gr[k];
  }
  return { rho, grad, ok: true };
}
