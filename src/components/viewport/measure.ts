import { useEffect, useState } from 'react';
import type { OrigamiModel } from '../../core/topology/types';
import { vertexEdges, vertexStar } from '../../core/topology/adjacency';
import { engine } from '../../state/engine';

/**
 * Read-only measurements of the current folded state for hover readouts
 * (3D view, crease pattern, projections). Everything reads the live
 * `engine.positions` buffer (model coordinates, z up).
 */

export type P3 = [number, number, number];

/** Current 3D position of a vertex (the reference position until the solver has written one). */
export function pos3(model: OrigamiModel, v: number, x: Float64Array = engine.positions): P3 {
  if (x.length === model.vertices.length * 3) return [x[3 * v], x[3 * v + 1], x[3 * v + 2]];
  return [...model.vertices[v].referencePosition] as P3;
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossP = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotP = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lenP = (a: P3) => Math.hypot(a[0], a[1], a[2]);

/** True 3D length of an edge in the current state. */
export function edgeLength3(model: OrigamiModel, eid: number, x: Float64Array = engine.positions): number {
  const e = model.edges[eid];
  return lenP(sub(pos3(model, e.vertices[1], x), pos3(model, e.vertices[0], x)));
}

/** Newell normal (not normalised; its length is twice the polygon area). */
function newell(pts: P3[]): P3 {
  const n: P3 = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

/** Current unit normal of a face (front side), from its polygon. */
export function faceNormal3(model: OrigamiModel, fid: number, x: Float64Array = engine.positions): P3 {
  const n = newell(model.faces[fid].vertices.map((v) => pos3(model, v, x)));
  const l = lenP(n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/** Current area of a face (sum of its triangles). */
export function faceArea3(model: OrigamiModel, fid: number, x: Float64Array = engine.positions): number {
  let A = 0;
  for (const [a, b, c] of model.faces[fid].triangles) {
    const pa = pos3(model, a, x);
    A += lenP(crossP(sub(pos3(model, b, x), pa), sub(pos3(model, c, x), pa))) / 2;
  }
  return A;
}

/** Current interior corner angles of a face, in its vertex order (radians, reflex corners > π). */
export function faceCorners3(model: OrigamiModel, fid: number, x: Float64Array = engine.positions): number[] {
  const vs = model.faces[fid].vertices;
  const pts = vs.map((v) => pos3(model, v, x));
  const n = faceNormal3(model, fid, x);
  return pts.map((p, i) => {
    const u = sub(pts[(i + 1) % pts.length], p), w = sub(pts[(i + pts.length - 1) % pts.length], p);
    let a = Math.atan2(dotP(crossP(u, w), n), dotP(u, w));
    if (a < 0) a += 2 * Math.PI;
    return a;
  });
}

const starCache = new WeakMap<OrigamiModel, number[][]>();

/** Sector angles θ1…θk around a vertex (in the crease pattern; rigid folding keeps them). */
export function vertexSectors(model: OrigamiModel, v: number): { interior: boolean; sectors: number[] } {
  let ve = starCache.get(model);
  if (!ve) { ve = vertexEdges(model); starCache.set(model, ve); }
  const st = vertexStar(model, v, ve);
  return { interior: st.interior, sectors: st.sectors };
}

/**
 * Re-render at most `hz` times a second while the solver writes new
 * positions (engine.setPositions), so readouts follow the fold without a
 * React render per solver step. Returns the engine version seen last.
 */
export function useEngineVersion(hz = 12, active = true): number {
  const [ver, setVer] = useState(engine.version);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;
    const run = () => { timer = null; lastRun = performance.now(); setVer(engine.version); };
    const l = () => {
      if (timer) return;
      const wait = Math.max(0, 1000 / hz - (performance.now() - lastRun));
      timer = setTimeout(run, wait);
    };
    engine.listeners.add(l);
    l();
    return () => { engine.listeners.delete(l); if (timer) clearTimeout(timer); };
  }, [hz, active]);
  return ver;
}
