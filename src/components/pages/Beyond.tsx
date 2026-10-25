import type { ReactNode } from 'react';
import { tr } from '../../i18n';
import { lessonById } from '../../curriculum/lessons';
import { TOOLS } from '../../curriculum/resources';
import { Article, Callout, H2, Lead, P, SheetLink, ToolCard, VideoGrid } from './Article';

interface Topic { id: string; title: string; body: ReactNode; inApp?: string[]; refs?: string; tools?: string[] }

const TOPICS = (): Topic[] => [
  {
    id: 'global', title: tr('1. 전체가 평탄하게 접히는가: 층 순서', '1. Does the whole pattern fold flat? Layer order'),
    body: tr(
      'Kawasaki와 Maekawa는 꼭짓점 하나를 보는 국소 조건이다. 모든 꼭짓점이 통과해도 패턴 전체가 납작하게 접히려면 겹친 종이들의 위아래 순서(층 순서)가 모순 없이 정해져야 한다. 일반적인 크리스 패턴에서 이것을 판정하는 문제는 NP-hard로 알려져 있다(Bern & Hayes 1996). 그래서 실제 설계 도구는 패턴의 종류를 제한하거나 탐색을 쓴다.',
      'Kawasaki and Maekawa are local conditions on one vertex. Even when every vertex passes, the whole pattern folds flat only if the stacking order of overlapping layers can be chosen without contradiction. For general crease patterns, deciding this is known to be NP-hard (Bern & Hayes 1996), so practical tools restrict the kind of pattern or search.',
    ),
    inApp: ['l2-kawasaki', 'l2-mv', 'l3-bag'], refs: 'Bern & Hayes 1996', tools: ['flat-folder', 'oripa'],
  },
  {
    id: 'rigid', title: tr('2. 강체 접기: 면을 휘지 않고 움직이기', '2. Rigid origami: moving without bending'),
    body: tr(
      '평탄 접힘은 끝 상태의 이야기이고, 강체 접기는 경로의 이야기다. 금속이나 두꺼운 판으로 만든 구조물은 면이 휘지 않으므로, 펼친 상태에서 접힌 상태까지 면을 휘지 않는 연속 운동이 있어야 한다. 자유도 계산, 야코비안 랭크, 그리고 미우라 같은 1자유도 패턴의 설계가 여기에 속한다. 사각형 메시 패턴의 강체 접기 조건과 자유 곡면 설계(Tachi의 Freeform Origami)가 이어지는 주제다.',
      'Flat folding is about the end state; rigid folding is about the path. A structure made of metal or thick panels cannot bend its faces, so it needs a continuous motion from flat to folded without bending. Counting DoF, the rank of the Jacobian, and designing 1-DoF patterns like Miura-ori belong here. Rigid-foldability of quadrilateral meshes and freeform design (Tachi\'s Freeform Origami) follow on from it.',
    ),
    inApp: ['l3-dof', 'l3-solver', 'l4-miura'], tools: ['tachi-software'],
  },
  {
    id: 'design', title: tr('3. 원하는 모양을 접는 설계법', '3. Designing a fold for a target shape'),
    body: tr(
      '트리 방법(Lang)은 만들고 싶은 모양의 뼈대를 나무 그래프로 보고, 각 가지를 종이 위의 원과 띠로 바꿔 배치해서 크리스 패턴을 만든다. 곤충처럼 다리가 많은 사실적인 작품이 이 방법으로 설계된다. 박스 플리팅은 0°·45°·90° 격자 위에서 설계해 계산을 단순하게 만든다. Origamizer(Tachi, Demaine)는 임의의 다면체 표면을 종이 한 장으로 접는 패턴을 계산한다. 접고 한 번 자르기 정리(fold-and-cut)는 직선으로 이루어진 어떤 모양이든 접은 뒤 가위질 한 번으로 오려 낼 수 있다는 결과다.',
      'The tree method (Lang) treats the stick figure of the target as a tree graph and turns each branch into circles and rivers packed on the paper, giving a crease pattern. Realistic many-legged insects are designed this way. Box pleating designs on a 0°/45°/90° grid to keep the computation simple. Origamizer (Tachi, Demaine) computes a pattern that folds any polyhedral surface from one sheet. The fold-and-cut theorem says any shape made of straight lines can be cut out with one straight cut after folding.',
    ),
    inApp: ['l5-boxpleat'], tools: ['treemaker', 'bp-studio', 'tachi-software'],
  },
  {
    id: 'curved', title: tr('4. 곡선 접기', '4. Curved creases'),
    body: tr(
      '크리스가 곡선이면 접는 순간 옆의 면도 함께 휘어야 한다. 접힘과 굽힘이 짝을 이루어 단단하고 매끄러운 형태가 나온다. David Huffman의 작품들이 대표적이다. 이 앱의 하이파(hypar)는 직선 크리스만 쓰지만, 접는 동안 면이 휘어 곡면처럼 보이는 같은 계열의 현상을 보여 준다.',
      'When a crease is curved, the faces beside it must bend as it folds. Folding and bending come paired, giving stiff, smooth forms; David Huffman\'s work is the classic example. The hypar in this app uses only straight creases, but shows the same family of effects: faces bend while folding and the sheet reads as a curved surface.',
    ),
    inApp: ['l6-hypar'],
  },
  {
    id: 'thick', title: tr('5. 두꺼운 재료로 접기', '5. Folding thick materials'),
    body: tr(
      '수학의 종이는 두께가 없지만 실제 패널은 두께가 있어 그대로 접으면 서로 부딪힌다. 힌지 위치를 옮기거나(offset), 패널 가장자리를 깎거나, 얇은 막을 힌지로 쓰는 방법들이 개발되었다(Chen, Peng, You 2015; Lang 외 2018 리뷰). 우주용 태양전지판이나 건축물처럼 큰 구조를 만들 때 핵심 문제다.',
      'Mathematical paper has no thickness, but real panels do, and folded naively they collide. Methods include moving the hinge axes (offsets), tapering panel edges and using thin membranes as hinges (Chen, Peng & You 2015; Lang et al. 2018 review). It is the central issue for large structures such as space solar arrays and buildings.',
    ),
    refs: 'Chen, Peng & You 2015; Lang et al. 2018',
  },
  {
    id: 'kirigami', title: tr('6. 키리가미: 자르기를 더하면', '6. Kirigami: add cuts'),
    body: tr(
      '자르기를 허용하면 늘어나지 않는 종이가 늘어나는 것처럼 행동한다. 패턴화된 절개는 신축성 있는 전자 소자, 접지력이 바뀌는 신발 바닥, 모양이 바뀌는 판 등에 쓰인다. 오리가미와 함께 "구조로 성질을 만드는" 기계 메타물질 분야를 이룬다.',
      'Allow cuts, and paper that cannot stretch behaves as if it could. Patterned cuts are used in stretchable electronics, grip-changing soles and shape-morphing sheets. Together with origami it forms the field of mechanical metamaterials, where structure creates properties.',
    ),
  },
  {
    id: 'mechanics', title: tr('7. 역학: 쌍안정, 강성, 메타물질', '7. Mechanics: bistability, stiffness, metamaterials'),
    body: tr(
      '접힌 구조는 모양에 따라 성질이 크게 바뀐다. 미우라 접기는 오세틱(음의 푸아송비)이고, 워터밤과 Kresling은 두 모양 사이를 "딸깍" 하고 오가는 쌍안정을 보인다. 이런 성질은 충격 흡수, 진동 차단, 기억을 가진 구조, 스스로 판단하는 로봇의 재료가 된다. 이 앱의 Energy 계산은 이 현상들을 다루는 막대-힌지 모델이다.',
      'A folded structure\'s properties change strongly with its shape. Miura-ori is auxetic (negative Poisson\'s ratio); waterbomb and Kresling patterns snap between two shapes (bistability). These effects are used for impact absorption, vibration isolation, structures with memory and robots that react without electronics. The Energy method in this app is the bar-and-hinge model used for such studies.',
    ),
    inApp: ['l5-kresling', 'l5-yoshimura', 'l3-energy'], tools: ['swomps', 'sim-fast'],
  },
  {
    id: 'active', title: tr('8. 스스로 접히는 오리가미', '8. Self-folding origami'),
    body: tr(
      '열, 빛, 자기장, 습기에 반응하는 재료로 크리스를 만들면 종이가 스스로 접힌다. 평평하게 인쇄한 판이 스스로 접혀 걸어 나가는 로봇도 만들어졌다(Felton 외 2014). 작은 의료 기기나 손이 닿지 않는 곳의 조립이 목표다.',
      'Make the creases from materials that respond to heat, light, magnetic fields or moisture and the sheet folds itself. Flat-printed sheets have folded themselves into walking robots (Felton et al. 2014). Small medical devices and assembly in places hands cannot reach are the targets.',
    ),
    refs: 'Felton et al. 2014',
  },
  {
    id: 'compute', title: tr('9. 계산하는 오리가미 (연구 최전선)', '9. Origami that computes (research frontier)'),
    body: tr(
      '쌍안정 단위를 비트처럼 써서 기억과 논리를 만들거나, 접힌 구조의 진동을 계산에 쓰는(physical reservoir computing) 연구가 진행 중이다. 아직 초기 분야라 질문이 답보다 많다.',
      'Research uses bistable units as bits for memory and logic, or uses the dynamics of folded structures for computation (physical reservoir computing). It is an early field, with more questions than answers.',
    ),
  },
  {
    id: 'apps', title: tr('10. 어디에 쓰이나', '10. Where it is used'),
    body: tr(
      '우주(접히는 태양전지판과 안테나, 별빛 가리개), 의료(스텐트, 수술 도구), 자동차(에어백을 접어 넣는 방식의 해석), 건축(움직이는 외벽과 차양), 포장과 지도 접기, 로봇(그리퍼, 기어 다니는 로봇)까지 넓다. 공통점은 "작게 접었다가 크게 펴기"와 "모양으로 성질 바꾸기"다.',
      'Space (folding solar arrays and antennas, starshades), medicine (stents, surgical tools), cars (analysing how airbags are packed), architecture (moving facades and shading), packaging and map folding, and robotics (grippers, crawling robots). The common threads: pack small, open large; change behaviour by changing shape.',
    ),
  },
];

