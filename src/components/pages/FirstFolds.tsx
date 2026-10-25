import { tr } from '../../i18n';
import { lessonById } from '../../curriculum/lessons';
import { Article, Callout, H2, H3, Lead, P, SheetLink, T, VideoGrid } from './Article';

interface Pattern { sheet: string; level: 1 | 2 | 3; paper: string; tip: string }

const PATTERNS = (): Pattern[] => [
  {
    sheet: 'l0-pleat', level: 1,
    paper: tr('A4 복사지를 길게 자른 띠', 'A strip cut from A4 copy paper'),
    tip: tr('산접기와 골접기를 번갈아 접기만 하면 된다. 접힌 띠를 양쪽에서 밀고 당겨 보면 크리스가 경첩처럼 움직이는 것이 보인다.', 'Just alternate mountain and valley folds. Push and pull the folded strip from both ends to see the creases act as hinges.'),
  },
  {
    sheet: 'l4-miura', level: 2,
    paper: tr('A4 복사지 또는 조금 두꺼운 종이', 'A4 copy paper or slightly heavier paper'),
    tip: tr('인쇄한 전개도의 선을 모두 한 번씩 접어 자국을 낸 뒤, 지그재그 선을 따라 아코디언처럼 모은다. 대각선 방향 두 귀퉁이를 잡고 당기면 한 번에 펴지고 접힌다.', 'Pre-crease every printed line, then gather along the zig-zags like an accordion. Pull two opposite corners: it opens and closes in one motion.'),
  },
  {
    sheet: 'l2-terms', level: 2,
    paper: tr('15 cm 정사각 색종이 (얇을수록 쉽다)', 'A 15 cm square of thin origami paper'),
    tip: tr('가운데 정사각형을 손가락으로 누른 채 비틀면서 네 플리트를 동시에 눕힌다. 화면에서는 이 패턴이 면을 휘지 않고는 접히지 않는다는 것도 확인할 수 있다.', 'Hold the centre square and twist while laying all four pleats down together. On screen you can also see that this pattern cannot fold without bending its faces.'),
  },
  {
    sheet: 'l4-waterbomb', level: 3,
    paper: tr('얇고 질긴 종이 (트레이싱지, 한지)', 'Thin, strong paper (tracing paper, hanji)'),
    tip: tr('격자와 대각선을 모두 미리 접어야 한다. 가장자리 한 줄부터 물폭탄 기본형을 하나씩 접어 모으면 전체가 공처럼 말린다.', 'The grid and all diagonals must be pre-creased. Collapse one row of waterbomb bases at a time from an edge and the sheet curls into a ball.'),
  },
  {
    sheet: 'l5-kresling', level: 3,
    paper: tr('조금 두꺼운 종이 (120–160 g/m²)', 'Slightly heavier paper (120–160 g/m²)'),
    tip: tr('삼각형 띠를 접은 뒤 원통으로 말아 붙인다. 위아래를 누르면서 비틀면 "딸깍" 하고 납작하게 접힌다. 이것이 쌍안정이다.', 'Fold the triangle strip, roll it into a tube and glue it. Press and twist: it snaps flat. That snap is bistability.'),
  },
];

function Dots({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle" aria-label={tr(`난이도 ${n}/3`, `Difficulty ${n} of 3`)} title={tr(`난이도 ${n}/3`, `Difficulty ${n} of 3`)}>
      {[1, 2, 3].map((i) => <span key={i} className={`h-2 w-2 rounded-full ${i <= n ? 'bg-ink' : 'border border-rule-2'}`} />)}
    </span>
  );
}

