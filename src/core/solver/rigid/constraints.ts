/**
 * Kinematic compatibility constraints C(q) = 0 in fold-angle space and their
 * analytic Jacobian, stored block-sparse.
 *
 * VERTEX CLOSURE (one block per interior vertex, Belcastro–Hull / Tachi):
 *   walking counter-clockwise around vertex v and crossing creases
 *   e_1..e_k, the product of rotations about the reference crease axes
 *   must be the identity:
 *       Π_i Rot(s_i d̂_i, Δ_i) = I              (9 residual entries)
 *   with dΠ/dΔ_j = [w_j]× Π,  w_j = P_{j−1} s_j d̂_j  (P = prefix product).
 *   At a closed configuration w_j is the CURRENT crease direction, so the
 *   block has rank ≤ 3: this is the "3 constraints per vertex" of the
 *   lecture's DoF ≥ N − 3M estimate.
 *
 * LOOP CLOSURE (one block per non-tree edge, only when the face graph has
 *   non-contractible cycles, e.g. cylinders / tubes):
 *       T_R ∘ Rot(p_a, d̂_e, Δ_e) − T_L = 0    (9 rotation + 3 translation)
 *   Vertex closures alone cannot see the global loop of a tube.
 *
 * Source: T. Tachi, "Simulation of rigid origami", Origami^4 (2009);
 * S.-M. Belcastro & T. Hull (2002).
 */
import { mul3, mul3v, rotAxis, skew, applyRigid, type Mat3 } from '../../numerics/linearAlgebra';
import { cross, type Vec3 } from '../../geometry/vectors';
import { vertexEdges, vertexStar } from '../../topology/adjacency';
import type { OrigamiModel } from '../../topology/types';
import { buildTree, buildVariables, faceTransforms, refAxis, type KinematicTree, type VariableMap } from './kinematics';

export interface VertexBlockDef {
  kind: 'vertex';
  vertex: number;
  edges: number[];
  /** s_i d̂_i in the reference frame */
  axes: Vec3[];
}
export interface LoopBlockDef {
  kind: 'loop';
  edge: number;
}
export type BlockDef = VertexBlockDef | LoopBlockDef;

export interface EvaluatedBlock {
  def: BlockDef;
  r: Float64Array;
  /** global variable index per column */
  cols: number[];
  /** row-major rows x cols.length */
  J: Float64Array;
  rows: number;
}

export interface RigidSystem {
  model: OrigamiModel;
  tree: KinematicTree;
  vars: VariableMap;
  blocks: BlockDef[];
  interiorVertices: number[];
  usesLoops: boolean;
}

export function buildRigidSystem(model: OrigamiModel, baseFace?: number): RigidSystem {
  const tree = buildTree(model, baseFace ?? model.edu.baseFace ?? 0);
  const vars = buildVariables(model);
  const ve = vertexEdges(model);
  const blocks: BlockDef[] = [];
  const interior: number[] = [];
  for (const v of model.vertices) {
    if (v.boundary) continue;
    const star = vertexStar(model, v.id, ve);
    if (star.edges.length === 0) continue;
    interior.push(v.id);
    // crossing star.edges[i] moves from faces[i-1] into faces[i]
    const axes: Vec3[] = star.edges.map((eid, i) => {
      const e = model.edges[eid];
      const into = star.faces[i];
      const s = e.faces[0] === into ? 1 : -1;
      const d = refAxis(model, eid);
      return [s * d[0], s * d[1], s * d[2]];
    });
    if (star.edges.some((eid) => vars.varOfEdge[eid] >= 0)) blocks.push({ kind: 'vertex', vertex: v.id, edges: star.edges, axes });
  }
  // Non-contractible cycles exist iff there are more independent face cycles than vertex loops.
  // (Disk: nonTree = #interior vertices. Closed sphere: nonTree = #interior − 1. Tube: one more.)
  const usesLoops = tree.nonTree.length > interior.length;
  if (usesLoops) for (const eid of tree.nonTree) blocks.push({ kind: 'loop', edge: eid });
  return { model, tree, vars, blocks, interiorVertices: interior, usesLoops };
}

