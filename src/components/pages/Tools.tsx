import { useRef, useState } from 'react';
import { getLang, tr } from '../../i18n';
import { lessonById } from '../../curriculum/lessons';
import { importFoldText } from '../../state/actions';
import { INTEROP_NOTES, READINGS, TOOLS, type Tool } from '../../curriculum/resources';
import { Article, Callout, H2, Lead, P, ReadingRow, ToolCard, VideoGrid } from './Article';

const GROUPS = (): { kind: Tool['kind']; title: string; intro: string }[] => [
  { kind: 'design', title: tr('크리스 패턴 그리고 설계하기', 'Draw and design crease patterns'), intro: tr('선을 그리고, 평탄하게 접히는지 확인하고, 원하는 모양에서 패턴을 계산하는 도구.', 'Tools to draw lines, check flat-foldability and compute a pattern from a target shape.') },
  { kind: 'simulate', title: tr('접히는 모습 시뮬레이션', 'Simulate the folding'), intro: tr('패턴을 넣으면 3D로 접어 보여 주거나 역학을 계산하는 도구.', 'Tools that fold a pattern in 3D or compute its mechanics.') },
  { kind: 'format', title: tr('파일 형식', 'File formats'), intro: tr('도구끼리 패턴을 주고받는 공통 형식.', 'Shared formats for passing patterns between tools.') },
  { kind: 'library', title: tr('프로그래밍 라이브러리', 'Programming libraries'), intro: tr('직접 코드를 짜서 패턴을 만들거나 분석할 때.', 'For generating or analysing patterns in your own code.') },
  { kind: 'learn', title: tr('배우기', 'Learning'), intro: tr('강의와 자료.', 'Courses and material.') },
];

/** Open a FOLD file made with another tool in this app. */
function ImportFold() {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => ref.current?.click()} className="rounded-[4px] border border-ink bg-paper px-3 py-1.5 text-[14px] font-medium text-ink hover:bg-paper-2">{tr('.fold 파일 열기…', 'Open a .fold file…')}</button>
      <input ref={ref} type="file" accept=".fold,.json" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const err = importFoldText(await f.text());
        setMsg(err ? tr(`열지 못했다: ${err}`, `Could not open it: ${err}`) : null);
      }} />
      {msg && <span className="text-[13px] text-bad">{msg}</span>}
    </div>
  );
}

export function ToolsPage() {
  const videos = lessonById('l7-tools')?.videos ?? [];
  const learn = READINGS.filter((r) => r.kind === 'course' || r.kind === 'book' || r.kind === 'paper');
  return (
    <Article>
      <Lead>{tr('이 앱에서 원리를 익혔다면, 실제로 패턴을 설계하고 시뮬레이션하는 도구로 넘어갈 차례다. 대부분 무료이고 웹 브라우저에서 바로 쓸 수 있는 것도 많다.', 'Once the principles are familiar, move on to tools that design and simulate real patterns. Most are free, and many run right in the browser.')}</Lead>

      <H2>{tr('이 앱에서 가져가기', 'Taking patterns out of this app')}</H2>
      <P>{tr('모델이 있는 도면에서 레슨 칸의 "직접 접어 보기"를 열면 지금 패턴을 A4로 인쇄하거나 SVG, FOLD 파일로 저장할 수 있다. SVG는 벡터 그림이라 커팅 플로터나 레이저 커터로 선을 새기는 데도 쓸 수 있다. FOLD는 오리가미 도구들이 함께 쓰는 공개 형식이라, 저장한 파일을 아래 도구들에서 바로 열 수 있다.', 'On any sheet with a model, "Fold it yourself" in the lesson column prints the current pattern on A4 or saves it as SVG or FOLD. SVG is a vector drawing, so it also works with cutting plotters or laser cutters. FOLD is the open format shared by origami tools, so the saved file opens directly in the tools below.')}</P>
      <H2>{tr('다른 도구와 주고받기', 'Exchanging patterns with other tools')}</H2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">{INTEROP_NOTES.map((n) => <li key={n.en}>{getLang() === 'en' ? n.en : n.ko}</li>)}</ul>
      <P>{tr('다른 도구에서 만든 FOLD 파일을 이 앱에서 열면 Rigid·Energy 솔버로 접어 보고 판정할 수 있다 (faces_vertices가 있어야 한다).', 'Open a FOLD file made elsewhere and fold and check it here with the Rigid and Energy solvers (it needs faces_vertices).')}</P>
      <ImportFold />
      <Callout title={tr('오픈소스 라이선스', 'Open-source licences')}>
        {tr('각 도구 카드에 라이선스를 적어 두었다. MIT·Apache 코드는 저작권 표시를 지키면 가져다 쓸 수 있고, GPL 코드를 섞으려면 결과물도 GPL이어야 한다. 크리스 패턴 예제는 코드와 별개로 그 작품을 만든 사람의 것이므로, 공유하거나 고쳐 쓸 때는 작가를 밝히고 허락을 구한다.', 'Each tool card shows its licence. MIT and Apache code may be reused if the notice is kept; mixing in GPL code makes the result GPL too. Example crease patterns belong to their designers, separately from the code, so credit them and ask before sharing or adapting one.')}
      </Callout>

      {GROUPS().map((g) => {
        const list = TOOLS.filter((t) => t.kind === g.kind);
        if (!list.length) return null;
        return (
          <section key={g.kind}>
            <H2>{g.title}</H2>
            <P>{g.intro}</P>
            <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
              {list.map((t) => <ToolCard key={t.id} tool={t} />)}
            </div>
          </section>
        );
      })}

      {learn.length > 0 && (
        <>
          <H2>{tr('책과 강의', 'Books and courses')}</H2>
          <ul className="mt-2">{learn.map((r) => <ReadingRow key={r.id} r={r} />)}</ul>
        </>
      )}

      <Callout title={tr('어떤 순서로 써 볼까', 'Which to try first')} tone="tip">
        {tr('패턴을 3D로 보고 싶으면 Origami Simulator, 직접 그려 보고 싶으면 ORIPA나 Rabbit Ear, 원하는 모양을 설계하고 싶으면 TreeMaker부터 시작하면 된다. 역학을 계산하는 연구에는 막대-힌지 코드(MERLIN, SWOMPS)가 쓰인다.', 'To see a pattern in 3D, start with Origami Simulator; to draw your own, ORIPA or Rabbit Ear; to design for a target shape, TreeMaker. Research on mechanics uses bar-and-hinge codes (MERLIN, SWOMPS).')}
      </Callout>
      {videos.length > 0 && (<><H2>{tr('영상', 'Videos')}</H2><VideoGrid ids={videos} /></>)}
    </Article>
  );
}
