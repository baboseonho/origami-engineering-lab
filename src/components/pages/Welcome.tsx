import { tr } from '../../i18n';
import { lessonById } from '../../curriculum/lessons';
import { C } from '../../theme/tokens';
import { Article, Callout, H2, H3, Lead, P, SheetLink, T, VideoGrid } from './Article';
import { StructurePicker } from './StructurePicker';

function LineSample({ kind }: { kind: 'M' | 'V' | 'B' }) {
  const dash = kind === 'M' ? '7 2.5 1.5 2.5' : kind === 'V' ? '6 3.5' : undefined;
  const color = kind === 'M' ? C.mountain : kind === 'V' ? C.valley : C.boundary;
  return (
    <svg width="44" height="10" aria-hidden className="inline-block align-middle">
      <line x1="2" y1="5" x2="42" y2="5" stroke={color} strokeWidth="2.2" strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

const PATHS = () => [
  {
    title: tr('손으로 접어 보고 싶다', 'I want to fold things'),
    who: tr('취미로 시작하는 사람', 'Starting origami as a hobby'),
    steps: ['l0-first', 'l0-pleat', 'l4-miura', 'l6-twist', 'l7-hobby'],
  },
  {
    title: tr('왜 그렇게 접히는지 알고 싶다', 'I want to know why it folds'),
    who: tr('수학과 기하가 궁금한 사람', 'Curious about the maths and geometry'),
    steps: ['l0-pleat', 'l2-terms', 'l2-kawasaki', 'l2-maekawa', 'l3-dof'],
  },
  {
    title: tr('설계와 연구에 쓰고 싶다', 'I want to design or do research'),
    who: tr('공학·디자인을 하는 사람', 'Engineering and design'),
    steps: ['l3-dof', 'l3-energy', 'l5-kresling', 'l7-beyond', 'l7-tools'],
  },
];

export function WelcomePage() {
  return (
    <Article>
      <Lead>
        {tr(
          <>종이 한 장이 <T>접힘선(crease)</T>을 따라 어떻게 움직이는지, 직접 움직여 보며 배우는 도면집이다. 배경지식이 없어도, 수식을 몰라도 괜찮다.</>,
          <>A set of drawings for learning how a sheet of paper moves along its <T>creases</T>, by moving it yourself. No background or maths needed to start.</>,
        )}
      </Lead>

      <H2>{tr('무엇이 궁금한가요?', 'What are you curious about?')}</H2>
      <P>{tr('관심 있는 분야를 고르면 그 분야에서 많이 쓰는 구조부터 보여 준다. 구조를 열면 어떻게 접히는지, 어디에 쓰이는지, 어떤 이론이 숨어 있는지 차례로 볼 수 있다.', 'Pick a field and the structures used most there come first. Open one to see how it folds, where it is used and which theory sits behind it.')}</P>
      <StructurePicker limit={6} />

      <H2>{tr('어디서부터 시작할까', 'Where to start')}</H2>
      <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {PATHS().map((p) => (
          <div key={p.title} className="rounded-[3px] border border-rule-2 bg-paper px-3.5 py-3">
            <div className="text-[15px] font-semibold text-ink">{p.title}</div>
            <div className="text-[13px] text-ink-3">{p.who}</div>
            <ol className="mt-2 space-y-1.5">
              {p.steps.map((id) => <li key={id}><SheetLink to={id} /></li>)}
            </ol>
          </div>
        ))}
      </div>


      <H2>{tr('Origami Engineering이란', 'What Origami Engineering is')}</H2>
      <P>
        {tr(
          <>종이접기는 예술이면서 동시에 아주 정확한 기하다. 어떤 선을 어떤 방향으로 접느냐만으로 넓은 판이 손바닥만 하게 접히고, 납작한 종이가 단단한 원통이 되고, 한쪽을 당기면 전체가 함께 움직인다. <T>Origami Engineering</T>은 이 성질을 설계 도구로 쓴다.</>,
          <>Origami is an art, and it is also very precise geometry. Just by choosing which lines to fold and in which direction, a large sheet packs into your palm, a flat sheet becomes a stiff tube, and pulling one corner moves the whole thing. <T>Origami Engineering</T> uses these properties as design tools.</>,
        )}
      </P>
      <P>
        {tr(
          '우주에서 펼치는 태양전지판, 몸속에서 펴지는 스텐트, 접어서 운반하는 건축 구조, 모양이 바뀌는 로봇처럼, "작게 접었다가 크게 펴야 하는" 문제와 "모양으로 성질을 바꾸는" 문제에서 오리가미가 쓰인다.',
          'Solar arrays that unfold in space, stents that open inside the body, structures that ship folded, robots that change shape: origami shows up wherever something must pack small and open large, or wherever shape is used to change behaviour.',
        )}
      </P>

      <H2>{tr('화면 읽는 법', 'How to read the screen')}</H2>
      <P>
        {tr(
          '각 도면(sheet)에는 접힌 모양(3D)과 접기 전 종이에 그은 선(전개도, crease pattern)이 나란히 있다. 선의 종류는 색과 무늬로 구분한다.',
          'Each sheet shows the folded shape (3D) next to the lines drawn on the flat paper (the crease pattern). Line types are told apart by colour and dash pattern.',
        )}
      </P>
      <ul className="mt-3 space-y-2 text-[15px]">
        <li className="flex items-center gap-3"><LineSample kind="M" /><span>{tr(<><T>산접기 (mountain, M)</T>: 접힌 선이 산등성이처럼 나에게서 멀어지는 쪽으로 솟는다.</>, <><T>Mountain fold (M)</T>: the fold rises away from you like a ridge.</>)}</span></li>
        <li className="flex items-center gap-3"><LineSample kind="V" /><span>{tr(<><T>골접기 (valley, V)</T>: 접힌 선이 골짜기처럼 나에게서 들어간다.</>, <><T>Valley fold (V)</T>: the fold sinks away from you like a valley.</>)}</span></li>
        <li className="flex items-center gap-3"><LineSample kind="B" /><span>{tr(<><T>종이 가장자리</T></>, <><T>Edge of the paper</T></>)}</span></li>
      </ul>
      <P>
        {tr(
          <>접힌 정도는 <T>접힘각 ρ</T>로 잰다. 펼쳐진 상태가 0°, 완전히 접힌 상태가 ±180°이고, 골접기는 +, 산접기는 −다. 오른쪽 패널은 지금 상태를 검사해서 "평탄하게 접히는 조건이 성립하는지", "종이를 휘지 않고 이 모양이 가능한지", "종이가 서로 뚫고 지나가지 않는지"를 따로따로 알려 준다.</>,
          <>How far a crease is folded is its <T>fold angle ρ</T>: 0° when flat, ±180° when folded all the way; valley folds are positive and mountain folds negative. The right-hand panel checks the current state and answers separately: do the flat-folding conditions hold, is this shape possible without bending the paper, and does the paper pass through itself?</>,
        )}
      </P>
      <H3>{tr('접고, 멈추고, 살펴보기', 'Fold, pause, inspect')}</H3>
      <P>
        {tr(
          <>오른쪽 패널의 <T>전체 접기</T> 슬라이더를 움직이면 구조 전체가 함께 접힌다. 어느 지점에서든 멈추면 그 순간의 모양을 그대로 분석할 수 있다. 3D 화면은 끌어서 돌리고 휠로 확대하며, 선이나 꼭짓점에 마우스를 올리면 길이와 각도가 나온다. <T>투영</T> 보기는 지금 모양을 xy·yz·zx 평면에 비춘 3면도를 치수와 함께 보여 준다.</>,
          <>Move the <T>fold the whole structure</T> slider in the right panel and everything folds together. Stop anywhere and analyse that exact shape. Drag the 3D view to rotate and scroll to zoom; hover a line or vertex to read its length and angles. The <T>Projections</T> view shows the current shape projected onto the xy, yz and zx planes, with dimensions.</>,
        )}
      </P>
      <H3>{tr('두 가지 계산 방법', 'Two ways of computing')}</H3>
      <P>
        {tr(
          <><T>Rigid</T>는 종이 면을 휘지 않는 판으로 보고 정확한 기하를 푼다. 불가능한 접기는 거절한다. <T>Energy</T>는 실제 종이처럼 면이 조금 휘고 늘어나는 것을 허용하고, 가장 에너지가 적은 모양을 찾는다. 같은 패턴을 두 방법으로 비교해 보면 "종이가 휘어야만 접히는 패턴"을 알아볼 수 있다.</>,
          <><T>Rigid</T> treats each face as a panel that cannot bend and solves the exact geometry; an impossible fold is refused. <T>Energy</T> lets faces bend and stretch a little, like real paper, and finds the shape with the least energy. Comparing the two on the same pattern shows which patterns only fold because paper bends.</>,
        )}
      </P>

      <Callout title={tr('직접 접어 보기', 'Fold it for real')} tone="tip">
        {tr(
          '모델이 있는 도면에서는 왼쪽 레슨 칸의 "직접 접어 보기"에서 전개도를 A4로 인쇄할 수 있다. 화면에서 움직여 본 패턴을 손으로 접어 보면 훨씬 빨리 익숙해진다.',
          'On any sheet with a model, "Fold it yourself" in the lesson column prints its crease pattern on A4. Folding by hand a pattern you have just moved on screen is the fastest way to get a feel for it.',
        )}
      </Callout>
      <Callout title={tr('표기와 언어', 'Notation and language')}>
        {tr(
          '위쪽 제목줄의 EN/한 버튼으로 언어를 바꿀 수 있다. 정리 이름과 기호(Kawasaki, Maekawa, ρ, θ, DoF)는 두 언어 모두 원래 표기를 쓴다. 처음 보는 말은 "용어 사전" 도면에 모아 두었다.',
          'Switch language with the EN/한 button in the title bar. Theorem names and symbols (Kawasaki, Maekawa, ρ, θ, DoF) keep their usual form in both languages. Unfamiliar words are collected on the Glossary sheet.',
        )}
        <div className="mt-2"><SheetLink to="l0-glossary" /></div>
      </Callout>

      {(lessonById('l0-welcome')?.videos ?? []).length > 0 && (<>
        <H2>{tr('먼저 볼 만한 영상', 'Worth watching first')}</H2>
        <VideoGrid ids={lessonById('l0-welcome')?.videos ?? []} />
      </>)}
    </Article>
  );
}