/** Evaluate all blocks at the per-edge fold angles `rho`. */
export function evaluateBlocks(sys: RigidSystem, rho: Float64Array, withJacobian = true): EvaluatedBlock[] {
  const { model, vars } = sys;
  const out: EvaluatedBlock[] = [];
  const needTransforms = sys.usesLoops;
  const ft = needTransforms ? faceTransforms(model, sys.tree, rho) : null;
  const L = model.scale;

  for (const def of sys.blocks) {
    if (def.kind === 'vertex') {
      const k = def.edges.length;
      const rots: Mat3[] = def.edges.map((eid, i) => rotAxis(def.axes[i], rho[eid] - model.edges[eid].referenceFoldAngle));
      const prefix: Mat3[] = [];
      let P: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      for (let i = 0; i < k; i++) { prefix.push(P); P = mul3(P, rots[i]); }
      const r = new Float64Array(9);
      for (let i = 0; i < 9; i++) r[i] = P[i] - (i % 4 === 0 ? 1 : 0);
      const cols: number[] = [];
      const colData: Mat3[] = [];
      if (withJacobian) {
        for (let i = 0; i < k; i++) {
          const vi = vars.varOfEdge[def.edges[i]];
          if (vi < 0) continue;
          const w = mul3v(prefix[i], def.axes[i]);
          cols.push(vi);
          colData.push(mul3(skew(w), P));
        }
      }
      const J = new Float64Array(9 * cols.length);
      colData.forEach((M, c) => { for (let row = 0; row < 9; row++) J[row * cols.length + c] = M[row]; });
      out.push({ def, r, cols, J, rows: 9 });
    } else {
      const e = model.edges[def.edge];
      const [fl, fr] = e.faces;
      const TL = ft!.T[fl], TR = ft!.T[fr];
      const d = refAxis(model, def.edge);
      const Re = rotAxis(d, rho[def.edge] - e.referenceFoldAngle);
      const RRe = mul3(TR.R, Re);
      const pa = model.vertices[e.vertices[0]].referencePosition;
      const xR = applyRigid(TR, pa), xL = applyRigid(TL, pa);
      const r = new Float64Array(12);
      for (let i = 0; i < 9; i++) r[i] = RRe[i] - TL.R[i];
      for (let i = 0; i < 3; i++) r[9 + i] = (xR[i] - xL[i]) / L;
      const colMap = new Map<number, Float64Array>();
      const addCol = (vi: number) => {
        let c = colMap.get(vi);
        if (!c) { c = new Float64Array(12); colMap.set(vi, c); }
        return c;
      };
      if (withJacobian) {
        const contrib = (path: number[], M: Mat3, x: Vec3, sgn: number) => {
          for (const tj of path) {
            const vi = vars.varOfEdge[tj];
            if (vi < 0) continue;
            const w = ft!.twistAxis[tj]!, a = ft!.twistPoint[tj]!;
            const dM = mul3(skew(w), M);
            const dx = cross(w, [x[0] - a[0], x[1] - a[1], x[2] - a[2]]);
            const c = addCol(vi);
            for (let i = 0; i < 9; i++) c[i] += sgn * dM[i];
            for (let i = 0; i < 3; i++) c[9 + i] += (sgn * dx[i]) / L;
          }
        };
        contrib(sys.tree.pathEdges[fr], RRe, xR, 1);
        contrib(sys.tree.pathEdges[fl], TL.R, xL, -1);
        const ve = vars.varOfEdge[def.edge];
        if (ve >= 0) {
          const wE = mul3v(TR.R, d);
          const dM = mul3(skew(wE), RRe);
          const c = addCol(ve);
          for (let i = 0; i < 9; i++) c[i] += dM[i];
        }
      }
      const cols = [...colMap.keys()];
      const J = new Float64Array(12 * cols.length);
      cols.forEach((vi, ci) => {
        const c = colMap.get(vi)!;
        for (let row = 0; row < 12; row++) J[row * cols.length + ci] = c[row];
      });
      out.push({ def, r, cols, J, rows: 12 });
    }
  }
  return out;
}

export function residualNorm(blocks: EvaluatedBlock[]): number {
  let s = 0;
  for (const b of blocks) for (let i = 0; i < b.r.length; i++) s += b.r[i] * b.r[i];
  return Math.sqrt(s);
}

