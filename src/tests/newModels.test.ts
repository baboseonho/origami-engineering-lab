import { afterAll, describe, expect, it } from 'vitest';
import { GENERATORS, buildFromRegistry } from '../models/registry';
import { validateModel } from '../core/topology/validation';
import { RigidKinematicSolver } from '../core/solver/rigid/RigidKinematicSolver';
import { EnergySolver, ENERGY_PRESETS, type EnergyParams } from '../core/solver/energy/EnergySolver';
import { detectCollisions } from '../core/solver/collision/collision';
import { analyzeVertex } from '../core/analysis/metrics';
import { solveStrip } from '../core/constraints/strip1D';
import { edgeKey } from '../core/topology/build';
import { DEG } from '../core/numerics/tolerances';
import { isCrease, type OrigamiModel } from '../core/topology/types';
import { waterbombTubeMetrics } from '../models/generators/waterbombTube';
import { kreslingSecondState } from '../models/generators/kresling';
import { setLang } from '../i18n';

const localFlatFoldable = (m: OrigamiModel, skip: number[] = []) =>
  m.vertices.filter((v) => !v.boundary && !skip.includes(v.id)).every((v) => {
    const r = analyzeVertex(m, v.id);
    if (!r.edges.length) return true;
    return r.kawasaki.satisfied && r.maekawa.satisfied && (r.mvCheck ? r.mvCheck.valid : true);
  });

const stateRho = (m: OrigamiModel, k = 0) => {
  const rho = new Float64Array(m.edges.length);
  for (const e of m.edges) rho[e.id] = e.referenceFoldAngle;
  for (const [id, v] of Object.entries(m.edu.referenceStates![k].foldAngles)) rho[+id] = v;
  return rho;
};

/** What the app's "fold the whole pattern" (energy) does: every crease to its folded target, in steps. */
function energyFold(m: OrigamiModel, params: EnergyParams, steps = 20, upTo = 1) {
  const s = new EnergySolver(m, params);
  s.fixVertices(m.faces[m.edu.baseFace ?? 0].vertices, 7);
  const flat = m.edu.referenceStates?.[0]?.foldAngles;
  const target = (id: number) => {
    const e = m.edges[id];
    if (flat) return flat[id] ?? e.referenceFoldAngle;
    return e.faces[1] >= 0 && isCrease(e.assignment) ? e.defaultTarget : e.referenceFoldAngle;
  };
  for (let k = 1; k <= steps; k++) {
    const p = (upTo * k) / steps;
    s.setCreaseTargets((id) => { const r = m.edges[id].referenceFoldAngle; return r + p * (target(id) - r); });
    s.relaxFIRE(4000, 1e-6);
  }
  const res = s.relaxFIRE(20000, 1e-7);
  const strain = Math.max(...Array.from(s.strains(), Math.abs));
  return { s, res, strain, target };
}

const creaseOf = (m: OrigamiModel, a: [number, number], b: [number, number]) => {
  const id = (p: [number, number]) => m.vertices.findIndex((v) => Math.hypot(v.initialPosition2D[0] - p[0], v.initialPosition2D[1] - p[1]) < 1e-9);
  return m.edges.find((e) => edgeKey(e.vertices[0], e.vertices[1]) === edgeKey(id(a), id(b)))!;
};

describe('new generators: structural validity over their parameter ranges', () => {
  const cases: [string, Record<string, number | string>][] = [
    ...[2, 5, 12].map((n) => ['pleat', { n }] as [string, Record<string, number>]),
    ...[3, 6, 10].flatMap((rings) => (['classic', 'triangulated'] as const).map((variant) => ['hypar', { rings, variant }] as [string, Record<string, number | string>])),
    ...[3, 4, 5, 6, 8].flatMap((n) => [5, 25, 40, 58].map((phi) => ['twist', { n, phi }] as [string, Record<string, number>])),
    ...[[4, 1], [6, 4], [12, 2]].map(([n, m]) => ['waterbombTube', { n, m }] as [string, Record<string, number>]),
  ];
  for (const [g, p] of cases) {
    it(`${g} ${JSON.stringify(p)}`, () => {
      const m = buildFromRegistry(g, p);
      expect(validateModel(m).errors).toEqual([]);
      expect(new RigidKinematicSolver(m).closureResidual()).toBeLessThan(1e-9);
      expect(m.metadata.developable).toBe(true);
      if (m.edu.defaultDrive) expect(isCrease(m.edges[m.edu.defaultDrive.edge].assignment)).toBe(true);
      for (const l of m.edu.symmetryLinks) expect(m.edges[l.a].faces[1]).toBeGreaterThanOrEqual(0);
    });
  }
});

