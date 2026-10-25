import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { TOL } from '../../core/numerics/tolerances';
import { useUI } from '../../state/uiStore';
import { exportCurrentFold, importFoldText } from '../../state/actions';
import { Button, KV, Section } from '../controls/ui';
import { tr } from '../../i18n';

export function SettingsModal() {
  const open = useUI((s) => s.settingsOpen);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!open) return null;
  const doExport = () => {
    const txt = exportCurrentFold();
    if (!txt) return;
    const blob = new Blob([txt], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'origami.fold';
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(tr('origami.fold 내보내기 완료', 'Exported origami.fold'));
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40" onClick={() => useUI.getState().setSettingsOpen(false)}>
      <div className="sheet w-[560px] rounded-[3px] border border-rule-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-rule px-4 py-2">
          <h2 className="font-semibold">{tr('설정', 'Settings')}</h2>
          <button type="button" aria-label={tr('닫기', 'Close')} className="rounded p-1 text-ink-3 hover:bg-paper-2 hover:text-ink" onClick={() => useUI.getState().setSettingsOpen(false)}><X size={16} /></button>
        </div>
        <Section title={tr('FOLD 파일 입출력', 'FOLD file import/export')}>
          <div className="flex gap-2">
            <Button onClick={doExport}>{tr('현재 모델 내보내기 (.fold)', 'Export current model (.fold)')}</Button>
            <Button onClick={() => fileRef.current?.click()}>{tr('.fold 가져오기…', 'Import .fold…')}</Button>
            <input ref={fileRef} type="file" accept=".fold,.json" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const err = importFoldText(await f.text());
              setMsg(err ? tr(`가져오기 실패: ${err}`, `Import failed: ${err}`) : tr(`${f.name} 가져오기 완료`, `Imported ${f.name}`));
              if (!err) useUI.getState().setSettingsOpen(false);
            }} />
          </div>
          {msg && <p className="mt-1 text-[13px] text-ink-2">{msg}</p>}
          <p className="mt-1 text-[12px] text-ink-3">{tr('표준 FOLD 필드: vertices_coords, edges_vertices, edges_assignment, edges_foldAngle (도 단위, 골접기 +), faces_vertices. 앱 데이터는 "oel:" 네임스페이스 아래에 저장된다. 가져오기에는 faces_vertices가 필요하다.', 'Standard FOLD fields: vertices_coords, edges_vertices, edges_assignment, edges_foldAngle (degrees, valley +), faces_vertices. App data is stored under the "oel:" namespace. Import needs faces_vertices.')}</p>
        </Section>
        <Section title={tr('수치 허용오차 (src/core/numerics/tolerances.ts)', 'Numerical tolerances (src/core/numerics/tolerances.ts)')}>
          <KV k={tr('구속 수렴 ‖C‖', 'Constraint convergence ‖C‖')} v={TOL.constraint.toExponential(0)} />
          <KV k={tr('실현 불가능 판정 임계값', 'Infeasibility threshold')} v={TOL.constraintFail.toExponential(0)} />
          <KV k={tr('랭크: 상대 σ 임계값', 'Rank: relative σ threshold')} v={TOL.rankRelative.toExponential(0)} />
          <KV k={tr('정리 각도 허용오차', 'Theorem angle tolerance')} v={`${(TOL.theoremAngle * 180 / Math.PI).toFixed(3)}°`} />
          <KV k={tr('연속법 스텝', 'Continuation step')} v={`${(TOL.continuationStep * 180 / Math.PI).toFixed(2)}°`} />
          <KV k={tr('충돌 허용오차', 'Collision tolerance')} v={TOL.collision.toExponential(0)} />
        </Section>
        <Section title={tr('규약', 'Conventions')}>
          <p className="text-[13px] text-ink-2">{tr('ρ = 0 평탄, ρ > 0 골접기, ρ < 0 산접기, |ρ| → 180° 완전히 접힘. 산접기 = 빨강, 골접기 = 파랑, 면/내부 = 연회색, 경계 = 어두운 중립색.', 'ρ = 0 flat, ρ > 0 valley, ρ < 0 mountain, |ρ| → 180° fully folded. Mountain = red, valley = blue, faces/interior = light grey, boundary = dark neutral.')}</p>
        </Section>
      </div>
    </div>
  );
}
