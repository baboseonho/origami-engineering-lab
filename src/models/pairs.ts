import { buildFromRegistry } from './registry';
import type { EnergyParams } from '../core/solver/energy/EnergySolver';

/** Kresling and Yoshimura tubes with the same radius, height and polygon (Lecture 5 comparison). */
export function kreslingYoshimuraPair() {
  const k = buildFromRegistry('kresling', { n: 6, R: 1, H: 1.2, phi: 45, cells: 1, chirality: 'right', caps: true });
  const y = buildFromRegistry('yoshimura', { n: 6, R: 1, height: 1.2, rows: 2, variant: 'creased', imperfection: 0, caps: true });
  return { k, y };
}

/** Identical stiffnesses for both tubes. */
export const PAIR_PARAMS: Partial<EnergyParams> = { kAxial: 60, kCrease: 0.02, kFacet: 2 };

/** Largest shortening offered: beyond it the Yoshimura tube folds through itself (no contact model). */
export const PAIR_U_MAX = 0.45;