describe('accordion pleat', () => {
  const m = buildFromRegistry('pleat', { n: 6, width: 3, depth: 0.5 });
  const creases = m.edges.filter((e) => e.faces[1] >= 0);

  it('has no interior vertex: rigid DoF = N − rank J = n', () => {
    const a = new RigidKinematicSolver(m).analyze();
    expect(a.M).toBe(0);
    expect(a.N).toBe(6);
    expect(a.dofLocal).toBe(6);
  });

  it('is 1D flat-foldable (end folds / crimps) and its ±180° state closes', () => {
    const strip = { length: 7 * 0.5, creases: creases.map((e) => ({ pos: m.vertices[e.vertices[0]].initialPosition2D[0], mv: e.assignment as 'M' | 'V', id: e.id })).sort((a, b) => a.pos - b.pos) };
    expect(strip.creases.map((c) => c.mv).join('')).toBe('VMVMVM');
    expect(solveStrip(strip).foldable).toBe(true);
    expect(new RigidKinematicSolver(m).closureResidual(stateRho(m))).toBeLessThan(1e-12);
  });

  it('with symmetry links one drive folds every crease (ρ_k = ±ρ_1) all the way to 180°', () => {
    const s = new RigidKinematicSolver(m, undefined, { enforceMV: true, useSymmetryLinks: true });
    const d = m.edu.defaultDrive!;
    const sg = Math.sign(d.angle);
    for (const t of [30, 90, 150, 180]) {
      s.setDrivingCrease(d.edge, sg * t * DEG);
      expect(s.solve().success).toBe(true);
      for (const e of creases) expect(s.rho[e.id]).toBeCloseTo((e.assignment === 'M' ? -1 : 1) * t * DEG, 6);
    }
  });

  it('without the links driving one crease moves only that crease (independent hinges)', () => {
    const s = new RigidKinematicSolver(m, undefined, { enforceMV: true, useSymmetryLinks: false });
    const d = m.edu.defaultDrive!;
    s.setDrivingCrease(d.edge, d.angle);
    expect(s.solve().success).toBe(true);
    for (const e of creases) if (e.id !== d.edge) expect(Math.abs(s.rho[e.id])).toBeLessThan(1e-6);
  });

  it('energy fold reaches the flat accordion without strain', () => {
    const { s, strain, target } = energyFold(m, ENERGY_PRESETS.paperLike);
    expect(s.diverged).toBe(false);
    expect(strain).toBeLessThan(1e-3);
    const rho = s.foldAngles();
    for (const e of creases) expect(Math.abs(rho[e.id] - target(e.id))).toBeLessThan(2 * DEG);
  });
});

describe('polygonal twist', () => {
  for (const [n, phi] of [[3, 40], [4, 25], [6, 15]]) {
    describe(`n = ${n}, φ = ${phi}°`, () => {
      const m = buildFromRegistry('twist', { n, phi });
      it('every vertex satisfies Kawasaki, Maekawa and the big–little–big / crimp check', () => {
        const centre = m.edu.highlightVertices!;
        expect(centre.length).toBe(n);
        for (const v of centre) {
          const r = analyzeVertex(m, v);
          expect(r.sectors.length).toBe(4);
          expect(r.kawasaki.satisfied).toBe(true);
          expect(r.maekawa.satisfied).toBe(true);
          expect(r.mvCheck!.valid).toBe(true);
        }
        expect(localFlatFoldable(m)).toBe(true);
      });
      it('the flat-folded state (±180°) closes exactly', () => {
        expect(new RigidKinematicSolver(m).closureResidual(stateRho(m))).toBeLessThan(1e-12);
      });
      it('is NOT rigid-foldable with its assignment: the rigid solver cannot leave the unfolded state', () => {
        const s = new RigidKinematicSolver(m, undefined, { enforceMV: true });
        s.setDrivingCrease(m.edu.defaultDrive!.edge, m.edu.defaultDrive!.angle);
        const r = s.solve();
        expect(r.success).toBe(false);
        expect(r.reasons.some((x) => x.includes('M/V'))).toBe(true);
      });
      it('energy model with bendable, nearly inextensible facets folds it all the way flat', () => {
        const { s, target } = energyFold(m, { ...ENERGY_PRESETS.veryFlexible, kAxial: 200 }, 40);
        expect(s.diverged).toBe(false);
        const rho = s.foldAngles();
        for (const e of m.edges) if (e.faces[1] >= 0) expect(Math.abs(rho[e.id] - target(e.id))).toBeLessThan(1 * DEG);
        expect(Math.max(...Array.from(s.strains(), Math.abs))).toBeLessThan(1e-3);
      });
    });
  }
  it('n = 4 reproduces the square twist exactly', () => {
    const a = buildFromRegistry('twist', { n: 4, phi: 25, L: 1.6 });
    const b = buildFromRegistry('squareTwist', { phi: 25, L: 1.6 });
    const key = (m: OrigamiModel) => m.edges.filter((e) => e.faces[1] >= 0).map((e) => {
      const [p, q] = e.vertices.map((v) => m.vertices[v].initialPosition2D.map((x) => x.toFixed(9)).join(',')).sort();
      return `${p}|${q}|${e.assignment}`;
    }).sort();
    expect(key(a)).toEqual(key(b));
  });
  it('n = 3 clamps φ to ≥ 30° (below it big–little–big would fail around the triangle)', () => {
    const m = buildFromRegistry('twist', { n: 3, phi: 10 });
    expect(m.params.phiDeg).toBeCloseTo(30, 9);
    expect(localFlatFoldable(m)).toBe(true);
  });
});

