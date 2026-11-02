import { useMemo } from 'react';
import { Play, Undo2 } from 'lucide-react';
import type { SweepSample } from '../../core/analysis/experiments';
import type { ExperimentId } from '../../curriculum/lessons';
import { lessonById } from '../../curriculum/lessons';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { clearExperiment, playExperiment, runAndPlayExperiment, scrubExperiment } from '../../state/actions';
import { tr } from '../../i18n';
import { Button } from '../controls/ui';

/** What the card says for each experiment (a function, so the text follows the language). */
const text = (kind: ExperimentId) => ({
  yoshimuraCompression: {
    title: tr('위에서 눌러 보기', 'Press it from the top'),
    watch: tr('어느 순간 \'딱\' 하고 다이아몬드로 꺾인다.', 'At one moment it gives way and folds into diamonds.'),
    run: tr('위에서 눌러 보기', 'Press from the top'),
    slider: tr('누른 깊이', 'Pressed depth'),
    from: tr('누르기 전', 'not pressed'), to: tr('끝까지 누름', 'fully pressed'),
  },
  kreslingAxial: {
    title: tr('위에서 눌러 보기', 'Press it from the top'),
    watch: tr('누르면 비틀리며 납작해진다. 윗판은 자유롭게 돈다.', 'Pressed, it twists as it flattens. The top plate is free to turn.'),
    run: tr('위에서 눌러 보기', 'Press from the top'),
    slider: tr('누른 깊이', 'Pressed depth'),
    from: tr('누르기 전', 'not pressed'), to: tr('끝까지 누름', 'fully pressed'),
  },
  bagCollapse: {
    title: tr('납작하게 눌러 보기', 'Press it flat'),
    watch: tr('면이 휘면서 납작해진다.', 'The faces bend as it goes flat.'),
    run: tr('납작하게 눌러 보기', 'Press it flat'),
    slider: tr('접힘 진행률', 'Fold progress'),
    from: tr('열림', 'open'), to: tr('납작', 'flat'),
  },
}[kind]);

/** The largest drop of the reaction force between two samples: where a pressed shell gives way. */
function snapOf(samples: SweepSample[]): { index: number; drop: number } | null {
  let index = -1, drop = 0;
  for (let k = 1; k < samples.length; k++) {
    const a = samples[k - 1].reaction, b = samples[k].reaction;
    if (a > 0 && b < a && (a - b) / a > drop) { drop = (a - b) / a; index = k; }
  }
  // a few per cent is numerical wobble, not a snap
  return drop >= 0.1 ? { index, drop } : null;
}

const pct = (x: number) => Math.round(x * 100);
const deg = (r: number) => Math.round((Math.abs(r) * 180) / Math.PI);

/**
 * The experiment of the sheet as one obvious action: press the structure
 * (Yoshimura, Kresling) and watch it in 3D. Every frame is an energy-minimised
 * sample of the bar-and-hinge model; numbers in the card are read off those
 * samples. The plots stay in Analysis → Energy.
 */
