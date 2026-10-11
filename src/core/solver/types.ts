import type { OrigamiModel } from '../topology/types';

export type SolverStatus = 'converged' | 'partial' | 'infeasible' | 'idle' | 'diverged';

export interface SolverState {
  positions: Float64Array;
  foldAngles: Float64Array;
  time?: number;
}

export interface SolverResult {
  success: boolean;
  status: SolverStatus;
  iterations: number;
  residualNorm: number;
  jacobianRank?: number;
  conditionEstimate?: number;
  /** For driven solves: the drive angle actually reached */
  reachedAngle?: number;
  requestedAngle?: number;
  message: string;
  reasons: string[];
}

/** Common interface for all solvers (rigid kinematics, energy, analytic). */
export interface OrigamiSolver {
  readonly kind: 'rigid' | 'energy' | 'analytic';
  initialize(model: OrigamiModel, foldAngles?: Float64Array): void;
  setDrivingCrease(id: number | null, targetAngle: number): void;
  step(dt?: number): SolverState;
  solve(): SolverResult;
  reset(): void;
  getState(): SolverState;
}