describe('hypar (pleated hyperbolic paraboloid)', () => {
  const R = 6, L = 2;
  const m = buildFromRegistry('hypar', { rings: R, L, variant: 'classic' });
  const r = (k: number) => (k * L) / (R + 1);

  it('squares alternate M/V and the diagonal segments alternate too (segment in ring j = square j)', () => {
    for (let k = 1; k <= R; k++) {
      const sq = creaseOf(m, [r(k), r(k)], [-r(k), r(k)]).assignment;
      expect(sq).toBe(k % 2 === 1 ? 'V' : 'M');
      expect(creaseOf(m, [r(k), r(k)], [r(k + 1), r(k + 1)]).assignment).toBe(sq);
      expect(creaseOf(m, [-r(k), r(k)], [-r(k + 1), r(k + 1)]).assignment).toBe(sq);
    }
    expect(creaseOf(m, [0, 0], [r(1), r(1)]).assignment).toBe('M'); // opposite to square 1
  });

  it('every square corner is locally flat-foldable; the centre (4 equal creases) violates Maekawa', () => {
    const centre = m.vertices.find((v) => v.initialPosition2D[0] === 0 && v.initialPosition2D[1] === 0)!.id;
    expect(localFlatFoldable(m, [centre])).toBe(true);
    const c = analyzeVertex(m, centre);
    expect(c.kawasaki.satisfied).toBe(true);
    expect(c.maekawa.satisfied).toBe(false);
  });

  it('the classic pattern has no rigid folding (Demaine et al. 2011): the drive locks at once', () => {
    const s = new RigidKinematicSolver(m, undefined, { enforceMV: true });
    s.setDrivingCrease(m.edu.defaultDrive!.edge, m.edu.defaultDrive!.angle);
    const res = s.solve();
    expect(res.success).toBe(false);
    expect(Math.abs(s.rho[m.edu.defaultDrive!.edge])).toBeLessThan(1 * DEG);
  });

  const saddle = (mm: OrigamiModel, x: Float64Array) => {
    const g = mm.edu.groups!;
    const z = (v: number) => x[3 * v + 2];
    const zc = z(g.diagonalA[0]);
    const end = (a: number[]) => (z(a[a.length - 1]) + z(a[a.length - 2])) / 2 - zc;
    return { zA: end(g.diagonalA), zB: end(g.diagonalB) };
  };

  it('energy fold of every crease relaxes, without divergence, into a saddle (diagonals curve oppositely)', () => {
    for (const params of [ENERGY_PRESETS.paperLike, { ...ENERGY_PRESETS.paperLike, kAxial: 200 }]) {
      const { s, res, strain } = energyFold(m, params);
      expect(s.diverged).toBe(false);
      expect(res.converged).toBe(true);
      expect(s.x.every(Number.isFinite)).toBe(true);
      const { zA, zB } = saddle(m, s.x);
      expect(zA * zB).toBeLessThan(0);
      expect(Math.min(Math.abs(zA), Math.abs(zB))).toBeGreaterThan(0.1 * L);
      expect(detectCollisions(s.x, m.faces.flatMap((f) => f.triangles)).count).toBe(0);
      // the facets MUST deform (Thm 18); the strain is the bar-and-hinge penalty and scales ~1/k_axial
      expect(strain).toBeLessThan(params.kAxial >= 200 ? 0.05 : 0.15);
    }
  });

  describe('triangulated variant (Demaine et al. Thm 19)', () => {
    const t = buildFromRegistry('hypar', { rings: R, L, variant: 'triangulated' });
    it('symmetry links relate creases of equal assignment', () => {
      expect(t.edu.symmetryLinks.length).toBeGreaterThan(0);
      for (const l of t.edu.symmetryLinks) expect(t.edges[l.a].assignment).toBe(t.edges[l.b].assignment);
    });
    it('is a 1-DoF rigid mechanism: one drive folds it from flat to 170° respecting M/V', () => {
      const s = new RigidKinematicSolver(t, undefined, { enforceMV: true });
      const d = t.edu.defaultDrive!;
      const sg = Math.sign(d.angle);
      for (const deg of [10, 60, 120, 170]) {
        s.setDrivingCrease(d.edge, sg * deg * DEG);
        const res = s.solve();
        expect(res.success).toBe(true);
        expect(s.closureResidual()).toBeLessThan(1e-8);
        expect(s.analyze().dofLocal).toBe(1);
        for (const e of t.edges) {
          if (e.assignment === 'M') expect(s.rho[e.id]).toBeLessThanOrEqual(1e-6);
          if (e.assignment === 'V') expect(s.rho[e.id]).toBeGreaterThanOrEqual(-1e-6);
        }
      }
      const { zA, zB } = saddle(t, s.positions());
      expect(zA * zB).toBeLessThan(0);
    });
  });
});

