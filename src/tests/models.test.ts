import { describe, expect, it } from 'vitest';
import { GENERATORS, buildFromRegistry } from '../models/registry';
import { validateModel } from '../core/topology/validation';
import { RigidKinematicSolver } from '../core/solver/rigid/RigidKinematicSolver';
import { analyzeVertex, kreslingCompatibility, sheetDims } from '../core/analysis/metrics';
import { exportFold } from '../core/fold/exportFold';
import { importFold } from '../core/fold/importFold';
import { kreslingSecondState } from '../models/generators/kresling';
import { runAxialSweep } from '../core/analysis/experiments';
import { ENERGY_PRESETS } from '../core/solver/energy/EnergySolver';
import { DEG } from '../core/numerics/tolerances';
import { isCrease, type OrigamiModel } from '../core/topology/types';

const localFlatFoldable = (m: OrigamiModel) =>
  m.vertices.filter((v) => !v.boundary).every((v) => {
    const r = analyzeVertex(m, v.id);
    if (!r.edges.length) return true;
    return r.generalized.satisfied && r.generalizedMaekawa.satisfied && (r.mvCheck ? r.mvCheck.valid : true);
  });

const closureOf = (m: OrigamiModel, s: RigidKinematicSolver) => {
  const rho = new Float64Array(m.edges.length);
  for (const e of m.edges) rho[e.id] = e.referenceFoldAngle;
  for (const [k, v] of Object.entries(m.edu.referenceStates![0].foldAngles)) rho[+k] = v;
  return s.closureResidual(rho);
};

describe('every preset passes structural validation', () => {
  for (const [name, g] of Object.entries(GENERATORS)) {
    it(name, () => {
      const m = g.build(g.defaults);
      const r = validateModel(m);
      expect(r.errors).toEqual([]);
      // reference configuration is itself a closed rigid configuration
      expect(new RigidKinematicSolver(m).closureResidual()).toBeLessThan(1e-9);
    });
  }
});

describe('shopping bag theorem (tall bag)', () => {
  const m = buildFromRegistry('shoppingBag', { W: 2, D: 1, H: 2 });
  it('every vertex is locally flat-foldable (generalized Kawasaki + Maekawa + crimp)', () => expect(localFlatFoldable(m)).toBe(true));
  it('the flat state closes exactly', () => expect(closureOf(m, new RigidKinematicSolver(m))).toBeLessThan(1e-12));
  it('no crease can be driven from the open state, even ignoring M/V', () => {
    for (const e of m.edges.filter((x) => x.faces[1] >= 0 && isCrease(x.assignment)).slice(0, 8)) {
      const s = new RigidKinematicSolver(m, undefined, { enforceMV: false });
      s.setDrivingCrease(e.id, e.referenceFoldAngle + 5 * DEG);
      expect(s.solve().success).toBe(false);
    }
  });
});

describe('square twist: flat-foldable but not rigid-foldable', () => {
  const m = buildFromRegistry('squareTwist', {});
  it('locally flat-foldable at every vertex', () => expect(localFlatFoldable(m)).toBe(true));
  it('flat-folded state closes', () => expect(closureOf(m, new RigidKinematicSolver(m))).toBeLessThan(1e-12));
  it('cannot leave the unfolded state rigidly with its M/V assignment', () => {
    const s = new RigidKinematicSolver(m, undefined, { enforceMV: true });
    s.setDrivingCrease(m.edu.defaultDrive!.edge, 20 * DEG);
    const r = s.solve();
    expect(r.success).toBe(false);
    expect(r.reasons.some((x) => x.includes('M/V'))).toBe(true);
  });
});

describe('Kresling', () => {
  const p = { n: 6, R: 1, H: 1.2, phi: 45 * DEG };
  it('with rigid end polygons the cylinder has no rigid mobility', () => {
    const m = buildFromRegistry('kresling', { n: 6, R: 1, H: 1.2, phi: 45, cells: 1, caps: true });
    expect(new RigidKinematicSolver(m).analyze().dofLocal).toBe(0);
  });
  it('the analytic b-preserving path needs non-zero strain of c (not rigid-foldable)', () => {
    const st = kreslingSecondState(p)!;
    const path = kreslingCompatibility(p.n, p.R, p.H, p.phi, st.H, 30);
    expect(Math.max(...path.map((q) => Math.abs(q.cStrain)))).toBeGreaterThan(0.005);
    expect(Math.abs(path[path.length - 1].cStrain)).toBeLessThan(1e-9); // second state is stress-free
  });
  it('energy minimisation under compression produces the predicted twist at the second stable state', () => {
    const m = buildFromRegistry('kresling', { n: 6, R: 1, H: 1.2, phi: 45, cells: 1, caps: true });
    const st = kreslingSecondState(p)!;
    const res = runAxialSweep(m, { uMax: p.H - st.H, steps: 20, twistFree: true, params: { ...ENERGY_PRESETS.paperLike, kCrease: 0.02, kAxial: 60 } });
    const last = res[res.length - 1];
    expect(Math.abs(last.twist)).toBeGreaterThan(0.8 * (st.phi - p.phi));
    expect(Math.abs(last.twist)).toBeLessThan(1.2 * (st.phi - p.phi));
    // axial (compatibility) energy at the second state is far below its peak along the path
    const peak = Math.max(...res.map((r) => r.energy.axial));
    expect(last.energy.axial).toBeLessThan(0.5 * peak);
  });
});

