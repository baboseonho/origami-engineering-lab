import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getLang, tr } from '../../i18n';
import { Rich } from '../controls/Rich';
import { Article, H2, Lead, SheetLink } from './Article';

interface Term { ko: string; en: string; defKo: string; defEn: string; sheet?: string }

const GROUPS = (): { title: string; terms: Term[] }[] => [
  {
    title: tr('선과 면', 'Lines and faces'),
    terms: [
      { ko: '크리스 (접힘선)', en: 'Crease', defKo: '종이를 접는 선. 접기 전에는 종이 위에 그은 선이고, 접으면 경첩(힌지)처럼 움직인다.', defEn: 'A line the paper folds along. Before folding it is a line drawn on the sheet; when folded it acts like a hinge.', sheet: 'l0-pleat' },
      { ko: '크리스 패턴 (전개도)', en: 'Crease pattern (CP)', defKo: '펼친 종이 위에 모든 크리스를 그린 그림. 설계도이자 악보 같은 역할을 한다.', defEn: 'A drawing of every crease on the unfolded sheet; the blueprint of a fold.', sheet: 'l0-pleat' },
      { ko: '산접기 / 골접기 (M / V)', en: 'Mountain / valley fold (M / V)', defKo: '앞면에서 볼 때 접힌 선이 솟으면 산접기(빨강 일점쇄선), 들어가면 골접기(파랑 점선). 종이를 뒤집으면 서로 바뀐다.', defEn: 'Seen from the front, a fold that rises is a mountain (red dash-dot), one that sinks is a valley (blue dashed). Turning the paper over swaps them.', sheet: 'l2-terms' },
      { ko: '면', en: 'Face (facet)', defKo: '크리스로 둘러싸인 종이 조각. Rigid 계산에서는 휘지 않는 판으로 본다.', defEn: 'A piece of paper bounded by creases. The Rigid solver treats it as a panel that never bends.' },
      { ko: '꼭짓점과 차수', en: 'Vertex and degree', defKo: '크리스가 만나는 점. 그 점에서 만나는 크리스의 수를 차수라고 한다. 평탄하게 접히는 내부 꼭짓점의 차수는 항상 짝수다.', defEn: 'A point where creases meet; the number of creases meeting there is its degree. An interior vertex that folds flat always has even degree.', sheet: 'l2-single' },
    ],
  },
  {
    title: tr('각도와 정리', 'Angles and theorems'),
    terms: [
      { ko: '섹터각 θ', en: 'Sector angle θ', defKo: '한 꼭짓점에서 이웃한 두 크리스 사이의 각. 펼친 종이 위에서 잰다.', defEn: 'The angle between two neighbouring creases at a vertex, measured on the flat paper.', sheet: 'l2-kawasaki' },
      { ko: '접힘각 ρ', en: 'Fold angle ρ', defKo: '크리스가 얼마나 접혔는지. $\\rho = 0^\\circ$이면 펼침, $\\pm 180^\\circ$이면 완전히 접힘. 골접기 +, 산접기 −.', defEn: 'How far a crease is folded: $\\rho = 0^\\circ$ is flat, $\\pm 180^\\circ$ is folded all the way; valley positive, mountain negative.', sheet: 'l2-single' },
      { ko: '평탄 접힘 가능', en: 'Flat-foldable', defKo: '종이를 뚫지 않고 완전히 납작하게 접은 상태가 존재한다는 성질. 끝 상태에 관한 말이다.', defEn: 'A completely flat folded state exists without the paper passing through itself. It is a statement about the end state.', sheet: 'l2-terms' },
      { ko: 'Kawasaki–Justin 정리', en: 'Kawasaki–Justin theorem', defKo: '평평한 꼭짓점이 평탄하게 접히려면 섹터각을 번갈아 더하고 뺀 합이 0이어야 한다: $\\theta_1 - \\theta_2 + \\theta_3 - \\dots = 0$.', defEn: 'A flat vertex can fold flat only if its sector angles alternately added and subtracted sum to zero: $\\theta_1 - \\theta_2 + \\theta_3 - \\dots = 0$.', sheet: 'l2-kawasaki' },
      { ko: 'Maekawa–Justin 정리', en: 'Maekawa–Justin theorem', defKo: '평탄하게 접힌 꼭짓점에서 산접기 수와 골접기 수의 차는 2다: $|M - V| = 2$.', defEn: 'At a flat-folded vertex the numbers of mountains and valleys differ by two: $|M - V| = 2$.', sheet: 'l2-maekawa' },
      { ko: 'big–little–big, crimp', en: 'Big–little–big, crimp', defKo: '양옆보다 작은 섹터를 둔 두 크리스는 방향이 달라야 한다. 그 둘을 함께 접어 없애는 것이 crimp다.', defEn: 'Two creases around a sector smaller than both neighbours must have opposite directions; folding that pair away together is a crimp.', sheet: 'l2-mv' },
      { ko: '강체 접기 (rigid folding)', en: 'Rigid folding', defKo: '면을 휘지 않고 펼친 상태에서 접힌 상태까지 연속으로 움직이는 것. 경로에 관한 말이며 평탄 접힘과는 별개다.', defEn: 'Moving continuously from flat to folded without bending any face. It is about the path, and independent of flat-foldability.', sheet: 'l2-terms' },
      { ko: '자유도 (DoF)', en: 'Degrees of freedom (DoF)', defKo: '독립적으로 정할 수 있는 접힘각의 수. 미우라 접기는 1이라 한 곳을 접으면 나머지가 모두 정해진다.', defEn: 'How many fold angles can be chosen independently. Miura-ori has one: fold one crease and every other is decided.', sheet: 'l3-dof' },
    ],
  },
  {
    title: tr('손으로 접는 기술', 'Folding by hand'),
    terms: [
      { ko: '미리 접기 (pre-crease)', en: 'Pre-crease', defKo: '모든 선을 한 번씩 접었다 펴서 자국을 내 두는 것. 테셀레이션은 거의 항상 이렇게 시작한다.', defEn: 'Folding and unfolding every line once to mark it. Tessellations almost always start this way.', sheet: 'l0-first' },
      { ko: '접어 모으기 (collapse)', en: 'Collapse', defKo: '자국 낸 선들을 동시에 접어 전체 모양을 한 번에 만드는 것.', defEn: 'Folding many marked creases at once so the whole form appears together.', sheet: 'l0-first' },
      { ko: '기본형 (base)', en: 'Base', defKo: '여러 작품이 공통으로 시작하는 중간 형태. 정사각 기본형, 물폭탄 기본형, 학 기본형이 대표적이다.', defEn: 'A shared starting form for many models; the square (preliminary), waterbomb and bird bases are the classics.', sheet: 'l4-wbbase' },
      { ko: '뒤집어 접기, 눌러 접기, 꽃잎 접기', en: 'Reverse, squash and petal folds', defKo: '뾰족한 부분의 방향을 뒤집는 접기, 주머니를 눌러 펴는 접기, 양옆을 모아 길쭉하게 올리는 접기. 학을 접을 때 모두 나온다.', defEn: 'Turning a point inside or outside, flattening a pocket, and lifting a long flap by narrowing its sides. The crane uses all three.', sheet: 'l0-first' },
      { ko: '플리트 (주름)', en: 'Pleat', defKo: '산접기와 골접기를 번갈아 평행하게 접은 것. 부채나 아코디언 모양이다.', defEn: 'Alternating parallel mountain and valley folds, as in a fan or an accordion.', sheet: 'l0-pleat' },
      { ko: '꼬아 접기 (twist fold)', en: 'Twist fold', defKo: '가운데 다각형이 회전하면서 주변 플리트가 함께 접히는 패턴. 테셀레이션의 기본 단위로 많이 쓴다.', defEn: 'A pattern where a central polygon rotates as the pleats around it fold; a common building block of tessellations.', sheet: 'l6-twist' },
      { ko: '테셀레이션', en: 'Tessellation', defKo: '같은 단위 패턴을 타일처럼 반복한 크리스 패턴.', defEn: 'A crease pattern made by repeating one unit like tiles.', sheet: 'l4-miura' },
    ],
  },
  {
    title: tr('모양과 성질', 'Shape and behaviour'),
    terms: [
      { ko: '오세틱 (음의 푸아송비)', en: 'Auxetic (negative Poisson\'s ratio)', defKo: '한 방향으로 줄이면 옆 방향도 함께 줄어드는 성질. 미우라 접기가 대표적이다.', defEn: 'Shrinking in one direction makes it shrink sideways too. Miura-ori is the classic example.', sheet: 'l4-miura' },
      { ko: '쌍안정', en: 'Bistable', defKo: '두 개의 안정한 모양 사이를 "딸깍" 하고 오가는 구조. Kresling 원통이 그렇다.', defEn: 'A structure that snaps between two stable shapes, like the Kresling tube.', sheet: 'l5-kresling' },
      { ko: '가전개 (developable)', en: 'Developable', defKo: '찢거나 늘리지 않고 평면으로 펼 수 있는 곡면. 종이는 늘어나지 않으므로 항상 가전개 상태를 유지한다.', defEn: 'A surface that flattens without tearing or stretching. Paper does not stretch, so it always stays developable.', sheet: 'l4-waterbomb' },
      { ko: '가우스 곡률', en: 'Gaussian curvature', defKo: '곡면이 공처럼 휘었는지(양수), 안장처럼 휘었는지(음수)를 나타내는 값. 접힌 패턴 전체를 큰 곡면으로 보면 곡률을 가질 수 있다.', defEn: 'Whether a surface curves like a ball (positive) or a saddle (negative). A folded pattern seen as one coarse surface can have curvature.', sheet: 'l6-hypar' },
      { ko: '막대-힌지 모델', en: 'Bar-and-hinge model', defKo: '종이를 막대(늘어남)와 힌지(접힘, 면 휨)의 그물로 보고 에너지를 계산하는 모델. 이 앱의 Energy 계산 방법이다.', defEn: 'A model of paper as a network of bars (stretching) and hinges (folding, face bending) whose energy is minimised; the app\'s Energy method.', sheet: 'l3-energy' },
      { ko: '키리가미', en: 'Kirigami', defKo: '접기에 자르기를 더한 것. 잘린 틈 덕분에 종이가 늘어나는 것처럼 행동할 수 있다.', defEn: 'Folding plus cutting; the cuts let a sheet behave as if it could stretch.', sheet: 'l7-beyond' },
      { ko: '박스 플리팅', en: 'Box pleating', defKo: '0°·45°·90° 선의 격자 위에서만 크리스를 고르는 설계 방법.', defEn: 'A design method that picks creases only from a grid of 0°, 45° and 90° lines.', sheet: 'l5-boxpleat' },
      { ko: '트리 방법', en: 'Tree method', defKo: '원하는 모양의 뼈대(나무)를 종이 위 원과 띠의 배치로 바꿔 크리스 패턴을 설계하는 방법(Robert J. Lang).', defEn: 'Designing a crease pattern by turning the stick figure (tree) of the target into a packing of circles and rivers on the paper (Robert J. Lang).', sheet: 'l7-beyond' },
    ],
  },
];