export function BeyondPage() {
  const videos = lessonById('l7-beyond')?.videos ?? [];
  return (
    <Article>
      <Lead>{tr('이 앱의 앞부분은 "접히는가"를 다룬다. 오리가미 연구는 그보다 훨씬 넓다. 큰 줄기 열 가지를 지도처럼 펼쳐 두었다. 관심 가는 곳에서 이 앱의 도면과 도구로 이어 가면 된다.', 'The earlier parts of this app ask whether something folds. Origami research is much wider. Here are ten main threads laid out like a map; follow the ones that interest you into the sheets and tools.')}</Lead>
      <nav aria-label={tr('주제 목록', 'Topics')} className="mt-4 flex flex-wrap gap-1.5">
        {TOPICS().map((t) => (
          <a key={t.id} href={`#beyond-${t.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`beyond-${t.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            className="rounded-[3px] border border-rule-2 px-2 py-0.5 text-[13px] text-ink-2 hover:border-ink hover:text-ink">{t.title.replace(/^\d+\.\s*/, '')}</a>
        ))}
      </nav>
      {TOPICS().map((t) => {
        const tools = (t.tools ?? []).map((id) => TOOLS.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
        return (
          <section key={t.id}>
            <H2 id={`beyond-${t.id}`}>{t.title}</H2>
            <P>{t.body}</P>
            {t.refs && <p className="mt-1 text-[13px] text-ink-3">{tr('참고: ', 'See: ')}{t.refs}</p>}
            {t.inApp && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="lettering mr-1 text-[12px] text-ink-3">{tr('이 앱에서', 'In this app')}</span>
                {t.inApp.map((id) => <SheetLink key={id} to={id} />)}
              </div>
            )}
            {tools.length > 0 && (
              <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
                {tools.map((x) => <ToolCard key={x.id} tool={x} />)}
              </div>
            )}
          </section>
        );
      })}
      <Callout title={tr('도구 전체 보기', 'All the tools')}>
        {tr('설계·시뮬레이션 도구는 다음 도면에 모아 두었다.', 'Design and simulation tools are collected on the next sheet.')}
        <div className="mt-2"><SheetLink to="l7-tools" /></div>
      </Callout>
      {videos.length > 0 && (<><H2>{tr('영상', 'Videos')}</H2><VideoGrid ids={videos} /></>)}
    </Article>
  );
}
