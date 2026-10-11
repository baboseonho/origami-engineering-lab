import { create } from 'zustand';
import type { Assignment, OrigamiModel } from '../core/topology/types';
import type { Params } from '../models/registry';

export interface Snapshot {
  lessonId: string;
  generator: string | null;
  params: Params;
  overrides: Record<number, Assignment>;
  drive: number | null;
  target: number;
  locked: number[];
  rho: Float64Array | null;
  solverMode: 'rigid' | 'energy';
}

export interface ModelState {
  lessonId: string;
  generator: string | null;
  params: Params;
  overrides: Record<number, Assignment>;
  model: OrigamiModel | null;
  modelVersion: number;
  past: Snapshot[];
  future: Snapshot[];
}

export const useModel = create<ModelState>(() => ({
  lessonId: '',
  generator: null,
  params: {},
  overrides: {},
  model: null,
  modelVersion: 0,
  past: [],
  future: [],
}));