export function GlossaryPage() {
  const [q, setQ] = useState('');
  const en = getLang() === 'en';
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return GROUPS().map((g) => ({ ...g, terms: g.terms.filter((t) => !s || [t.ko, t.en, t.defKo, t.defEn].some((x) => x.toLowerCase().includes(s))) })).filter((g) => g.terms.length);
  }, [q]);
  return (
    <Article>
      <Lead>{tr('이 앱에서 쓰는 말을 한곳에 모았다. 각 용어 옆의 버튼은 그 말이 실제로 쓰이는 도면으로 간다.', 'Every term used in this app, in one place. The button next to a term opens the sheet where it is put to work.')}</Lead>
      <label className="mt-4 flex items-center gap-2 rounded-[4px] border border-rule-2 bg-paper px-3 py-2 focus-within:border-ink">
        <Search size={16} className="text-ink-3" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('용어 찾기 (한글 또는 영어)', 'Find a term (English or Korean)')}
          aria-label={tr('용어 찾기', 'Find a term')} className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" />
      </label>
      {groups.length === 0 && <p className="mt-4 text-ink-3">{tr('찾는 용어가 없다.', 'No matching term.')}</p>}
      {groups.map((g) => (
        <section key={g.title}>
          <H2>{g.title}</H2>
          <dl className="mt-2">
            {g.terms.map((t) => (
              <div key={t.en} className="border-t border-dashed border-rule-2 py-3 first:border-t-0">
                <dt className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[16px] font-semibold text-ink">{en ? t.en : t.ko}<span className="ml-2 text-[13px] font-normal text-ink-3">{en ? t.ko : t.en}</span></span>
                  {t.sheet && <SheetLink to={t.sheet} />}
                </dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-ink-2"><Rich text={en ? t.defEn : t.defKo} /></dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Article>
  );
}
