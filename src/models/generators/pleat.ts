import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export interface PleatParams {
  /** number of parallel creases (2..12) */
  n: number;
  /** strip width = crease length (along y) */
  width: number;
  /** pleat depth = spacing between neighbouring creases (along x) */
  depth: number;
}

/**
 * Accordion pleat: a rectangular strip [0, (n+1)·depth] × [0, width] with n
 * parallel creases x = k·depth (k = 1..n), alternating V, M, V, M, …
 *
 * Every crease runs from edge to edge, so there is NO interior vertex: no
 * vertex-closure constraint couples the creases and each crease is an
 * independent revolute joint. Rigid DoF = N − rank J = n − 0 = n.
 *
 * To fold the whole accordion with one slider the creases are coupled by
 * optional symmetry links ρ_k = ±ρ_1 (+ for the same assignment, − for the
 * opposite one), exactly like waterbombBase. With the links on, the rigid
 * solver drives every crease from the default drive; with them off, driving
 * one crease moves only that crease (n independent hinges).
 *
 * Flat-foldability: equal segments with alternating M/V is a 1D pattern that
 * folds flat by repeated crimps (Arkin et al., "When can you fold a map?",
 * 2004); checked in tests with strip1D.solveStrip on the crease positions.
 * At ρ = ±180° on every crease the panels stack exactly (flat-folded state).
 */
export function pleat(p: PleatParams): OrigamiModel {
  const n = Math.max(1, Math.round(p.n));
  const { width: W, depth: d } = p;
  const coords: Vec2[] = [];
  const bot: number[] = [], top: number[] = [];
  for (let k = 0; k <= n + 1; k++) {
    bot.push(coords.length); coords.push([k * d, 0]);
    top.push(coords.length); coords.push([k * d, W]);
  }
  const faces: number[][] = [];
  for (let k = 0; k <= n; k++) faces.push([bot[k], bot[k + 1], top[k + 1], top[k]]);
  const assign: Record<string, Assignment> = {};
  const mvOf = (k: number): Assignment => (k % 2 === 1 ? 'V' : 'M');
  for (let k = 1; k <= n; k++) assign[edgeKey(bot[k], top[k])] = mvOf(k);

  const model = buildModel({
    name: `Accordion pleat (${n} creases)`,
    description: 'Parallel alternating M/V creases: no interior vertex, n independent hinges (DoF = n)',
    generator: 'pleat',
    coords2D: coords,
    faces,
    assignment: assign,
    params: { n, width: W, depth: d },
  });
  const crease = (k: number) => model.edges.find((e) => edgeKey(e.vertices[0], e.vertices[1]) === edgeKey(bot[k], top[k]))!;
  const creases = Array.from({ length: n }, (_, i) => crease(i + 1));
  creases.forEach((e, i) => (model.edu.creaseLabels[e.id] = `ρ${i + 1}`));
  const first = creases[0];
  // one slider for the whole accordion: ρ_k = ±ρ_1 (opposite sign for the opposite assignment)
  model.edu.symmetryLinks = creases.slice(1).map((e) => ({ a: e.id, b: first.id, ratio: e.assignment === first.assignment ? 1 : -1 }));
  model.edu.defaultDrive = { edge: first.id, angle: ((first.assignment === 'M' ? -1 : 1) * 120 * Math.PI) / 180 };
  // fixed middle panel, so the accordion closes symmetrically about it
  model.edu.baseFace = Math.floor(n / 2);
  // no interior vertices: nothing for the vertex inspector (or the derivation overlay) to show
  model.edu.highlightVertices = [];
  const flat: Record<number, number> = {};
  for (const e of creases) flat[e.id] = e.assignment === 'M' ? -Math.PI : Math.PI;
  model.edu.referenceStates = [{ name: 'Flat-folded state', foldAngles: flat }];
  return model;
}