export function ExperimentCard() {
  const lessonId = useModel((s) => s.lessonId);
  const model = useModel((s) => s.model);
  const ex = useSim((s) => s.experiment);
  const lesson = lessonById(lessonId);
  const kind = lesson?.experiment;
  // reference height of the tube, so a pressed depth reads as a share of it
  const height = useMemo(() => {
    if (!model) return 0;
    let lo = Infinity, hi = -Infinity;
    for (const v of model.vertices) { lo = Math.min(lo, v.referencePosition[2]); hi = Math.max(hi, v.referencePosition[2]); }
    return hi - lo;
  }, [model]);
  const samples = ex?.samples;
  const snap = useMemo(() => (samples && kind === 'yoshimuraCompression' ? snapOf(samples) : null), [samples, kind]);
  if (!kind || !model) return null;
  // the shopping bag already has its fold card doing the same open → flat path; one way to fold a sheet
  if (kind === 'bagCollapse' && lesson?.patternFold) return null;
  const t = text(kind);
  const mine = ex && ex.kind === kind ? ex : null;
  const running = !!mine?.running;
  const n = mine?.samples.length ?? 0;
  const cur = mine?.samples[mine.index];
  const last = mine && n ? mine.samples[n - 1] : undefined;
  const done = !!mine && !running && n > 1;
  const share = (u: number) => (kind === 'bagCollapse' ? u : height > 0 ? u / height : 0);

  let result: string | null = null;
  if (done && last && kind === 'yoshimuraCompression') {
    result = snap
      ? tr(`높이의 ${pct(share(mine!.samples[snap.index].u))}%쯤 눌렀을 때 버티는 힘이 ${pct(snap.drop)}% 뚝 떨어진다. 그 순간 원통이 다이아몬드로 꺾인다.`,
        `At about ${pct(share(mine!.samples[snap.index].u))}% of the height, the force it pushes back with drops by ${pct(snap.drop)}%. That is when the cylinder folds into diamonds.`)
      : tr('이 범위에서는 버티는 힘이 뚝 떨어지는 순간이 없었다.', 'Within this range the force never dropped suddenly.');
  } else if (done && last && kind === 'kreslingAxial') {
    result = tr(`높이의 ${pct(share(last.u))}%를 누르는 동안 윗판이 ${deg(last.twist)}° 돌았다.`, `Pressed by ${pct(share(last.u))}% of its height, the top plate turned ${deg(last.twist)}°.`);
  } else if (done && kind === 'bagCollapse') {
    const peak = mine!.samples.reduce((m, q) => Math.max(m, q.maxStrain), 0);
    result = tr(`가는 길에 면이 가장 많이 늘어난 곳은 ${(peak * 100).toFixed(1)}%였다.`, `On the way, the facets stretched by up to ${(peak * 100).toFixed(1)}%.`);
  }
  // a live word under the readout: where the scrubbed frame is, in plain language
  let now: string | null = null;
  if (cur && kind === 'yoshimuraCompression' && snap && done) now = mine!.index >= snap.index ? tr('다이아몬드로 꺾였다', 'folded into diamonds') : tr('아직 고르게 줄어드는 중', 'still shortening evenly');
  if (cur && kind === 'kreslingAxial') now = tr(`윗판 ${deg(cur.twist)}° 회전`, `top plate turned ${deg(cur.twist)}°`);
  const max = Math.max(1, (running ? mine!.total : n - 1));
  const snapAt = snap && done ? snap.index / Math.max(1, n - 1) : null;

  return (
    <section aria-label={t.title} className="border-b border-rule-2 px-4 pb-4 pt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{t.title}</h3>
        <span className="shrink-0 text-[12px] text-ink-3">{tr('에너지 최소화 결과', 'energy-minimised result')}</span>
      </div>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{t.watch}</p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
        {done ? (
          <Button kind="primary" className="h-11 text-[15px]" onClick={() => playExperiment()}><Play size={15} />{tr('다시 재생', 'Play again')}</Button>
        ) : (
          <Button kind="primary" className="h-11 text-[15px]" disabled={running} onClick={() => runAndPlayExperiment(kind)}>
            {running ? <span className="tnum">{tr(`계산 중 ${n}/${mine!.total + 1}`, `Computing ${n}/${mine!.total + 1}`)}</span> : <><Play size={15} />{t.run}</>}
          </Button>
        )}
        {mine && !running && (
          <Button className="h-11" onClick={clearExperiment} title={tr('누르기 전 모양으로 돌아간다', 'Back to the shape before pressing')}>
            <Undo2 size={15} />{tr('원래대로', 'Reset')}
          </Button>
        )}
      </div>
      {mine && n > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] text-ink-2">{t.slider}{kind !== 'bagCollapse' && <> <i className="greek">u</i></>}</span>
            <span className="flex items-baseline gap-2">
              {kind !== 'bagCollapse' && cur && <span className="tnum text-[13px] text-ink-3">{tr('높이의', 'of height')}</span>}
              <span className="tnum text-[22px] font-semibold leading-none text-ink">{pct(share(cur?.u ?? 0))}%</span>
            </span>
          </div>
          <div className="relative">
            <input type="range" className="block h-11 w-full cursor-pointer" min={0} max={max} step={1} value={mine.index}
              disabled={n < 2} aria-label={t.slider} aria-valuetext={`${pct(share(cur?.u ?? 0))}%`}
              onChange={(e) => scrubExperiment(parseInt(e.target.value))} />
            {snapAt !== null && (
              <span aria-hidden className="pointer-events-none absolute bottom-0 h-2 w-0.5 -translate-x-1/2 bg-warn" style={{ left: `calc(${snapAt * 100}% + ${(0.5 - snapAt) * 16}px)` }} />
            )}
          </div>
          <div className="flex justify-between text-[13px] text-ink-3"><span>{t.from}</span><span>{t.to}</span></div>
          {now && <p className="mt-1.5 text-[14px] font-medium text-ink">{now}</p>}
        </div>
      )}
      {result && <p className="mt-2 rounded-[3px] bg-paper-2 px-2.5 py-1.5 text-[14px] leading-relaxed text-ink-2">{result}</p>}
      {mine?.error && <p className="mt-2 text-[13px] text-bad">{tr('계산이 멈췄다: ', 'The computation stopped: ')}{mine.error}</p>}
      <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
        {kind === 'bagCollapse'
          ? tr('단계마다 막대-힌지 모델의 에너지가 가장 낮은 모양을 구했다. 미리 정한 애니메이션이 아니다. 그래프는 분석 → 에너지 탭에 있다.',
            'At each step the lowest-energy shape of the bar-and-hinge model was found. It is not a scripted animation. The plots are in Analysis → Energy.')
          : tr('누른 깊이마다 막대-힌지 모델의 에너지가 가장 낮은 모양을 구했다. 미리 정한 애니메이션이 아니다. 그래프는 분석 → 에너지 탭에 있다.',
            'At each pressed depth the lowest-energy shape of the bar-and-hinge model was found. It is not a scripted animation. The plots are in Analysis → Energy.')}
      </p>
    </section>
  );
}