describe('waterbomb tube', () => {
  const m = buildFromRegistry('waterbombTube', { n: 6, m: 4, d: 1 });
  it('as built: exact rolled 2n-gon, R = d/(4 sin(π/2n)), L = m·d, meridians folded −π/n', () => {
    const x = new RigidKinematicSolver(m).positions();
    const g = waterbombTubeMetrics(m, x);
    expect(g.R).toBeCloseTo(g.formula.R0, 12);
    expect(g.Rcentre).toBeCloseTo(g.formula.R0, 12);
    expect(g.L).toBeCloseTo(g.formula.L0, 12);
    const folded = m.edges.filter((e) => e.faces[1] >= 0 && Math.abs(e.referenceFoldAngle) > 1e-9);
    // per row: n meridians through base centres (2 segments each) + n corner meridians (1 segment)
    expect(folded.length).toBe(3 * 6 * 4);
    for (const e of folded) expect(e.referenceFoldAngle).toBeCloseTo(-Math.PI / 6, 12);
  });
  it('is a multi-DoF mechanism (rank analysis), so no single drive defines the whole fold', () => {
    expect(new RigidKinematicSolver(m).analyze().dofLocal).toBeGreaterThan(1);
  });
  it('energy fold to its ±120° targets: no divergence, no collision, small strain; R and L both shrink', () => {
    const { s, strain } = energyFold(m, ENERGY_PRESETS.paperLike);
    expect(s.diverged).toBe(false);
    expect(strain).toBeLessThan(0.05);
    expect(detectCollisions(s.x, m.faces.flatMap((f) => f.triangles)).count).toBe(0);
    const g = waterbombTubeMetrics(m, s.x);
    expect(g.R).toBeLessThan(0.85 * g.formula.R0);
    expect(g.L).toBeLessThan(0.8 * g.formula.L0);
  });
});

