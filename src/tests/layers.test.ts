import { describe, expect, it } from 'vitest';
import { buildFromRegistry } from '../models/registry';
import { RigidKinematicSolver } from '../core/solver/rigid/RigidKinematicSolver';
import { EnergySolver, ENERGY_PRESETS } from '../core/solver/energy/EnergySolver';
import { detectCollisions } from '../core/solver/collision/collision';
import { LayerTracker } from '../core/solver/collision/layers';

describe('flat-folded states: contact is not collision, layers follow the fold', () => {
  it('Miura 5×5 folds flat rigidly without collisions, in a few layers', () => {
    const m = buildFromRegistry('miura', { rows: 5, cols: 5 });
    const s = new RigidKinematicSolver(m, undefined, { enforceMV: true, useSymmetryLinks: false });
    const d = m.edu.defaultDrive!.edge;
    const sg = m.edges[d].assignment === 'M' ? -1 : 1;
    const tris = m.faces.flatMap((f) => f.triangles);
    const L = new LayerTracker();
    L.reset(tris);
    for (let k = 1; k <= 40; k++) {
      s.setDrivingCrease(d, (sg * k * Math.PI) / 40);
      expect(s.solve().success).toBe(true);
      const x = s.positions();
      L.update(x, m.scale);
      expect(detectCollisions(x, tris).count).toBe(0);
    }
    expect(L.stacked).toBe(true);
    expect(L.maxLevel).toBeGreaterThan(0);
    expect(L.maxLevel).toBeLessThan(12);
  });

  it('waterbomb 3×3 folds flat (energy) without collisions', () => {
    const m = buildFromRegistry('waterbomb', { rows: 3, cols: 3 });
    const s = new EnergySolver(m, ENERGY_PRESETS.paperLike);
    s.fixVertices(m.faces[m.edu.baseFace ?? 0].vertices, 7);
    const tris = m.faces.flatMap((f) => f.triangles);
    const L = new LayerTracker();
    L.reset(tris);
    for (let k = 1; k <= 20; k++) {
      const p = k / 20;
      s.setCreaseTargets((id) => { const e = m.edges[id]; return e.referenceFoldAngle + p * (e.defaultTarget - e.referenceFoldAngle); });
      s.relaxFIRE(6000, 1e-6);
      L.update(s.x, m.scale);
      expect(detectCollisions(s.x, tris).count).toBe(0);
    }
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 2; i < s.x.length; i += 3) { zMin = Math.min(zMin, s.x[i]); zMax = Math.max(zMax, s.x[i]); }
    expect(zMax - zMin).toBeLessThan(1e-3); // flat
    expect(L.stacked).toBe(true);
  });

  it('a facet that really passes through another is still a collision', () => {
    // two triangles crossing each other at right angles
    const x = Float64Array.from([0, 0, 0, 2, 0, 0, 0, 2, 0, /* second */ 0.4, 0.4, -1, 0.4, 0.4, 1, 1.4, 0.4, 0]);
    expect(detectCollisions(x, [[0, 1, 2], [3, 4, 5]]).count).toBe(1);
    // the same pair stacked a hair apart is contact, not collision
    const y = Float64Array.from([0, 0, 0, 2, 0, 0, 0, 2, 0, 0.3, 0.3, 1e-9, 1.3, 0.3, -1e-9, 0.3, 1.3, 1e-9]);
    expect(detectCollisions(y, [[0, 1, 2], [3, 4, 5]]).count).toBe(0);
  });

  it('remembers which layer was on top before the layers met', () => {
    const tris: [number, number, number][] = [[0, 1, 2], [3, 4, 5]];
    const L = new LayerTracker();
    L.reset(tris);
    const at = (z: number) => Float64Array.from([0, 0, 0, 2, 0, 0, 0, 2, 0, 0.2, 0.2, z, 1.2, 0.2, z, 0.2, 1.2, z]);
    L.update(at(-0.05), 2); // second triangle approaches from below
    L.update(at(0), 2); // now coplanar
    expect(L.stacked).toBe(true);
    expect(L.level[0]).toBeGreaterThan(L.level[1]); // first stays on top
  });
});

describe('sheet count of a flat fold', () => {
  it('a 3×3 waterbomb folded flat stacks a plausible number of sheets over one point', () => {
    const m = buildFromRegistry('waterbomb', { rows: 3, cols: 3 });
    const s = new EnergySolver(m, ENERGY_PRESETS.paperLike);
    s.fixVertices(m.faces[m.edu.baseFace ?? 0].vertices, 7);
    const L = new LayerTracker();
    L.reset(m.faces.flatMap((f) => f.triangles));
    for (let k = 1; k <= 20; k++) {
      const p = k / 20;
      s.setCreaseTargets((id) => { const e = m.edges[id]; return e.referenceFoldAngle + p * (e.defaultTarget - e.referenceFoldAngle); });
      s.relaxFIRE(6000, 1e-6);
      L.update(s.x, m.scale);
    }
    // the sheet (area 9 bases) collapses onto a 2 × 0.5 strip: many sheets, but bounded by the facet count
    expect(L.sheetsAtPoint).toBeGreaterThan(4);
    expect(L.sheetsAtPoint).toBeLessThan(m.faces.length);
    console.log('sheetsAtPoint', L.sheetsAtPoint, 'chainDepth', L.maxLevel + 1);
  });
});
