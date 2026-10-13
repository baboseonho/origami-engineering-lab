import { it } from 'vitest';
import { projectToConstraints, panelCrossings, planarity, analyzeSectors, D2R, type V3 } from '../core/analysis/vertexWinding';
it('winding cases in general', () => {
  const list = [[140, 20, 140, 20, 140, 20], [170, 50, 170, 50, 170, 50], [160, 40, 150, 30, 170, 50], [100, 10, 100, 10, 100, 10, 100, 10, 10, 10, 10, 10], [175, 5, 175, 5], [120, 60, 120, 60, 120, 60], [150, 30, 150, 30, 120, 60]];
  for (const th of list) {
    const r = analyzeSectors(th);
    const cosT = th.map((t) => Math.cos(t * D2R));
    let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let exact = 0, free = 0, minCross = 99;
    for (let k = 0; k < 1500; k++) {
      const g = th.map(() => { const z = rnd() * 2 - 1, p = rnd() * 2 * Math.PI, rr = Math.sqrt(1 - z * z); return [rr * Math.cos(p), rr * Math.sin(p), z]; }).flat();
      const pr = projectToConstraints(Float64Array.from(g), cosT, 120);
      if (pr.residual > 1e-10) continue;
      exact++;
      const rays: V3[] = th.map((_, i) => [pr.x[3 * i], pr.x[3 * i + 1], pr.x[3 * i + 2]]);
      const cr = panelCrossings(rays); minCross = Math.min(minCross, cr);
      if (cr === 0 && planarity(rays).lambda > 0.02) free++;
    }
    console.log(`TH [${th}] T=${r.total} S=${r.S}: exact=${exact} crossingFree3D=${free} minCross=${minCross}`);
  }
}, 600000);
