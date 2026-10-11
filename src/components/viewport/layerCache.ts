import type { OrigamiModel } from '../../core/topology/types';
import { LayerTracker } from '../../core/solver/collision/layers';
import { engine } from '../../state/engine';

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
    c.version = engine.version;
  }
  return c;
}
