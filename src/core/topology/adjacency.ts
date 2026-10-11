import { cornerAngle } from './build';
import type { OrigamiModel } from './types';

export interface VertexStar {
  vertex: number;
  interior: boolean;
  /** Incident edges in counter-clockwise order (viewed from the front side). */
  edges: number[];
  /** sectors[i] = sector angle between edges[i] and edges[i+1] (face corner angle). */
  sectors: number[];
  /** faces[i] = face spanning sector i. */
  faces: number[];
}

/** Map from vertex -> incident edge ids. */
export function vertexEdges(model: OrigamiModel): number[][] {
  const out: number[][] = model.vertices.map(() => []);
  for (const e of model.edges) {
    out[e.vertices[0]].push(e.id);
    out[e.vertices[1]].push(e.id);
  }
  return out;
}

export function edgeBetween(model: OrigamiModel, a: number, b: number): number {
  for (const e of model.edges)
    if ((e.vertices[0] === a && e.vertices[1] === b) || (e.vertices[0] === b && e.vertices[1] === a)) return e.id;
  return -1;
}

/**
 * Cyclic (CCW) star of a vertex built by walking across faces. For boundary
 * vertices the walk starts at the boundary so `sectors.length === edges.length - 1`.
 */
export function vertexStar(model: OrigamiModel, v: number, vEdges?: number[][]): VertexStar {
  const ve = vEdges ?? vertexEdges(model);
  const incident = ve[v];
  const findEdge = (a: number, b: number) =>
    incident.find((id) => {
      const e = model.edges[id];
      return (e.vertices[0] === a && e.vertices[1] === b) || (e.vertices[0] === b && e.vertices[1] === a);
    }) ?? -1;
  // corners: for each face containing v -> edge (v,next) leaving CCW, edge (v,prev) closing the corner
  const corners = new Map<number, { out: number; inn: number; ang: number }>();
  for (const f of model.faces) {
    const i = f.vertices.indexOf(v);
    if (i < 0) continue;
    const next = f.vertices[(i + 1) % f.vertices.length];
    const prev = f.vertices[(i + f.vertices.length - 1) % f.vertices.length];
    corners.set(f.id, { out: findEdge(v, next), inn: findEdge(v, prev), ang: cornerAngle(model, f, v) });
  }
  const interior = !model.vertices[v].boundary;
  let start = -1;
  if (!interior) {
    for (const [fid, c] of corners) {
      if (model.edges[c.out].faces[1] === -1) { start = fid; break; }
    }
  }
  if (start < 0) start = corners.keys().next().value ?? -1;
  const edges: number[] = [], sectors: number[] = [], faces: number[] = [];
  let f = start;
  const seen = new Set<number>();
  while (f >= 0 && !seen.has(f)) {
    seen.add(f);
    const c = corners.get(f)!;
    edges.push(c.out);
    sectors.push(c.ang);
    faces.push(f);
    const e = model.edges[c.inn];
    const other = e.faces[0] === f ? e.faces[1] : e.faces[0];
    if (other < 0) { edges.push(c.inn); break; }
    f = other;
  }
  return { vertex: v, interior, edges, sectors, faces };
}

export const interiorVertices = (model: OrigamiModel): number[] =>
  model.vertices.filter((v) => !v.boundary).map((v) => v.id);
