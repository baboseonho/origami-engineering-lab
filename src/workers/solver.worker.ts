/// <reference lib="webworker" />
/**
 * Off-main-thread quasi-static sweeps. Models are rebuilt from the
 * deterministic generator registry so no geometry is serialised.
 */
import { runAxialSweep, runFoldToSweep, runPrescribedSweep, type AxialSweepConfig, type FoldToSweepConfig, type PrescribedSweepConfig } from '../core/analysis/experiments';
import { buildFromRegistry, type Params } from '../models/registry';
import type { Assignment } from '../core/topology/types';

export type WorkerRequest =
  | { type: 'axial'; id: number; generator: string; params: Params; overrides: Record<number, Assignment>; config: AxialSweepConfig }
  | { type: 'prescribed'; id: number; generator: string; params: Params; overrides: Record<number, Assignment>; config: PrescribedSweepConfig }
  | { type: 'foldTo'; id: number; generator: string; params: Params; overrides: Record<number, Assignment>; config: FoldToSweepConfig };

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    const model = buildFromRegistry(req.generator, req.params);
    for (const [k, a] of Object.entries(req.overrides)) if (model.edges[+k]) model.edges[+k].assignment = a;
    const post = (sample: unknown, k: number) => (self as unknown as Worker).postMessage({ type: 'sample', id: req.id, k, sample });
    if (req.type === 'axial') runAxialSweep(model, req.config, post);
    else if (req.type === 'foldTo') runFoldToSweep(model, req.config, post);
    else runPrescribedSweep(model, req.config, post);
    (self as unknown as Worker).postMessage({ type: 'done', id: req.id });
  } catch (e) {
    (self as unknown as Worker).postMessage({ type: 'error', id: req.id, message: String(e) });
  }
};