describe('Miura auxetic response', () => {
  it('W and L both shrink as the fold increases (negative Poisson ratio)', () => {
    const m = buildFromRegistry('miura', { rows: 4, cols: 4 });
    const s = new RigidKinematicSolver(m);
    const d = m.edu.defaultDrive!;
    const sg = Math.sign(d.angle);
    s.setDrivingCrease(d.edge, sg * 40 * DEG); s.solve();
    const a = sheetDims(m, s.positions())!;
    s.setDrivingCrease(d.edge, sg * 60 * DEG); s.solve();
    const b = sheetDims(m, s.positions())!;
    expect(b.W).toBeLessThan(a.W);
    expect(b.L).toBeLessThan(a.L);
  });
});

describe('Ron Resch vertex types', () => {
  it('Kawasaki holds but Maekawa fails (not flat-foldable)', () => {
    const m = buildFromRegistry('resch', { m: 2, n: 2, variant: 'valid' });
    const centre = m.edu.highlightVertices![0];
    const r = analyzeVertex(m, centre);
    expect(r.sectors.length).toBe(6);
    expect(r.kawasaki.satisfied).toBe(true);
    expect(r.maekawa.satisfied).toBe(false);
  });
  it('perturbed variant breaks Kawasaki at the tuck centres', () => {
    const m = buildFromRegistry('resch', { m: 2, n: 2, variant: 'perturbed' });
    const r = analyzeVertex(m, m.edu.highlightVertices![0]);
    expect(r.kawasaki.satisfied).toBe(false);
  });
});

describe('waterbomb tessellation vertex conditions', () => {
  it('interior vertices satisfy Kawasaki and Maekawa', () => {
    const m = buildFromRegistry('waterbomb', { cols: 3, rows: 3 });
    for (const v of m.vertices) {
      if (v.boundary) continue;
      const r = analyzeVertex(m, v.id);
      expect(r.kawasaki.satisfied).toBe(true);
      expect(r.maekawa.satisfied).toBe(true);
    }
  });
});

describe('FOLD round trip', () => {
  for (const name of ['miura', 'waterbomb', 'shoppingBag', 'kresling']) {
    it(`${name}: export → import preserves topology, assignments and fold angles`, () => {
      const m = buildFromRegistry(name, {});
      const rho = new Float64Array(m.edges.length);
      m.edges.forEach((e, i) => (rho[i] = e.referenceFoldAngle + (e.faces[1] >= 0 ? 0.1 * Math.sin(i) : 0)));
      const f = JSON.parse(JSON.stringify(exportFold(m, rho)));
      const { model: m2, foldAngles } = importFold(f);
      expect(m2.vertices.length).toBe(m.vertices.length);
      expect(m2.faces.length).toBe(m.faces.length);
      expect(m2.edges.length).toBe(m.edges.length);
      const key = (e: { vertices: number[] }) => [...e.vertices].sort((a, b) => a - b).join('-');
      const byKey = new Map(m.edges.map((e) => [key(e), e]));
      for (const e of m2.edges) {
        const o = byKey.get(key(e))!;
        expect(o).toBeDefined();
        expect(e.assignment).toBe(o.assignment);
        if (e.faces[1] >= 0) expect(foldAngles![e.id]).toBeCloseTo(rho[o.id], 6);
      }
      expect(validateModel(m2).errors).toEqual([]);
    });
  }
});

describe('Miura Poisson ratio vs Schenk & Guest unit cell', () => {
  it('measured −dlnL/dlnW matches −1/(cos²θ tan²α) within 2%', () => {
    const m = buildFromRegistry('miura', { rows: 8, cols: 8, alpha: 60 });
    const s = new RigidKinematicSolver(m);
    const d = m.edu.defaultDrive!;
    const sg = Math.sign(d.angle);
    const zig = +Object.entries(m.edu.creaseLabels).find(([, l]) => l === 'ρ2')![0];
    for (const t of [30, 60, 100]) {
      s.setDrivingCrease(d.edge, sg * t * DEG); s.solve();
      const d0 = sheetDims(m, s.positions())!;
      const th = Math.abs(s.rho[zig]) / 2;
      s.setDrivingCrease(d.edge, sg * (t + 0.2) * DEG); s.solve();
      const d1 = sheetDims(m, s.positions())!;
      const nu = -((d1.L - d0.L) / d0.L) / ((d1.W - d0.W) / d0.W);
      const analytic = -1 / (Math.cos(th) ** 2 * Math.tan(60 * DEG) ** 2);
      expect(Math.abs(nu - analytic) / Math.abs(analytic)).toBeLessThan(0.02);
    }
  });
});
