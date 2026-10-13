import type { OrigamiModel } from './types';

/**
 * The one name of a crease, used everywhere (inspector, plots, tables): the
 * lecture label (ρ1, ρ2 …) when the lesson gives one, otherwise the edge id.
 */
export function creaseName(model: OrigamiModel, eid: number): string {
  return model.edu.creaseLabels[eid] ?? `e${eid}`;
}
