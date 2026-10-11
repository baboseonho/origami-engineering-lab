import { useMemo } from 'react';
import { analyzeVertex } from '../../core/analysis/metrics';
import type { OrigamiModel } from '../../core/topology/types';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { StatusRow, fmt, type Status } from '../controls/ui';

export interface FlatFoldSummary {
  checked: number;
  failing: number[];
  ok: boolean;
  /** vertices where only Maekawa fails (Kawasaki/generalized ok) */
  maekawaOnly: number[];
}

export function flatFoldSummary(model: OrigamiModel): FlatFoldSummary {
  const failing: number[] = [];
  const maekawaOnly: number[] = [];
  let checked = 0;
  for (const v of model.vertices) {
    if (v.boundary) continue;
    const r = analyzeVertex(model, v.id);
    if (r.edges.length === 0) continue; // vertex inside a flat region (only F creases)
    checked++;
    const geomOk = r.generalized.satisfied;
    const countOk = r.generalizedMaekawa.satisfied;
    const mvOk = r.mvCheck ? r.mvCheck.valid : countOk;
    if (!(geomOk && countOk && mvOk)) failing.push(v.id);
    if (geomOk && !countOk) maekawaOnly.push(v.id);
  }
  return { checked, failing, ok: failing.length === 0 && checked > 0, maekawaOnly };
}

/**
 * Keep the five properties separate — collapsing them into one "valid
 * origami" label would destroy the educational distinction.
 */
export function FeasibilityBoard() {
  const model = useModel((s) => s.model);
  const modelVersion = useModel((s) => s.modelVersion);
  const result = useSim((s) => s.result);
  const dof = useSim((s) => s.dof);
  const collisions = useSim((s) => s.collisionCount);
  const solverMode = useSim((s) => s.solverMode);
  const maxStrain = useSim((s) => s.maxStrain);
  const diverged = useSim((s) => s.diverged);
  const shownState = useSim((s) => s.shownState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ff = useMemo(() => (model ? flatFoldSummary(model) : null), [model, modelVersion]);
  if (!model || !ff) return null;

  const flatStatus: Status = ff.checked === 0 ? 'na' : ff.ok ? 'ok' : 'bad';
  const mobility: Status = solverMode === 'energy' || !dof ? 'na' : dof.dofLocal > 0 ? (result && !result.success && result.reasons.some((r) => r.startsWith('1차 가동성')) ? 'warn' : 'ok') : 'bad';
  const rigidNow: Status = solverMode === 'energy' ? 'na' : shownState ? 'ok' : !result ? (dof ? 'ok' : 'na') : result.success ? 'ok' : 'bad';
  const elastic: Status = solverMode !== 'energy' ? 'na' : diverged ? 'bad' : maxStrain < 0.02 ? 'ok' : maxStrain < 0.08 ? 'warn' : 'bad';
  return (
    <div className="space-y-0.5">
      <StatusRow
        label="평탄 접힘 (꼭짓점 조건)"
        status={flatStatus}
        value={ff.checked ? `${ff.checked - ff.failing.length}/${ff.checked} 꼭짓점` : '내부 꼭짓점 없음'}
        title="모든 내부 꼭짓점에서 Kawasaki/일반화 교대합 + (일반화) Maekawa + 크림프 검사. 전역 평탄 접힘의 필요조건."
      />
      <StatusRow
        label="강체 이동성 (1차)"
        status={mobility}
        value={solverMode === 'energy' ? 'Rigid 모드에서' : dof ? `DoF_local = ${dof.dofLocal}` : '—'}
        title="현재 배치에서 N − rank J. 경고 = 유한 운동으로 이어지지 않는 미소 이동성."
      />
      <StatusRow label="현재 강체 해" status={rigidNow} value={result ? `‖C‖ = ${fmt(result.residualNorm)}` : undefined} />
      <StatusRow label="자기 충돌 없음" status={collisions === 0 ? 'ok' : 'bad'} value={`${collisions}쌍`} />
      <StatusRow label="탄성 해 (Energy)" status={elastic} value={solverMode === 'energy' ? `최대 변형률 ${(maxStrain * 100).toFixed(2)}%` : 'Energy 모드에서'} />
      {ff.maekawaOnly.length > 0 && <p className="pt-2 text-[12.5px] leading-relaxed text-warn">꼭짓점 {ff.maekawaOnly.length}개에서 Kawasaki는 성립하지만 Maekawa가 실패한다 → 이 꼭짓점들은 평탄하게 접히지 않는다.</p>}
    </div>
  );
}
