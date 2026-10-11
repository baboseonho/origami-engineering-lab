import { buildModel, edgeKey } from '../topology/build';
import type { Assignment, OrigamiModel } from '../topology/types';
import type { Vec2, Vec3 } from '../geometry/vectors';
import type { FoldFile } from './foldTypes';

const ASSIGN: Record<string, Assignment> = { M: 'M', V: 'V', F: 'F', B: 'B', U: 'U', C: 'B', J: 'F' };

/**
 * Import a FOLD crease pattern. Requires faces_vertices (FOLD files without
 * faces would need planar-graph face extraction, not implemented: reported
 * as an error instead of guessing).
 */
export function importFold(f: FoldFile, name = 'Imported FOLD'): { model: OrigamiModel; foldAngles: Float64Array | null } {
  if (!Array.isArray(f.vertices_coords) || !Array.isArray(f.edges_vertices)) throw new Error('FOLD: vertices_coords and edges_vertices are required');
  if (!Array.isArray(f.faces_vertices)) throw new Error('FOLD: faces_vertices is required (face extraction from edges is not yet supported)');
  const coords2D: Vec2[] = f.vertices_coords.map((c) => [c[0] ?? 0, c[1] ?? 0]);
  const ref3D = f['oel:referenceCoords3D'] as number[][] | undefined;
  const assignment: Record<string, Assignment> = {};
  const angles: Record<string, number> = {};
  f.edges_vertices.forEach(([a, b], i) => {
    const as = f.edges_assignment?.[i];
    if (as) assignment[edgeKey(a, b)] = ASSIGN[as.toUpperCase()] ?? 'U';
    const fa = f.edges_foldAngle?.[i];
    if (typeof fa === 'number') angles[edgeKey(a, b)] = (fa * Math.PI) / 180;
  });
  const model = buildModel({
    name: (f.frame_title as string) || name,
    description: 'Imported from a FOLD file',
    generator: 'fold',
    coords2D,
    ref3D: ref3D ? ref3D.map((p) => [p[0], p[1], p[2] ?? 0] as Vec3) : undefined,
    faces: f.faces_vertices,
    assignment,
    params: (f['oel:params'] as Record<string, number | string | boolean>) ?? {},
  });
  const labels = f['oel:creaseLabels'];
  if (labels) for (const [k, v] of Object.entries(labels)) model.edu.creaseLabels[+k] = v;
  let foldAngles: Float64Array | null = null;
  if (f.edges_foldAngle) {
    foldAngles = new Float64Array(model.edges.length);
    for (const e of model.edges) {
      const a = angles[edgeKey(e.vertices[0], e.vertices[1])];
      foldAngles[e.id] = a ?? e.referenceFoldAngle;
    }
  }
  return { model, foldAngles };
}
