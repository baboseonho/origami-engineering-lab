import type { OrigamiModel } from '../../core/topology/types';
import { LayerTracker } from '../../core/solver/collision/layers';
import { engine } from '../../state/engine';
import { useSim } from '../../state/simulationStore';

interface LayerState { tracker: LayerTracker; version: number; edgeTris: number[][] }
const cache = new WeakMap<OrigamiModel, LayerState>();

/** Gap drawn between stacked layers, as a fraction of the model size … */
export const LAYER_GAP = 0.0012;
/** … with the whole stack kept within this fraction (a collapsed waterbomb has 100+ layers). */
const STACK_MAX = 0.016;

/** World-space lift per layer level for the current shape (0 when nothing is stacked). */
export function layerLift(model: OrigamiModel, t: LayerTracker): number {
  if (!t.stacked) return 0;
  return model.scale * Math.min(LAYER_GAP, STACK_MAX / Math.max(1, t.maxLevel));
}

/**
 * Layer order of the current shape, shared by the facet mesh and the crease
 * lines (both are lifted by the same amount so a crease stays on its layer).
 * Updated at most once per engine version.
 */
export function layersFor(model: OrigamiModel): LayerState {
  let c = cache.get(model);
  if (!c) {
    const tris = model.faces.flatMap((f) => f.triangles);
    const tracker = new LayerTracker();
    tracker.reset(tris);
    const edgeTris = model.edges.map((e) => {
      const out: number[] = [];
      tris.forEach((t, i) => { if (t.includes(e.vertices[0]) && t.includes(e.vertices[1])) out.push(i); });
      return out;
    });
    c = { tracker, version: -1, edgeTris };
    cache.set(model, c);
  }
  if (c.version !== engine.version && engine.positions.length === model.vertices.length * 3) {
    c.tracker.update(engine.positions, model.scale);
    // Layers in contact whose order was never seen (a flat state shown or loaded directly):
    // look at the same fold slightly unfolded, where the layers stand apart, and read the order there.
    if (c.tracker.unrecorded > 0 && engine.rigid) {
      const s = useSim.getState();
      const rho = s.solverMode === 'energy' && engine.energy ? engine.energy.foldAngles() : s.shownState ? s.rho : engine.rigid.rho;
      for (const k of [0.8, 0.9, 0.96, 0.98, 0.99, 0.995]) {
        const pre = new Float64Array(rho.length);
        model.edges.forEach((e) => { pre[e.id] = e.referenceFoldAngle + k * ((rho[e.id] ?? e.referenceFoldAngle) - e.referenceFoldAngle); });
        c.tracker.update(engine.rigid.positions(pre), model.scale);
      }
      c.tracker.update(engine.positions, model.scale);
    }
    c.version = engine.version;
  }
  return c;
}
