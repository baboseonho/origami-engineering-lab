import type { OrigamiModel } from '../topology/types';
import type { FoldFile } from './foldTypes';

/**
 * Export to FOLD. `vertices_coords` holds the crease-pattern (2D) coordinates
 * so other tools see the unfolded pattern; a folded frame with the current
 * 3D positions is added when `positions` is supplied. edges_foldAngle is in
 * DEGREES with FOLD's sign convention (valley positive), which coincides
 * with this app's rho convention.
 */
export function exportFold(model: OrigamiModel, foldAngles?: Float64Array, positions?: Float64Array): FoldFile {
  const f: FoldFile = {
    file_spec: 1.1,
    file_creator: 'Origami BaBolaB',
    file_classes: ['singleModel'],
    frame_title: model.metadata.name,
    frame_classes: ['creasePattern'],
    frame_attributes: ['2D'],
    frame_unit: 'unit',
    vertices_coords: model.vertices.map((v) => [v.initialPosition2D[0], v.initialPosition2D[1]]),
    edges_vertices: model.edges.map((e) => [e.vertices[0], e.vertices[1]]),
    edges_assignment: model.edges.map((e) => e.assignment),
    edges_foldAngle: model.edges.map((e) => (e.faces[1] < 0 ? null : +(((foldAngles ? foldAngles[e.id] : e.referenceFoldAngle) * 180) / Math.PI).toFixed(9))),
    faces_vertices: model.faces.map((fa) => [...fa.vertices]),
    'oel:params': model.params,
    'oel:creaseLabels': Object.fromEntries(Object.entries(model.edu.creaseLabels).map(([k, v]) => [k, v])),
  };
  if (!model.metadata.developable || model.vertices.some((v) => Math.abs(v.referencePosition[2]) > 1e-12)) {
    f['oel:referenceCoords3D'] = model.vertices.map((v) => [...v.referencePosition]);
  }
  if (positions) {
    f.file_frames = [
      {
        frame_classes: ['foldedForm'],
        frame_attributes: ['3D'],
        frame_title: 'current configuration',
        vertices_coords: model.vertices.map((_, i) => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]]),
      },
    ];
  }
  return f;
}
