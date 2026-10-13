import { create } from 'zustand';
import type { SolverResult } from '../core/solver/types';
import type { DofAnalysis } from '../core/solver/rigid/jacobian';
import { ENERGY_PRESETS, type EnergyBreakdown, type EnergyParams } from '../core/solver/energy/EnergySolver';
import type { SweepSample } from '../core/analysis/experiments';

export type CreaseRest = 'current' | 'reference' | 'foldAll';

export interface ExperimentState {
  kind: 'kreslingAxial' | 'yoshimuraCompression' | 'bagCollapse';
  running: boolean;
  samples: SweepSample[];
  index: number;
  total: number;
  error?: string;
}

export interface SimState {
  solverMode: 'rigid' | 'energy';
  rho: Float64Array;
  drive: number | null;
  target: number;
  locked: number[];
  enforceMV: boolean;
  useSymmetry: boolean;
  result: SolverResult | null;
  dof: DofAnalysis | null;
  effect: { edge: number; before: number; after: number }[];
  residualHistory: number[];
  energyParams: EnergyParams;
  energyPreset: keyof typeof ENERGY_PRESETS | 'custom';
  creaseRest: CreaseRest;
  foldPercent: number;
  /** radial grading of the fold-all targets: pct(r) = p·max(0, 1 + g(r − ½)), r = normalised distance from the pattern centre */
  foldGrade: number;
  playing: boolean;
  energy: EnergyBreakdown | null;
  energyHistory: { t: number; total: number; axial: number; crease: number; facet: number; kinetic: number }[];
  maxStrain: number;
  /** fold-to-state progress (0 = reference / open, 1 = the model's flat reference state) */
  stateFold: number;
  /** largest axial strain met along the current pattern-fold path (energy) */
  stateFoldPeak: number;
  maxFacetBending: number;
  collisionCount: number;
  paperDefect: number;
  coarseDefects: [number, number][];
  sweep: { edge: number; drive: number[]; rho: Float64Array[]; dims: { W: number; L: number; T: number }[] } | null;
  experiment: ExperimentState | null;
  shownState: string | null;
  diverged: boolean;
}

export const useSim = create<SimState>(() => ({
  solverMode: 'rigid',
  rho: new Float64Array(0),
  drive: null,
  target: 0,
  locked: [],
  enforceMV: true,
  useSymmetry: false,
  result: null,
  dof: null,
  effect: [],
  residualHistory: [],
  energyParams: { ...ENERGY_PRESETS.paperLike },
  energyPreset: 'paperLike',
  creaseRest: 'current',
  foldPercent: 0.6,
  foldGrade: 0,
  playing: false,
  energy: null,
  energyHistory: [],
  maxStrain: 0,
  stateFold: 0,
  stateFoldPeak: 0,
  maxFacetBending: 0,
  collisionCount: 0,
  paperDefect: 0,
  coarseDefects: [],
  sweep: null,
  experiment: null,
  shownState: null,
  diverged: false,
}));
