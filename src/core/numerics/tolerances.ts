/**
 * Central numerical tolerances. Every epsilon used in the mathematical core
 * should come from here so that robustness behaviour can be tuned in one place.
 */
export const TOL = {
  /** Lengths below this (in model units, typically ~1) are treated as zero. */
  geometry: 1e-12,
  /** Angles (radians) below this are treated as zero. */
  angle: 1e-9,
  /** Display/logic tolerance for theorem checks on sector angles (radians). ~0.01° */
  theoremAngle: 1.75e-4,
  /** Rigid constraint convergence: closure residual norm. */
  constraint: 1e-9,
  /** Residual above which a rigid state is reported as infeasible. */
  constraintFail: 1e-6,
  /** Relative singular-value threshold used for numerical rank. */
  rankRelative: 1e-7,
  /** Absolute singular-value floor for numerical rank. */
  rankAbsolute: 1e-9,
  /** Distance tolerance for collision tests (model units). */
  collision: 1e-7,
  /** Length tolerance for 1D strip logic (crease coordinates). */
  strip: 1e-9,
  /** Maximum single LM step per variable (radians). */
  maxNewtonStep: 0.25,
  /** Maximum drive increment used for continuation (radians, ~1.5°). */
  continuationStep: (1.5 * Math.PI) / 180,
  /** Smallest continuation increment before declaring infeasibility (radians). */
  minContinuationStep: (0.02 * Math.PI) / 180,
} as const;

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