describe('Kresling second stable state as the folded reference', () => {
  for (const caps of [true, false]) {
    it(`caps = ${caps}: the state closes exactly and keeps a, b, c; the energy fold reaches it`, () => {
      const m = buildFromRegistry('kresling', { caps });
      const st = m.edu.referenceStates![0];
      expect(st.name).toBe('Second stable state');
      const s = new RigidKinematicSolver(m);
      const rho = stateRho(m);
      expect(s.closureResidual(rho)).toBeLessThan(1e-9);
      const x = s.positions(rho);
      for (const e of m.edges) {
        const [a, b] = e.vertices;
        expect(Math.hypot(x[3 * a] - x[3 * b], x[3 * a + 1] - x[3 * b + 1], x[3 * a + 2] - x[3 * b + 2])).toBeCloseTo(e.restLength, 9);
      }
      const P = m.params as Record<string, number>;
      const H2 = kreslingSecondState({ n: P.n, R: P.R, H: P.H, phi: P.phiDeg * DEG })!.H;
      const zs = (ring: number[]) => ring.reduce((t, v) => t + x[3 * v + 2], 0) / ring.length;
      // with caps the base face is the bottom polygon, so the axis is z (without caps it is tilted)
      if (caps) expect(Math.abs(zs(m.edu.groups!.top) - zs(m.edu.groups!.bottom))).toBeCloseTo(H2 * P.cells, 9);
      const f = energyFold(m, { ...ENERGY_PRESETS.paperLike, kCrease: 0.02, kAxial: 60 });
      expect(f.s.diverged).toBe(false);
      expect(f.strain).toBeLessThan(0.01);
    });
  }
});

describe('whole-pattern fold (what the lesson slider does) works for every generator', () => {
  // rigid: drive the default crease to ±180° (with symmetry links); energy: all creases to the folded target
  const rigid: [string, Record<string, number | string>, number][] = [
    ['singleVertex', {}, 1], ['miura', {}, 1], ['waterbombBase', {}, 1], ['pleat', {}, 1], ['hypar', { variant: 'triangulated' }, 0.9],
  ];
  for (const [g, p, q] of rigid) {
    it(`rigid ${g} ${JSON.stringify(p)} reaches ${q * 180}°`, () => {
      const m = buildFromRegistry(g, p);
      const s = new RigidKinematicSolver(m, undefined, { enforceMV: true, useSymmetryLinks: true });
      const d = m.edu.defaultDrive!;
      const e = m.edges[d.edge];
      const sense = e.assignment === 'M' ? -1 : 1;
      for (let k = 1; k <= 10; k++) {
        s.setDrivingCrease(d.edge, e.referenceFoldAngle + (sense * q * k * Math.PI) / 10);
        expect(s.solve().success).toBe(true);
      }
    });
  }
  const energy: [string, Record<string, number | string>][] = [
    ['shoppingBag', {}], ['waterbomb', {}], ['resch', {}], ['boxpleat', {}], ['kresling', {}], ['hypar', {}], ['waterbombTube', {}], ['twist', {}], ['squareTwist', {}],
  ];
  for (const [g, p] of energy) {
    it(`energy ${g} ${JSON.stringify(p)} relaxes without divergence`, () => {
      const m = buildFromRegistry(g, p);
      const { s } = energyFold(m, ENERGY_PRESETS.paperLike, 10);
      expect(s.diverged).toBe(false);
      expect(s.x.every(Number.isFinite)).toBe(true);
    });
  }
});

describe('parameter labels follow the language', () => {
  afterAll(() => setLang('ko'));
  it('every spec label (and help) is a getter that switches between Korean and English', () => {
    setLang('ko');
    const ko = Object.values(GENERATORS).flatMap((g) => g.specs.map((s) => s.label));
    setLang('en');
    const en = Object.values(GENERATORS).flatMap((g) => g.specs.map((s) => s.label));
    expect(ko.every((s) => /[가-힣]/.test(s))).toBe(true);
    expect(en.every((s) => s.length > 0 && !/[가-힣]/.test(s))).toBe(true);
    expect(GENERATORS.miura.specs[0].label).toBe('Panel rows');
    setLang('ko');
    expect(GENERATORS.miura.specs[0].label).toBe('패널 행 수');
    expect(GENERATORS.twist.specs.find((s) => s.key === 'phi')!.help).toMatch(/30°/);
  });
  it('defaults of the existing generators are unchanged by the new length parameters', () => {
    expect(GENERATORS.waterbomb.defaults).toEqual({ cols: 4, rows: 4, d: 1 });
    expect(GENERATORS.resch.defaults).toEqual({ m: 3, n: 2, variant: 'valid', s: 1 });
    expect(GENERATORS.boxpleat.defaults).toEqual({ n: 4, preset: 'tray', size: 1 });
    expect(GENERATORS.squareTwist.defaults).toEqual({ phi: 25, h: 0.5, L: 1.6 });
    expect(GENERATORS.waterbombBase.defaults).toEqual({ size: 2 });
    expect(GENERATORS.singleVertex.defaults).toEqual({ sectors: '70,100,110,80', mv: 'V,M,V,V', radius: 1 });
  });
});
