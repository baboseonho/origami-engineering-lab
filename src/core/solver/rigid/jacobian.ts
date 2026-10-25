/**
 * Dense assembly of the compatibility Jacobian and rank / DoF analysis.
 *
 * Lecture estimate:   DoF ≥ N − 3M   (N creases, M interior vertices)
 * with equality only when the 3M vertex-closure equations are independent.
 * The numerically meaningful local quantity is
 *     DoF_local = N − rank J(q)
 * (dimension of the space of first-order fold-angle velocities that keep
 * every loop closed). At singular configurations (e.g. the flat state, where
 * every crease direction lies in one plane) rank J drops and DoF_local
 * over-estimates the finite mobility.
 */
import { numericalRank, zeros, type Mat, type RankInfo } from '../../numerics/linearAlgebra';
import type { EvaluatedBlock, RigidSystem } from './constraints';
import { tr } from '../../../i18n';

export function assembleDense(blocks: EvaluatedBlock[], nVar: number, filter?: (b: EvaluatedBlock) => boolean): Mat {
  const use = filter ? blocks.filter(filter) : blocks;
  const rows = use.reduce((s, b) => s + b.rows, 0);
  const M = zeros(rows, nVar);
  let r0 = 0;
  for (const b of use) {
    const nc = b.cols.length;
    for (let i = 0; i < b.rows; i++)
      for (let c = 0; c < nc; c++) M.data[(r0 + i) * nVar + b.cols[c]] += b.J[i * nc + c];
    r0 += b.rows;
  }
  return M;
}

export interface DofAnalysis {
  N: number;
  M: number;
  NMinus3M: number;
  /** rank of the vertex-closure Jacobian (3M independent rows at most) */
  vertexRank: RankInfo;
  /** rank including global loop closure (tubes) */
  fullRank: RankInfo;
  dofLocal: number;
  usesLoops: boolean;
  redundantVertexConstraints: number;
  warnings: string[];
}

export function analyzeDof(sys: RigidSystem, blocks: EvaluatedBlock[]): DofAnalysis {
  const N = sys.vars.edgeOfVar.length;
  const M = sys.interiorVertices.length;
  const vJ = assembleDense(blocks, N, (b) => b.def.kind === 'vertex');
  const vertexRank = numericalRank(vJ);
  const fullRank = sys.usesLoops ? numericalRank(assembleDense(blocks, N)) : vertexRank;
  const dofLocal = N - fullRank.rank;
  const warnings: string[] = [];
  const naive = N - 3 * M;
  const redundant = 3 * M - vertexRank.rank;
  if (naive < 0) warnings.push(tr(
    `N − 3M = ${naive} 은 음수다. 이는 음의 이동성이 아니라 중복 구속을 뜻한다 (rank J = ${fullRank.rank} < 3M = ${3 * M}).`,
    `N − 3M = ${naive} is negative. This means redundant constraints, not negative mobility (rank J = ${fullRank.rank} < 3M = ${3 * M}).`,
  ));
  if (redundant > 0 && naive >= 0) warnings.push(tr(
    `꼭짓점 구속 ${redundant}개가 중복되어, 실제 국소 자유도(${dofLocal})가 N − 3M(${naive})보다 크다.`,
    `${redundant} vertex constraints are redundant, so the actual local DoF (${dofLocal}) is larger than N − 3M (${naive}).`,
  ));
  if (dofLocal !== naive && naive >= 0 && redundant === 0 && sys.usesLoops) warnings.push(tr(
    '원통의 전역 루프 폐합 조건이 N − 3M 계산에 포함되지 않는 구속을 추가한다.',
    'The global loop-closure condition of the cylinder adds constraints that the N − 3M count leaves out.',
  ));
  if (fullRank.rank > 0 && fullRank.condition > 1e6) warnings.push(tr(
    `특이 배치에 가깝다: 조건수 κ ≈ ${fullRank.condition.toExponential(1)}.`,
    `Close to a singular configuration: condition number κ ≈ ${fullRank.condition.toExponential(1)}.`,
  ));
  return { N, M, NMinus3M: naive, vertexRank, fullRank, dofLocal, usesLoops: sys.usesLoops, redundantVertexConstraints: redundant, warnings };
}
