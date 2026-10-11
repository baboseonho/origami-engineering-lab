import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export interface SingleVertexParams {
  /** sector angles in radians, θ1..θn (sum should be 2π for a flat sheet) */
  sectors: number[];
  assignment: ('M' | 'V')[];
  radius?: number;
}

/**
 * Flat single-vertex disk: centre vertex 0, n crease rays, boundary arc
 * subdivided so every facet is convex. Ray i starts at angle Σ_{k<i} θk.
 */
export function singleVertex(p: SingleVertexParams): OrigamiModel {
  const R = p.radius ?? 1;
  const n = p.sectors.length;
  const coords: Vec2[] = [[0, 0]];
  const rayVertex: number[] = [];
  const faces: number[][] = [];
  const assign: Record<string, Assignment> = {};
  let ang = 0;
  const angles: number[] = [];
  for (let i = 0; i < n; i++) { angles.push(ang); ang += p.sectors[i]; }
  for (let i = 0; i < n; i++) {
    rayVertex.push(coords.length);
    coords.push([R * Math.cos(angles[i]), R * Math.sin(angles[i])]);
  }
  for (let i = 0; i < n; i++) {
    const a0 = angles[i], th = p.sectors[i];
    const sub = Math.max(1, Math.ceil(th / (Math.PI / 4)));
    const face = [0, rayVertex[i]];
    for (let k = 1; k < sub; k++) {
      face.push(coords.length);
      const t = a0 + (th * k) / sub;
      coords.push([R * Math.cos(t), R * Math.sin(t)]);
    }
    face.push(rayVertex[(i + 1) % n]);
    faces.push(face);
    assign[edgeKey(0, rayVertex[i])] = p.assignment[i] ?? 'U';
  }
  const model = buildModel({
    name: `Single vertex (degree ${n})`,
    description: 'Flat single-vertex crease pattern',
    generator: 'singleVertex',
    coords2D: coords,
    faces,
    assignment: assign,
    params: { n, sectorsDeg: p.sectors.map((s) => +(s * 180 / Math.PI).toFixed(4)).join(',') },
  });
  model.edu.creaseLabels = {};
  rayVertex.forEach((v, i) => {
    const e = model.edges.find((ed) => (ed.vertices[0] === 0 && ed.vertices[1] === v) || (ed.vertices[1] === 0 && ed.vertices[0] === v));
    if (e) model.edu.creaseLabels[e.id] = `ρ${i + 1}`;
  });
  model.edu.highlightVertices = [0];
  const firstCrease = Object.keys(model.edu.creaseLabels).map(Number)[0];
  if (firstCrease !== undefined) model.edu.defaultDrive = { edge: firstCrease, angle: ((model.edges[firstCrease].assignment === 'M' ? -60 : 60) * Math.PI) / 180 };
  return model;
}
