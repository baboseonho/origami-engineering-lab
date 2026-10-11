/// <reference lib="webworker" />
/**
 * Kresling vs Yoshimura lab: both tubes are relaxed off the main thread so the
 * load sliders stay responsive. Solvers persist between requests (warm start).
 */
import { EnergySolver } from '../core/solver/energy/EnergySolver';
import { applyTopDisplacement, relaxFreeTwist } from '../core/analysis/experiments';
import { detectCollisions } from '../core/solver/collision/collision';
import { kreslingYoshimuraPair, PAIR_PARAMS } from '../models/pairs';
import type { OrigamiModel } from '../core/topology/types';

export interface PairRequest { id: number; u: number; twist: number | null }
export interface PairTube { positions: Float64Array; energy: number; twist: number; maxStrain: number; collisions: number; converged: boolean }
export interface PairResponse { id: number; k: PairTube; y: PairTube }

const { k, y } = kreslingYoshimuraPair();
const make = (m: OrigamiModel) => { const s = new EnergySolver(m, PAIR_PARAMS); s.fixVertices(m.edu.groups!.bottom, 7); return { s, m, theta: 0, tris: m.faces.flatMap((f) => f.triangles) }; };
const tubes = { k: make(k), y: make(y) };

function solve(t: ReturnType<typeof make>, u: number, twist: number | null): PairTube {
  let converged: boolean;
  if (twist === null) {
    const q = relaxFreeTwist(t.s, t.m, u, t.theta);
    t.theta = q.theta;
    converged = q.converged;
  } else {
    applyTopDisplacement(t.s, t.m, u, twist);
    converged = t.s.relaxFIRE(6000, 1e-6).converged;
    t.theta = twist;
  }
  let ms = 0;
  for (const v of t.s.strains()) ms = Math.max(ms, Math.abs(v));
  return { positions: new Float64Array(t.s.x), energy: t.s.energy().total, twist: t.theta, maxStrain: ms, collisions: detectCollisions(t.s.x, t.tris).count, converged };
}

self.onmessage = (ev: MessageEvent<PairRequest>) => {
  const { id, u, twist } = ev.data;
  try {
    const res: PairResponse = { id, k: solve(tubes.k, u, twist), y: solve(tubes.y, u, twist) };
    (self as unknown as Worker).postMessage(res);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, error: String(e) });
  }
};
