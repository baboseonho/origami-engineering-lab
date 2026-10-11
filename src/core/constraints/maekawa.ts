/**
 * Maekawa–Justin theorem: at a flat-folded (flat sheet) single vertex,
 *     |M − V| = 2.
 * NECESSARY but NOT SUFFICIENT for flat-foldability: the sector angles must
 * also satisfy Kawasaki, and the M/V assignment must survive the local-min
 * (big-little-big) crimp test (see mvAssignment.ts).
 *
 * Sources: J. Maekawa (via K. Kasahara 1987); J. Justin (1986);
 * Demaine & O'Rourke, Geometric Folding Algorithms (2007), Thm 12.2.?.
 */
import type { Assignment } from '../topology/types';

export interface MaekawaReport {
  M: number;
  V: number;
  /** V − M */
  difference: number;
  satisfied: boolean;
  allAssigned: boolean;
}

export function maekawa(assignments: Assignment[]): MaekawaReport {
  let M = 0, V = 0, other = 0;
  for (const a of assignments) {
    if (a === 'M') M++;
    else if (a === 'V') V++;
    else other++;
  }
  return { M, V, difference: V - M, satisfied: other === 0 && Math.abs(M - V) === 2, allAssigned: other === 0 };
}