export function FirstFoldsPage() {
  const videos = lessonById('l0-first')?.videos ?? [];
  return (
    <Article>
      <Lead>{tr('종이 한 장과 10분이면 충분하다. 손으로 접는 기본 동작을 익히고, 이 앱의 패턴을 인쇄해서 직접 접어 본다.', 'One sheet of paper and ten minutes are enough. Learn the basic moves by hand, then print a pattern from this app and fold it yourself.')}</Lead>

      <H2>{tr('준비물', 'What you need')}</H2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>{tr(<><T>종이</T>: 처음에는 15 cm 정사각 색종이가 가장 편하다. 테셀레이션은 A4 복사지나 트레이싱지가 좋다.</>, <><T>Paper</T>: a 15 cm square of origami paper is easiest to start with. For tessellations, A4 copy paper or tracing paper works well.</>)}</li>
        <li>{tr(<><T>단단한 평면</T>과 <T>손톱이나 자</T>: 접은 선을 꾹 눌러 날카롭게 만든다. 본폴더(bone folder)가 있으면 더 좋다.</>, <><T>A hard flat surface</T> and <T>a fingernail or ruler</T> to press each fold sharp. A bone folder is even better.</>)}</li>
        <li>{tr(<><T>프린터</T> (선택): 이 앱의 전개도를 A4로 인쇄할 수 있다.</>, <><T>A printer</T> (optional) to print this app's crease patterns on A4.</>)}</li>
      </ul>

      <H2>{tr('기본 동작', 'The basic moves')}</H2>
      <H3>{tr('골접기와 산접기', 'Valley and mountain folds')}</H3>
      <P>{tr('골접기는 종이를 나를 향해 접어 골짜기를 만든다. 산접기는 반대로, 뒤로 접어 산등성이를 만든다. 사실 같은 동작이고, 종이를 뒤집으면 서로 바뀐다. 전개도에서는 빨간 일점쇄선이 산, 파란 점선이 골이다.', 'A valley fold folds the paper towards you, making a valley. A mountain fold goes the other way, making a ridge. They are the same move seen from opposite sides; turning the paper over swaps them. In a crease pattern, red dash-dot lines are mountains and blue dashed lines are valleys.')}</P>
      <H3>{tr('미리 접기와 접어 모으기', 'Pre-creasing and collapsing')}</H3>
      <P>{tr('복잡한 패턴은 한 번에 접히지 않는다. 먼저 모든 선을 하나씩 접었다 펴서 자국을 내고(미리 접기), 그다음 자국을 따라 여러 선을 동시에 접어 전체를 모은다(collapse). 선이 산인지 골인지 미리 접을 때부터 맞춰 두면 모으기가 훨씬 쉽다.', 'Complex patterns do not fold in one go. First fold and unfold every line to mark it (pre-creasing), then fold many marked lines at once to bring the whole form together (collapsing). Pre-crease each line in its final direction, mountain or valley, and collapsing becomes much easier.')}</P>
      <H3>{tr('뒤집어 접기, 눌러 접기, 꽃잎 접기', 'Reverse, squash and petal folds')}</H3>
      <P>{tr('전통 작품에서 자주 나오는 세 동작이다. 뒤집어 접기는 뾰족한 부분을 안쪽(또는 바깥쪽)으로 방향을 바꿔 넣는다. 눌러 접기는 주머니처럼 열린 부분을 펼쳐 납작하게 누른다. 꽃잎 접기는 양옆을 가운데로 모으면서 한 겹을 길게 들어 올린다. 학을 접으면 세 가지가 모두 나오므로, 아래 영상과 함께 학부터 접어 보는 것을 권한다.', 'Three moves that appear in many traditional models. A reverse fold turns a point inside (or outside) itself. A squash fold opens a pocket and presses it flat. A petal fold lifts one long layer while narrowing its sides to the centre. The crane uses all three, so it is a good first model to fold along with the videos below.')}</P>

      <H2>{tr('기본형 (base)', 'Bases')}</H2>
      <P>{tr(<>많은 작품은 몇 가지 <T>기본형</T>에서 출발한다. 정사각 기본형(square / preliminary base)과 물폭탄 기본형(waterbomb base)은 같은 선을 쓰고 산과 골만 반대다. 학 기본형(bird base)은 정사각 기본형에 꽃잎 접기를 두 번 더한 것이다. 물폭탄 기본형의 움직임은 이 앱에서 3D로 볼 수 있다.</>, <>Many models start from a few <T>bases</T>. The square (preliminary) base and the waterbomb base use the same lines with mountains and valleys swapped. The bird base is a square base plus two petal folds. You can see the waterbomb base move in 3D in this app.</>)}</P>
      <div className="mt-2"><SheetLink to="l4-wbbase" /></div>

      <H2>{tr('이 앱의 패턴 인쇄해서 접기', 'Print and fold a pattern from this app')}</H2>
      <P>{tr('아래 도면을 열고 왼쪽 레슨 칸의 "직접 접어 보기"에서 인쇄한다. 쉬운 것부터 차례로 해 보자.', 'Open a sheet below and print it from "Fold it yourself" in the lesson column. Go from easy to hard.')}</P>
      <div className="mt-3 space-y-2.5">
        {PATTERNS().map((p) => (
          <div key={p.sheet} className="rounded-[3px] border border-rule-2 bg-paper px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SheetLink to={p.sheet} />
              <Dots n={p.level} />
            </div>
            <div className="mt-1.5 text-[13px] text-ink-3">{tr('종이: ', 'Paper: ')}{p.paper}</div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{p.tip}</p>
          </div>
        ))}
      </div>
      <Callout title={tr('격자를 정확히 나누는 법', 'Dividing a grid accurately')} tone="tip">
        {tr('자로 재지 말고 반으로 접기를 반복한다. 반, 그 반, 또 그 반으로 접으면 2, 4, 8, 16칸이 자연스럽게 정확해진다. 테셀레이션 작가들은 대부분 16칸이나 32칸 격자에서 시작한다.', 'Do not measure: keep folding in half. Halves, quarters, eighths and sixteenths come out accurate on their own. Most tessellation folders start from a 16 or 32 division grid.')}
      </Callout>

      {videos.length > 0 && (
        <>
          <H2>{tr('영상으로 따라 접기', 'Fold along with a video')}</H2>
          <VideoGrid ids={videos} />
        </>
      )}
    </Article>
  );
}
