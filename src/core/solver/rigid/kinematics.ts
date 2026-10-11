/**
 * Rigid-origami kinematics in fold-angle coordinates.
 *
 * Facets are rigid; each crease e is a revolute joint with signed fold angle
 * rho_e. Positions follow from the angles by walking a spanning tree of the
 * face-adjacency graph from a fixed base facet:
 *
 *     T_child = T_parent ∘ Rot( p_a , s · d̂_e , rho_e − rho⁰_e )
 *
 * where d̂_e is the crease direction in the REFERENCE configuration, p_a a
 * point on it, rho⁰_e the reference fold angle (0 for a flat sheet) and
 * s = +1 when the child face is the LEFT face of e (see angles.ts for the
 * orientation convention; +Δ about d̂ then lifts the left face toward the
 * front side = valley).
 *
 * The same formulation is used by Belcastro & Hull, "Modelling the folding
 * of paper into three dimensions using affine transformations" (Linear
 * Algebra Appl. 2002) and Tachi, "Simulation of rigid origami" (Origami^4,
 * 2009).
 */
import { applyRigid, composeRigid, mul3v, rigidIdentity, rigidRotationAbout, type Rigid } from '../../numerics/linearAlgebra';
import { normalize, sub, type Vec3 } from '../../geometry/vectors';
import { isCrease, type OrigamiModel } from '../../topology/types';

export interface KinematicTree {
  baseFace: number;
  parentFace: Int32Array;
  parentEdge: Int32Array;
  /** +1 if face is the LEFT face of its parent edge */
  sign: Int8Array;
  order: number[];
  /** tree edges from the root to each face */
  pathEdges: number[][];
  /** edges between two faces that are not tree edges (each closes a cycle) */
  nonTree: number[];
  /** connected component id per face (multiple components are supported but unusual) */
  component: Int32Array;
}

export function buildTree(model: OrigamiModel, baseFace = 0): KinematicTree {
  const nF = model.faces.length;
  const parentFace = new Int32Array(nF).fill(-1);
  const parentEdge = new Int32Array(nF).fill(-1);
  const sign = new Int8Array(nF);
  const visited = new Uint8Array(nF);
  const component = new Int32Array(nF).fill(-1);
  const faceEdges: number[][] = model.faces.map(() => []);
  for (const e of model.edges) {
    if (e.faces[1] < 0) continue;
    faceEdges[e.faces[0]].push(e.id);
    faceEdges[e.faces[1]].push(e.id);
  }
  const order: number[] = [];
  const treeEdge = new Uint8Array(model.edges.length);
  let comp = 0;
  const roots = [baseFace, ...model.faces.map((f) => f.id).filter((f) => f !== baseFace)];
  for (const root of roots) {
    if (visited[root]) continue;
    visited[root] = 1;
    component[root] = comp;
    const queue = [root];
    while (queue.length) {
      const f = queue.shift()!;
      order.push(f);
      for (const eid of faceEdges[f]) {
        const e = model.edges[eid];
        const other = e.faces[0] === f ? e.faces[1] : e.faces[0];
        if (visited[other]) continue;
        visited[other] = 1;
        component[other] = comp;
        parentFace[other] = f;
        parentEdge[other] = eid;
        sign[other] = e.faces[0] === other ? 1 : -1;
        treeEdge[eid] = 1;
        queue.push(other);
      }
    }
    comp++;
  }
  const pathEdges: number[][] = new Array(nF);
  for (const f of order) {
    const p = parentFace[f];
    pathEdges[f] = p < 0 ? [] : [...pathEdges[p], parentEdge[f]];
  }
  const nonTree = model.edges.filter((e) => e.faces[1] >= 0 && !treeEdge[e.id]).map((e) => e.id);
  return { baseFace, parentFace, parentEdge, sign, order, pathEdges, nonTree, component };
}

/** Fold-angle variable bookkeeping: only M/V/U creases between two faces fold. */
export interface VariableMap {
  varOfEdge: Int32Array;
  edgeOfVar: number[];
}
export function buildVariables(model: OrigamiModel): VariableMap {
  const varOfEdge = new Int32Array(model.edges.length).fill(-1);
  const edgeOfVar: number[] = [];
  for (const e of model.edges) {
    if (e.faces[1] >= 0 && isCrease(e.assignment)) {
      varOfEdge[e.id] = edgeOfVar.length;
      edgeOfVar.push(e.id);
    }
  }
  return { varOfEdge, edgeOfVar };
}

export const refAxis = (model: OrigamiModel, eid: number): Vec3 => {
  const e = model.edges[eid];
  return normalize(sub(model.vertices[e.vertices[1]].referencePosition, model.vertices[e.vertices[0]].referencePosition));
};

export interface FaceTransforms {
  T: Rigid[];
  /** world twist axis / point for each tree edge (indexed by edge id; undefined otherwise) */
  twistAxis: (Vec3 | undefined)[];
  twistPoint: (Vec3 | undefined)[];
}

/** Compute every face's rigid transform from the per-edge fold angles. */
export function faceTransforms(model: OrigamiModel, tree: KinematicTree, rho: Float64Array): FaceTransforms {
  const T: Rigid[] = new Array(model.faces.length);
  const twistAxis: (Vec3 | undefined)[] = new Array(model.edges.length);
  const twistPoint: (Vec3 | undefined)[] = new Array(model.edges.length);
  for (const f of tree.order) {
    const p = tree.parentFace[f];
    if (p < 0) { T[f] = rigidIdentity(); continue; }
    const eid = tree.parentEdge[f];
    const e = model.edges[eid];
    const s = tree.sign[f];
    const d = refAxis(model, eid);
    const axis: Vec3 = [s * d[0], s * d[1], s * d[2]];
    const pa = model.vertices[e.vertices[0]].referencePosition;
    const delta = rho[eid] - e.referenceFoldAngle;
    T[f] = composeRigid(T[p], rigidRotationAbout(pa, axis, delta));
    twistAxis[eid] = mul3v(T[p].R, axis);
    twistPoint[eid] = applyRigid(T[p], pa);
  }
  return { T, twistAxis, twistPoint };
}

/**
 * Vertex positions: average of the images from all incident faces. The
 * spread between those images is a direct geometric measure of how far the
 * fold angles are from a compatible (closed) configuration.
 */
export function positionsFromTransforms(model: OrigamiModel, T: Rigid[]): { positions: Float64Array; maxSpread: number } {
  const n = model.vertices.length;
  const pos = new Float64Array(3 * n);
  const cnt = new Float64Array(n);
  const imgs: Vec3[][] = model.vertices.map(() => []);
  for (const f of model.faces) {
    const Tf = T[f.id];
    if (!Tf) continue;
    for (const v of f.vertices) {
      const q = applyRigid(Tf, model.vertices[v].referencePosition);
      imgs[v].push(q);
      pos[3 * v] += q[0]; pos[3 * v + 1] += q[1]; pos[3 * v + 2] += q[2];
      cnt[v]++;
    }
  }
  let maxSpread = 0;
  for (let v = 0; v < n; v++) {
    if (cnt[v] === 0) continue;
    pos[3 * v] /= cnt[v]; pos[3 * v + 1] /= cnt[v]; pos[3 * v + 2] /= cnt[v];
    for (const q of imgs[v]) {
      const d = Math.hypot(q[0] - pos[3 * v], q[1] - pos[3 * v + 1], q[2] - pos[3 * v + 2]);
      if (d > maxSpread) maxSpread = d;
    }
  }
  return { positions: pos, maxSpread };
}
