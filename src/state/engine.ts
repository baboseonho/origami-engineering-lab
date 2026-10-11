/**
 * Non-React holder for solver instances and the high-frequency position
 * buffer. React components read `engine.positions` inside render loops
 * (useFrame) using `engine.version` to detect changes, so per-frame solver
 * output never triggers React re-renders.
 */
import { RigidKinematicSolver } from '../core/solver/rigid/RigidKinematicSolver';
import { EnergySolver } from '../core/solver/energy/EnergySolver';
import type { OrigamiModel } from '../core/topology/types';

class Engine {
  model: OrigamiModel | null = null;
  rigid: RigidKinematicSolver | null = null;
  energy: EnergySolver | null = null;
  positions: Float64Array = new Float64Array(0);
  /** per-triangle collision flags (triangles in face order) */
  triangleHit: Uint8Array = new Uint8Array(0);
  /** per-vertex scalar for colour overlays (strain etc.) */
  vertexScalar: Float64Array | null = null;
  version = 0;
  listeners = new Set<() => void>();

  setPositions(p: Float64Array) {
    this.positions = p;
    this.version++;
    for (const l of this.listeners) l();
  }
}

export const engine = new Engine();
