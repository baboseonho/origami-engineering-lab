import type { Params } from '../models/registry';

export type LabId = 'conceptLab' | 'strip1D' | 'kawasaki' | 'maekawa' | 'mvCrimp' | 'generalized' | 'gkawasaki' | 'stepwise' | 'kreslingVsYoshimura';
export type ExperimentId = 'kreslingAxial' | 'yoshimuraCompression' | 'bagCollapse';
export type PanelId = 'miuraMetrics' | 'curvature' | 'bagStates' | 'kreslingCompat' | 'dofNotes' | 'flatVsRigid' | 'reschVertices' | 'energyPresets';
export type TheoryKey =
  | 'convention' | 'kawasaki' | 'maekawa' | 'generalized' | 'generalizedMaekawa' | 'winding' | 'vertexClosure' | 'strip' | 'crimpLemma'
  | 'dof' | 'closure' | 'lm' | 'energy' | 'force' | 'miura' | 'miuraPoisson' | 'stepwise' | 'gaussian'
  | 'kresling' | 'reaction' | 'bag';

export interface Challenge {
  id: string;
  text: string;
  hint?: string;
  answer?: string;
}

export interface Lesson {
  id: string;
  lecture: 1 | 2 | 3 | 4 | 5;
  title: string;
  kind: 'model' | 'lab';
  lab?: LabId;
  generator?: string;
  params?: Params;
  presets?: { label: string; params: Params; note?: string; generator?: string }[];
  solver?: 'rigid' | 'energy';
  enforceMV?: boolean;
  useSymmetry?: boolean;
  experiment?: ExperimentId;
  panels?: PanelId[];
  /**
   * "Fold the whole pattern" control: 'rigid' drives the default crease of a
   * 1-DoF mechanism (every frame an exact rigid solution); 'energy' moves every
   * crease towards its fully folded angle together, relaxing to equilibrium.
   */
  patternFold?: 'rigid' | 'energy';
  /** fold progress the lesson opens at (energy pattern fold) */
  patternFoldStart?: number;
  content: { concept: string; observe: string; experiment: string; meaning: string; question?: string; answer?: string };
  challenges: Challenge[];
  theory: TheoryKey[];
  /** lesson ids this one links to (terminology links) */
  links?: { label: string; to: string }[];
}

export const LESSONS: Lesson[] = [
  // ───────────────────────────── Lecture 1
  {
    id: 'l1-concept', lecture: 1, title: '개념 실습: 형상 → 기능', kind: 'lab', lab: 'conceptLab',
    content: {
      concept: '종이접기 공학은 접힌 구조물의 형상(configuration)과 역학적 거동(점유 면적, 강성, 운동, 하중 경로) 사이의 사상(MAPPING)을 다룬다. 접기는 장식이 아니라 설계 변수이다.',
      observe: '단일 접힘각으로 구동되는 하나의 미우라 접기(Miura-ori) 시트가 평평한 시트(제작 상태)에서 중간 상태들을 거쳐 조밀한 수납 상태까지 연속적으로 움직인다. 면(facet)은 전혀 늘어나지 않지만 점유 면적과 두께는 몇 배 단위로 변한다.',
      experiment: '형상 슬라이더를 "펼침"에서 "수납"까지 끌어 본다. 점유 면적 비와 강체 솔버 잔차를 관찰한다(잔차는 ~1e-12로 유지된다: 모든 프레임은 애니메이션이 아니라 정확한 강체 형상이다).',
      meaning: '조밀한 수납, 전개 구조물(태양전지판 배열, 멤브레인), 변형 가능 메커니즘, 메타물질은 모두 같은 아이디어를 이용한다: 저차원 형상 공간(여기서는 자유도(DoF) 1)이 큰 기하학적 변화를 제어한다.',
    },
    challenges: [
      { id: 'c1', text: '점유 면적이 절반이 되는 구동각을 찾아라.', hint: '통계 패널의 areaRatio를 읽는다.' },
      { id: 'c2', text: '슬라이더 하나만으로 전체 운동을 기술할 수 있는 이유를 설명하라.', answer: '미우라 접기는 자유도 1의 강체 메커니즘이다: 하나의 일반화 좌표가 모든 접힘각을 결정한다(3–4강).' },
    ],
    theory: ['convention'],
    links: [{ label: '용어 정리 (2강)', to: 'l2-terms' }, { label: '미우라 접기 (4강)', to: 'l4-miura' }],
  },
  // ───────────────────────────── Lecture 2
  {
    id: 'l2-terms', lecture: 2, title: '용어 정리 & 평탄 ≠ 강체', kind: 'model', generator: 'squareTwist', params: { phi: 25, L: 1.6 },
    solver: 'rigid', enforceMV: true, panels: ['flatVsRigid'],
    content: {
      concept: '면(facet) = 강체 패널; 크리스(crease, 접는 선) = 힌지; 산접기(Mountain, M, $\\rho<0$, 빨강)는 관찰자로부터 멀어지는 방향으로, 골접기(Valley, V, $\\rho>0$, 파랑)는 관찰자 쪽으로 접힌다. M/V 배정은 크리스에 대한 레이블링이다. 평탄 접힘 가능(flat-foldable): 모든 $\\rho = \\pm 180^\\circ$이고 자기 교차가 없는 접힌 상태가 존재한다. 강체 접힘 가능(rigid-foldable): 모든 면이 강체로 유지되면서 평평한 시트로부터의 연속(CONTINUOUS) 운동이 존재한다. 테셀레이션(tessellation)은 주기적 크리스 패턴이며, 키리가미(kirigami)는 추가로 절개를 허용한다.',
      observe: '사각 꼬임(square twist)은 평탄하게 접힌다("Flat-folded state"가 잔차 ~1e-15로 닫힌다). 또한 모든 꼭짓점이 Kawasaki–Justin 정리와 크림프(crimp) 테스트를 만족한다. 그러나 주어진 M/V 배정으로는 평평한 시트에서 어떤 크리스를 구동해도 실현 불가능(infeasible)하다.',
      experiment: '크리스 하나를 선택하고 $\\rho = +20^\\circ$로 설정한다. 실현 불가능 사유를 읽는다. 이어서 "Show flat-folded state"를 사용하여 비교한다. Energy 모드로 전환하여 다시 구동하면 면이 굽혀질 수밖에 없다.',
      meaning: '평탄 접힘 가능성은 두 끝 상태에 관한 명제이고, 강체 접힘 가능성은 경로(PATH)에 관한 명제이다. 두 성질은 논리적으로 독립이다.',
      question: '크리스를 구동할 때 솔버가 실제로 검사하는 성질은 무엇인가?',
      answer: '평탄 접힘 가능성이 아니라 연속 경로를 따른 강체 운동 가능성(연속법, continuation)이다.',
    },
    challenges: [
      { id: 'c1', text: '"Respect M/V"를 해제하고 다시 구동하라. 무엇이 왜 달라지는가?', answer: '다른 M/V 배정으로는 강체 운동이 존재한다. 주어진 배정이 장애 요인이다.' },
    ],
    theory: ['convention', 'kawasaki', 'maekawa'],
    links: [{ label: '1D 단순 접기', to: 'l2-strip' }, { label: 'Kawasaki 탐색기', to: 'l2-kawasaki' }],
  },
  {
    id: 'l2-strip', lecture: 2, title: '1D 단순 접기 실습', kind: 'lab', lab: 'strip1D',
    content: {
      concept: '1D 크리스 패턴(M/V 점이 있는 띠)은 엔드 폴드(END FOLD, end fold)와 크림프(CRIMP, crimp)의 순차 적용으로 접을 수 있을 때, 그리고 그때에만(iff) 평탄 접힘 가능하다(Arkin et al. 2004).',
      observe: '적용 가능한 연산이 강조 표시된다. 엄밀히 더 짧은 선분을 사이에 둔 인접 크리스가 같은 방향이면 충돌(COLLISION)로 표시된다 — 이러한 패턴은 결코 평탄하게 접을 수 없다.',
      experiment: '크리스를 클릭하여 M/V를 전환하고, 크리스를 띠를 따라 끌어 이동한 뒤, "자동 풀이"를 눌러 접기 순서를 단계별로 확인한다.',
      meaning: '국소 연산은 접힘 가능성을 보존하면서 문제 크기를 크리스 1~2개만큼 줄인다. 이 때문에 1D에서는 탐욕(greedy) 알고리즘으로 충분하다.',
    },
    challenges: [
      { id: 'c1', text: '충돌이 있는 패턴을 만든 뒤, 배정 하나만 바꾸어 해소하라.' },
      { id: 'c2', text: '처음에는 엔드 폴드를 적용할 수 없는 평탄 접힘 가능 패턴을 찾아라.', hint: '양 끝 선분을 각각의 이웃 선분보다 길게 만든다.' },
    ],
    theory: ['strip'],
  },
  {
    id: 'l2-kawasaki', lecture: 2, title: 'Kawasaki 탐색기', kind: 'lab', lab: 'kawasaki',
    content: {
      concept: '짝수 차수의 평평한 단일 꼭짓점은 $\\sum_{\\text{odd}} \\theta_i = \\sum_{\\text{even}} \\theta_i = 180^\\circ$일 때, 그리고 그때에만 평탄하게 접힌다(Kawasaki–Justin 정리).',
      observe: '크리스 광선(ray)을 끌면 잔차 $\\sum_{\\text{odd}} - \\sum_{\\text{even}}$이 갱신된다. 초록색 $\\approx 0$.',
      experiment: '광선을 끌어 본다. "평탄 접힘 가능하게 수정"을 눌러 광선 하나를 최소로 이동시키고, "정리 깨기"를 불러와 섭동해 본다.',
      meaning: 'Kawasaki 조건은 섹터각(SECTOR ANGLE) $\\theta$만에 관한 조건(기하)이며 M/V와 무관하다.',
    },
    challenges: [
      { id: 'c1', text: '평탄 접힘 가능성이 깨질 때까지 섹터각 하나를 바꾼 뒤, 광선 하나만 움직여 복원하라.' },
      { id: 'c2', text: '홀수 차수 꼭짓점이 결코 평탄 접힘 가능하지 않은 이유는 무엇인가?', answer: '층 방향이 교대하려면 크리스 수가 짝수여야 한다(Maekawa–Justin 정리로부터도 도출된다).' },
    ],
    theory: ['kawasaki'],
    links: [{ label: 'Maekawa 탐색기', to: 'l2-maekawa' }],
  },
  {
    id: 'l2-maekawa', lecture: 2, title: 'Maekawa–Justin 탐색기', kind: 'lab', lab: 'maekawa',
    content: {
      concept: '평탄하게 접힌 꼭짓점에서 $|M - V| = 2$이다(Maekawa–Justin 정리). 필요조건이며 충분조건은 아니다.',
      observe: '크리스를 클릭하여 M/V를 전환한다. 개수 조건과 완전한 유효성 검사(크림프 / big–little–big 보조정리)가 따로 표시된다.',
      experiment: '$|M - V| = 2$이면서도 유효하지 않은(INVALID) 배정을 찾는다.',
      meaning: '개수 세기로는 어떤 크리스가 작은 섹터에 인접하는지 알 수 없다. 크림프 테스트는 이를 판별한다.',
    },
    challenges: [
      { id: 'c1', text: '$|M - V| = 2$를 만족하는 M/V 배정을 찾아라.' },
      { id: 'c2', text: '$|M - V| = 2$를 만족하지만 big–little–big 보조정리를 위반하는 배정을 찾아라.' },
    ],
    theory: ['maekawa', 'crimpLemma'],
  },
  {
    id: 'l2-mv', lecture: 2, title: 'M/V 배정: 재귀적 크림프 증명', kind: 'lab', lab: 'mvCrimp',
    content: {
      concept: 'Kawasaki 조건을 만족하는 꼭짓점에 대해: (비엄격) 국소 최소 섹터를 고른다. (엄격 최소이면) 그 두 크리스는 서로 달라야 한다. 이 둘을 크림프로 제거하고, 공선인 크리스 두 개가 남을 때까지 반복한다.',
      observe: '각 단계는 크리스 두 개를 제거하고 세 섹터를 $\\theta_{i-1} - \\theta_i + \\theta_{i+1}$로 병합한다.',
      experiment: '"재귀 증명 보기"를 누르고 단계별로 진행한다. 그다음 배정 하나를 바꾸고 증명이 어느 단계에서 실패하는지 확인한다.',
      meaning: '시험에서 사용하는 단일 꼭짓점의 구성적 특성화이다: 축소한 뒤 기저 사례를 확인한다.',
    },
    challenges: [{ id: 'c1', text: '섹터 60,40,70,80,50,60에 대해 유효한 배정을 찾고, 크림프 2회로 축소됨을 확인하라.' }],
    theory: ['crimpLemma', 'maekawa'],
  },
  {
    id: 'l2-single', lecture: 2, title: '단일 꼭짓점 놀이터 (3D)', kind: 'model', generator: 'singleVertex',
    params: { sectors: '70,100,110,80', mv: 'V,M,V,V' }, solver: 'rigid', enforceMV: true,
    presets: [
      { label: '일반 4차 꼭짓점 (70,100,110,80)', params: { sectors: '70,100,110,80', mv: 'V,M,V,V' } },
      { label: '미우라 꼭짓점 $\\alpha=60^\\circ$', params: { sectors: '60,120,120,60', mv: 'V,M,M,M' } },
      { label: '대칭 80/100 (공선 쌍)', params: { sectors: '80,100,100,80', mv: 'M,V,V,V' }, note: '평탄 접힘 가능하지만 강체 분기 위에 있지 않은 배정' },
      { label: '6차 꼭짓점 (60,40,70,80,50,60)', params: { sectors: '60,40,70,80,50,60', mv: 'M,V,M,M,V,M' } },
    ],
    content: {
      concept: '평탄 접힘 가능한 4차 꼭짓점은 자유도(DoF) 1의 구면 링키지이다($N - 3M = 4 - 3 = 1$).',
      observe: '$\\rho_1$을 구동하면 $\\rho_3 = \\rho_1$, $\\rho_4 = -\\rho_2$이며, 운동 전체에 걸쳐 $\\tan(\\rho_2/2)/\\tan(\\rho_1/2)$가 일정하다.',
      experiment: '$\\rho_1$을 $120^\\circ$까지 구동한 뒤, $\\rho_1$을 잠근 상태에서 $\\rho_2$를 독립적으로 구동해 본다.',
      meaning: '꼭짓점의 접힘각들은 폐합 조건 $\\prod R(\\rho_i) = I$로 연성(coupled)되어 있다.',
    },
    challenges: [{ id: 'c1', text: '$\\rho_1$을 잠그고 $\\rho_2$를 구동하라. 결과를 설명하라.', answer: '$\\rho_1$이 고정되면 링키지에 남은 자유도는 0이므로 구동은 실현 불가능하다.' }],
    theory: ['convention', 'closure', 'dof', 'kawasaki'],
  },
  // ───────────────────────────── Lecture 3
  {
    id: 'l3-generalized', lecture: 3, title: '비평탄 꼭짓점: 일반화 조건', kind: 'lab', lab: 'generalized',
    content: {
      concept: '$\\sum\\theta \\ne 360^\\circ$인 꼭짓점(원뿔 또는 안장)이 평탄하게 접히려면 교대합 $A = \\sum (-1)^{i+1} \\theta_i \\in \\{0^\\circ, \\pm 360^\\circ\\}$이어야 한다.',
      observe: '감김 다이어그램(winding diagram)은 각 광선의 접힌 상을 보여준다: 경로는 닫혀야 하며, $A = \\pm 360^\\circ$는 한 바퀴 감기는 것을 뜻한다.',
      experiment: '세 가지 프리셋($\\sum\\theta = 360^\\circ$, $< 360^\\circ$, $> 360^\\circ$)을 불러오고 섹터를 조정한다.',
      meaning: '일반화된 Maekawa 정리: $A = 0 \\Rightarrow |M - V| = 2$; $A = \\pm 360^\\circ \\Rightarrow M = V$.',
    },
    challenges: [{ id: 'c1', text: '$A = +360^\\circ$인 $\\sum\\theta > 360^\\circ$ 꼭짓점을 구성하고 유효한 M/V 개수를 제시하라.' }],
    theory: ['generalized', 'generalizedMaekawa'],
  },
  {
    id: 'l3-gkawasaki', lecture: 3, title: '일반화 Kawasaki 실험실: ±360°와 감김', kind: 'lab', lab: 'gkawasaki',
    content: {
      concept: '두 양을 구분한다. $T = \\sum\\theta_i$는 꼭짓점 둘레의 종이 양(고유 곡률)이고, $S = \\theta_1 - \\theta_2 + \\theta_3 - \\dots$는 평탄하게 접었을 때 각 광선이 놓이는 방향들의 누적, 즉 접힌 경로의 부호 있는 닫힘이다. 일반화 Kawasaki 조건은 $S \\in \\{0^\\circ, \\pm 360^\\circ\\}$.',
      observe: 'Case C ($130^\\circ$와 $10^\\circ$가 번갈아)에서 각도 걸음을 재생한다: $0 \\to 130 \\to 120 \\to 250 \\to 240 \\to 370 \\to 360$. 끝 방향은 시작과 같지만 경로가 꼭짓점을 반시계로 한 바퀴 돈다(감김 수 $+1$). Case B는 $T = 420^\\circ$인 안장인데도 $S = 0$이고, Case E는 안장인데 $S = 180^\\circ$라서 실패한다.',
      experiment: '섹터각을 바꾸며 $T$와 $S$가 따로 움직이는 것을 본다. 3D 창에서 꼭짓점을 돌려 보고, 각도 지도와 강체 접기 경로를 비교한다. Case C에서 "가까운 꼭짓점 열어 보기"의 $\\varepsilon$을 0으로 줄여 본다.',
      meaning: '$T > 360^\\circ$(안장)라고 해서 $S = \\pm 360^\\circ$가 되는 것은 아니다. $S = \\pm 360^\\circ$는 접힌 종이가 꼭짓점을 한 바퀴 감는다는 뜻이다. 6장짜리 꼭짓점에서는 이것이 $S$의 최댓값이라 강체 패널이 3D로 열리지 못하고 평탄하게 감긴 상태로만 존재한다(닫힘 조건의 등호).',
      question: '$S = 0^\\circ$와 $S = 360^\\circ$는 끝 방향이 같은데 무엇이 다른가?',
      answer: '끝 방향은 같지만 지나온 경로가 다르다. $S = 0$은 되돌아오고, $S = 360^\\circ$는 꼭짓점을 한 바퀴 돌아서 온다(감김 수 1). 그래서 평탄하게 접힌 종이가 꼭짓점 둘레를 한 번 감싼다.',
    },
    challenges: [
      { id: 'c1', text: '$T = 480^\\circ$이면서 $S = 0$인 6-크리스 꼭짓점을 만들어라.', hint: '홀수 합과 짝수 합을 둘 다 $240^\\circ$로.' },
      { id: 'c2', text: '$S = +360^\\circ$인 12-크리스 꼭짓점을 만들고, 3D 창에서 평탄 잠금이 아닌지 확인하라.', answer: '예: $100, 10$을 네 번, 그 뒤 $10$을 네 번. 홀수 섹터가 6개라 닫힘 한계가 $(6-1)\\cdot 180^\\circ$로 넉넉해서 3D로 열린다.' },
    ],
    theory: ['generalized', 'winding', 'vertexClosure'],
    links: [{ label: '비평탄 꼭짓점: 일반화 조건 (Maekawa)', to: 'l3-generalized' }],
  },
  {
    id: 'l3-bag', lecture: 3, title: '쇼핑백 정리 (Shopping Bag)', kind: 'model', generator: 'shoppingBag', params: { W: 2, D: 1, H: 2 }, patternFold: 'energy',
    solver: 'rigid', enforceMV: false, panels: ['bagStates'], experiment: 'bagCollapse',
    content: {
      concept: 'Balkcom–Demaine–Demaine: 전통적인 크리스를 가진 높은(TALL) 종이 쇼핑백($H > D/2$)은 강체 접기가 불가능하다: 열린 상태와 평탄 상태는 강체 형상 공간의 고립점이다.',
      observe: '평탄 접힘 가능: YES (모든 꼭짓점이 국소적으로 평탄 접힘 가능하고 평탄 상태가 정확히 닫힌다). 강체 접힘 경로: NO — M/V를 무시하더라도 열린 상태에서 어떤 크리스를 구동해도 실패한다.',
      experiment: '1) 임의의 거싯(gusset) 크리스를 구동한다. 2) 두 상태를 모두 표시한다. 3) 오른쪽 "쇼핑백 접기"의 접힘 진행률 슬라이더(또는 "납작하게 접기")로 모든 크리스를 함께 접는다: 백이 평탄해지는 동안 면의 변형률과 굽힘이 필요하다는 것을 숫자로 본다. 에너지 탭의 "납작하게 접기"는 같은 경로를 그래프로 기록한다.',
      meaning: '1차(선형화) 자유도는 0이 아닐 수 있지만 유한 운동은 존재하지 않는다 — 열린 쇼핑백은 무한소 운동은 가능하지만 강체(rigid)이다. 실제 종이백이 접히는 것은 종이가 굽혀지기 때문이다.',
    },
    challenges: [
      { id: 'c1', text: '$H < D/2$(낮은 백)로 설정하라. 정리가 여전히 적용되는가?', answer: '아니다 — 낮은 백은 강체로 접어 납작하게 할 수 있다(논문의 Theorem 2). 이 경우 모델은 대각선이 서로 만나지 않아야 한다($H \\le D/2$이면 $S$가 윗면과 일치하므로, 생성기는 높은 백에 대해서만 유효하다).' },
    ],
    theory: ['bag', 'dof', 'energy'],
  },
  {
    id: 'l3-dof', lecture: 3, title: '자유도 탐색기: N − 3M vs rank J', kind: 'model', generator: 'miura', params: { rows: 3, cols: 3, a: 1, b: 1, alpha: 60 },
    solver: 'rigid', enforceMV: true, panels: ['dofNotes'],
    presets: [
      { label: '4차 꼭짓점: $N - 3M = 1$, 완전 랭크', generator: 'singleVertex', params: { sectors: '70,100,110,80', mv: 'V,M,V,V' } },
      { label: '6차 꼭짓점: $N - 3M = 3$', generator: 'singleVertex', params: { sectors: '60,40,70,80,50,60', mv: 'M,V,M,M,V,M' } },
      { label: '끝판이 있는 Kresling: 닫힘, DoF 0', generator: 'kresling', params: {} },
      { label: '미우라 3×3: $N - 3M = 0$이지만 $\\text{DoF} = 1$', generator: 'miura', params: { rows: 3, cols: 3 } },
      { label: '미우라 4×4: $N - 3M < 0$', generator: 'miura', params: { rows: 4, cols: 4 } },
      { label: '미우라 3×4 패널 ($M = 6$)', generator: 'miura', params: { rows: 3, cols: 4 } },
    ],
    content: {
      concept: '강의의 추정식 $\\text{DoF} \\ge N - 3M$ ($N$: 크리스 수, $M$: 내부 꼭짓점 수, 꼭짓점당 회전 구속 3개). $3M$개의 구속이 독립일 때(야코비안 $J$가 완전 행 랭크), 그리고 그때에만 등호가 성립한다. 국소적인 참값은 $\\text{DoF} = N - \\operatorname{rank} J$이다.',
      observe: '미우라 접기에서 $N - 3M$은 0 또는 음수이지만 메커니즘은 움직인다: 꼭짓점 구속이 중복되어 있다($\\operatorname{rank} J < 3M$). 평탄 상태에서는 모든 크리스 축이 한 평면에 놓여 랭크가 더 떨어진다 — 특이 형상(singular configuration)이다.',
      experiment: '$\\rho = 0^\\circ$와 $\\rho = 60^\\circ$에서 $N - 3M$, $\\operatorname{rank} J$, $\\text{DoF}_{\\text{local}}$을 비교한다. 특잇값 그래프를 살펴본다.',
      meaning: '$N - 3M$이 음수라는 것은 음의 운동성이 아니라 중복(redundancy)을 의미한다. 대칭/특수 기하에서는 이 추정이 성립하지 않는다.',
    },
    challenges: [{ id: 'c1', text: '단순 개수 세기가 오해를 일으키는 형상을 찾아라.', answer: '임의의 미우라 접기($N - 3M \\le 0$, $\\text{DoF} = 1$), 또는 임의의 평탄 상태(랭크 감소).' }],
    theory: ['dof', 'closure'],
  },
  {
    id: 'l3-stepwise', lecture: 3, title: '단계적 기구학 (미우라 꼭짓점)', kind: 'lab', lab: 'stepwise',
    content: {
      concept: '기하 특화 해석: 기준 면을 고정하고 이웃 면을 차례로 붙여, 사영, 대칭, 직교성, 구면 코사인 법칙으로 종속 접힘각을 유도한다.',
      observe: '실시간 유도 결과는 범용 수치 솔버와 ~1e-10 이내로 일치한다.',
      experiment: '$\\rho_1$과 $\\alpha$를 바꾸고, 각 단계를 따라가며 솔버 열과 비교한다.',
      meaning: '닫힌 형태의 해는 특수 기하(여기서는 대칭 미우라 꼭짓점)에서만 존재한다. 그 밖의 모든 경우는 범용 솔버가 처리한다.',
    },
    challenges: [{ id: 'c1', text: '모든 $\\rho_1$에 대해 $\\tan(|\\rho_1|/2) = \\cos\\alpha \\cdot \\tan(|\\rho_2|/2)$가 성립함을 보여라.' }],
    theory: ['stepwise', 'miura'],
  },
  {
    id: 'l3-solver', lecture: 3, title: '범용 구속 솔버', kind: 'model', generator: 'singleVertex',
    params: { sectors: '60,40,70,80,50,60', mv: 'M,V,M,M,V,M' }, solver: 'rigid', enforceMV: true,
    content: {
      concept: '$q$ = 접힘각; $C(q)$ = 폐합 잔차; $J = \\partial C/\\partial q$ (야코비안). 구동 크리스(driving crease)는 좌표 하나를 고정한다. 나머지는 Levenberg–Marquardt로 $\\min \\|C(q)\\|^2$를 풀어 구하고, 연속법(continuation)으로 분기를 추적한다.',
      observe: '6차 꼭짓점은 $N - 3M = 3$이다: 구동 하나 후에도 자유도 2가 남으므로 솔버는 최소 변화를 선택한다. 크리스를 잠가 자유도를 제거한다.',
      experiment: '$\\rho_1$을 구동한다. 그다음 $\\rho_2$와 $\\rho_3$을 잠그고 다시 구동하면 운동이 유일해진다. 하나 더 잠그면 실현 불가능하다.',
      meaning: '$n$-자유도 메커니즘에서 $k$개의 각을 지정하면 $n - k$의 자유도가 남는다. 과잉 지정은 "근사적으로 풀리는" 것이 아니라 실현 불가능하다.',
    },
    challenges: [{ id: 'c1', text: '구동이 실현 불가능해질 때까지 크리스를 잠가라. 몇 개를 잠가야 했는가?', answer: '$N - 3M = 3$일 때: 구동 + 잠금 2개 = 지정 3개 ⇒ 유일; 세 번째 잠금 ⇒ 과잉 구속.' }],
    theory: ['closure', 'lm', 'dof'],
  },
  {
    id: 'l3-energy', lecture: 3, title: '에너지법 (Energy Method)', kind: 'model', generator: 'squareTwist', params: { phi: 25, L: 1.6 },
    solver: 'energy', panels: ['energyPresets'],
    content: {
      concept: 'bar-and-hinge 모델: $V = \\sum \\tfrac12 k_{\\text{axial}}/L_0\\,(l - L_0)^2 + \\sum \\tfrac12 k_{\\text{crease}} L_0 (\\rho - \\rho_t)^2 + \\sum \\tfrac12 k_{\\text{facet}} L_0 (\\alpha - \\alpha_0)^2$, $F = -\\nabla V$, 감쇠 동역학으로 최솟값까지 이완시킨다.',
      observe: 'Energy 모드에서는 사각 꼬임의 구동이 성공하지만, 면이 굽혀지고(대각 힌지) 바(bar)에 변형률이 생긴다. 강성비 $k_{\\text{facet}}/k_{\\text{crease}}$가 결과가 얼마나 "강체처럼" 보이는지를 결정한다.',
      experiment: '"동역학 실행"을 누르고 크리스를 구동한 뒤, 프리셋을 "강체에 가까움" → "종이" → "매우 유연함"으로 바꾸며 변형률과 면 굽힘을 비교한다.',
      meaning: '에너지법은 "기구학적으로 가능한가?"가 아니라 "어떤 변형이 가장 적은 비용인가?"에 답한다. "강체에 가까움" 강성에서는 실현 불가능한 강체 운동이 큰 에너지로 드러난다.',
    },
    challenges: [{ id: 'c1', text: '$k_{\\text{facet}}$을 10배로 키워라. 최대 면 굽힘은 어떻게 변하는가?' }],
    theory: ['energy', 'force'],
  },
  // ───────────────────────────── Lecture 4
  {
    id: 'l4-miura', lecture: 4, title: '미우라 접기 (Miura-ori)', kind: 'model', generator: 'miura', params: { rows: 3, cols: 3, a: 1, b: 1, alpha: 60 }, patternFold: 'rigid',
    solver: 'rigid', enforceMV: true, panels: ['miuraMetrics'],
    presets: [
      { label: '2×2', params: { rows: 2, cols: 2 } },
      { label: '3×3', params: { rows: 3, cols: 3 } },
      { label: '3×4 (내부 꼭짓점 $M = 6$)', params: { rows: 3, cols: 4 } },
      { label: '6×6', params: { rows: 6, cols: 6 } },
    ],
    content: {
      concept: '미우라 접기는 자유도 1의 오세틱(auxetic) 메커니즘으로 거동한다: 접힘각 하나가 전체 형상을 결정하며, 평면 내 두 방향 모두(BOTH)로 수축한다(음의 푸아송비).',
      observe: '지그재그 크리스에서 $\\rho_2 = \\rho_4$, 직선 크리스에서 $\\rho_3 = -\\rho_1$이다. $\\rho_1$이 커지면 $W$와 $L$이 모두 감소한다.',
      experiment: '$\\rho_1$을 $0^\\circ$에서 $100^\\circ$까지 움직인다. 그다음 $\\rho_1$을 잠근 상태에서 $\\rho_2$를 선택하여 바꾸어 본다.',
      meaning: '하나의 일반화 좌표가 강체 접기 운동을 매개변수화한다. 오세틱 성질은 기하학적 귀결이며, 여기서는 실제 꼭짓점 위치로부터 측정된다.',
      question: '적합성(compatibility)을 깨지 않고 $\\rho_2$를 독립적으로 움직일 수 있는가?',
      answer: '없다. $\\rho_1$을 잠그면 메커니즘에 남는 자유도가 없다.',
    },
    challenges: [
      { id: 'c1', text: '크리스 하나가 나머지 모두를 결정함을 확인하라(임의의 크리스를 구동하고 나머지를 관찰한다).' },
      { id: 'c2', text: '측정된 푸아송비를 $-\\cos^2\\theta \\tan^2\\alpha$와 비교하라.' },
    ],
    theory: ['miura', 'miuraPoisson', 'dof', 'convention'],
  },
  {
    id: 'l4-waterbomb', lecture: 4, title: '워터밤(Waterbomb) 테셀레이션', kind: 'model', generator: 'waterbomb', params: { cols: 5, rows: 5 }, patternFold: 'energy', patternFoldStart: 0.3,
    solver: 'energy', panels: ['curvature'],
    content: {
      concept: '워터밤(Waterbomb) 테셀레이션은 오세틱이며 돔/구 형태를 만들 수 있다: 종이 자체는 가전개(developable) 상태를 유지하지만, 유효(EFFECTIVE) 곡면은 양의 가우스 곡률을 갖게 된다.',
      observe: '종이 위의 각 결손(angle defect)은 $\\approx 0$으로 유지된다(가전개). 베이스 중심들을 지나는 조대(coarse) 곡면에서 $K = 2\\pi - \\sum \\text{angles}$는 패턴을 어떻게(HOW) 접느냐에 따라 달라진다: 균일하게 접으면 거의 원통으로 말리고($K \\approx 0$), 바깥 베이스를 중심보다 더 많이 접으면(반경 방향 그레이딩 $g > 0$) 돔이 되며($K > 0$), $g < 0$이면 안장이 된다($K < 0$).',
      experiment: 'Energy 탭 → 반경 방향 그레이딩 $g$로 "fold all"을 실행한다. $g = 1.2$(돔)에서 시작하여 $g = 0$, $g = -1$로 설정한다. 각 이완 후 Geometry 탭에서 조대 $K$를 읽는다.',
      meaning: '양의 각 결손 ⇒ 국소적으로 돔형(synclastic). 이는 종이가 아니라 조대화(coarse-grained) 곡면의 이산(DISCRETE) 곡률 추정이다.',
    },
    challenges: [{ id: 'c1', text: '중심에서의 조대 각 결손을 경계 근처의 값과 비교하라.' }],
    theory: ['gaussian', 'dof'],
  },
  {
    id: 'l4-wbbase', lecture: 4, title: '워터밤 베이스 (8차)', kind: 'model', generator: 'waterbombBase', solver: 'rigid', enforceMV: true, useSymmetry: true,
    content: {
      concept: '8차 꼭짓점은 $N - 3M = 5$의 자유도를 갖는다. 4중 대칭(모든 대각선 동일, 모든 중선 동일)을 부과하면 자유도 1의 운동으로 줄어든다.',
      observe: '"Symmetry links"를 켜면 대각선 하나를 구동할 때 여덟 크리스가 모두 일관되게 움직인다.',
      experiment: 'Symmetry links를 끄고 다시 구동한다: 솔버는 자유도 5 링키지의 최소 변화 운동을 선택한다.',
      meaning: '4M/4V는 Maekawa 정리를 위반하므로, 이는 평탄 접힘이 아니라 3D (쌍안정) 상태이다.',
    },
    challenges: [{ id: 'c1', text: '운동을 유일하게 만들기 위해 솔버에 추가 구속이 필요한 이유는 무엇인가?' }],
    theory: ['dof', 'maekawa'],
  },
  // ───────────────────────────── Lecture 5
  {
    id: 'l5-resch', lecture: 5, title: 'Ron Resch 패턴', kind: 'model', generator: 'resch', params: { m: 3, n: 2, variant: 'valid' },
    solver: 'energy', panels: ['reschVertices'],
    content: {
      concept: 'Resch 테셀레이션: 아래를 향한 표면 삼각형과 3중 별 모양 턱(tuck)으로 구성된다. 오세틱이며, 매끈해 보이는 샌드위치 곡면으로 접힌다.',
      observe: '턱 중심 또는 격자 꼭짓점을 클릭한다: 두 곳 모두 Kawasaki 조건은 성립하지만 Maekawa 조건은 실패한다(3M/3V 및 5M/1V) ⇒ 평탄 접힘 가능하지 않지만, 많은 자유도를 가지며 강체 접힘 가능하다.',
      experiment: '유효(valid) 변형과 "perturbed" 변형(턱 중심을 변위시킴)을 비교한다: perturbed 변형은 Kawasaki 조건을 만족하지 않는다.',
      meaning: '평탄 접힘 가능성 검사는 꼭짓점 단위의 국소 검사이다. 패턴은 완전히 강체 접힘 가능하면서도 평탄 접힘 가능하지 않을 수 있다.',
    },
    challenges: [{ id: 'c1', text: '3×2 패치의 $N$, $M$, $N - 3M$을 구하고 $\\text{DoF}_{\\text{local}}$과 비교하라.' }],
    theory: ['kawasaki', 'maekawa', 'dof'],
  },
  {
    id: 'l5-boxpleat', lecture: 5, title: '박스 플리팅 (Box pleating)', kind: 'model', generator: 'boxpleat', params: { n: 4, preset: 'tray' }, solver: 'energy',
    presets: [
      { label: '트레이 (Tray)', params: { preset: 'tray' } },
      { label: '플리트 (Pleat)', params: { preset: 'pleat' } },
      { label: '격자 골격만 (Bare framework)', params: { preset: 'grid' } },
    ],
    content: {
      concept: '$0^\\circ/45^\\circ/90^\\circ$ 선으로 이루어진 고정 격자는 골격(FRAMEWORK)이다. 설계는 그 부분집합에 M/V 배정을 더한 것이다. 하나의 골격으로 광범위한 목표 형상군을 구현할 수 있다.',
      observe: '프리셋을 바꾸면 어떤 선이 접히는지만 달라지고 격자는 동일하다.',
      experiment: '트레이를 접은 뒤(Energy 모드에서 Play), Pleat로 전환한다. 인스펙터에서 개별 격자선을 F/M/V로 전환한다.',
      meaning: '박스 플리팅(box pleating)은 설계 방법론(Lang)이다. 임의 형상 최적화는 여기서 다루지 않는다.',
    },
    challenges: [{ id: 'c1', text: '트레이의 F 선 하나를 M으로 바꾸고 형상 변화를 관찰하라.' }],
    theory: ['energy'],
  },
  {
    id: 'l5-kresling', lecture: 5, title: 'Kresling 원통', kind: 'model', generator: 'kresling',
    params: { n: 6, R: 1, H: 1.2, phi: 45, cells: 1, chirality: 'right', caps: true }, solver: 'rigid', enforceMV: false,
    experiment: 'kreslingAxial', panels: ['kreslingCompat'],
    content: {
      concept: 'Kresling 원통: 꼬인 다각형 링들이 삼각형으로 연결된 구조이다. 축 하중을 받으면 짧아지면서 동시에(AND) 비틀린다(비틀림 좌굴). 평면 강체 링을 가정하면 강체 메커니즘이 아니다: 상태 전이에는 패널 변형이 필요하다.',
      observe: 'Rigid 모드: 끝 다각형이 있으면 $\\text{DoF}_{\\text{local}} = 0$ — 모든 구동이 실현 불가능하다. 해석적 적합성 그래프는 모든 삼각형 변을 유지하는 데 필요한 변형률을 보여준다. Energy 모드: 에너지 최소화로부터 비틀리며 압축되는 경로가 나타나고, 예측된 두 번째 안정 상태 위치에 두 번째 에너지 우물이 존재한다.',
      experiment: '1) Rigid 모드에서 크리스를 구동한다. 2) 축 압축 실험(비틀림 자유)을 실행한다. 3) $\\operatorname{twist}(u)$를 예측값 $\\varphi_1 - \\varphi_0$와 비교한다.',
      meaning: '이상적인 Kresling은 자유로운 강체 메커니즘이 아니라 쌍안정 구조이다. 물리적으로 타당한 운동 = 에너지 지형의 저변형률 경로.',
    },
    challenges: [{ id: 'c1', text: '"Rigid end polygons"를 해제하라. $\\text{DoF}_{\\text{local}}$은 어떻게, 왜 변하는가?', answer: '관은 헐거운(floppy) 삼각형 분할 띠가 된다: 이를 잠그고 있던 것은 공면성/강체 링 구속이었다.' }],
    theory: ['kresling', 'energy', 'reaction', 'dof'],
  },
  {
    id: 'l5-yoshimura', lecture: 5, title: 'Yoshimura 좌굴', kind: 'model', generator: 'yoshimura',
    params: { n: 8, R: 1, height: 2.4, rows: 4, variant: 'smooth', imperfection: 0.01, caps: false }, solver: 'energy',
    experiment: 'yoshimuraCompression',
    presets: [
      { label: '매끈한 원통 (균일 굽힘)', params: { variant: 'smooth' } },
      { label: '사전 크리스 Yoshimura', params: { variant: 'creased' } },
    ],
    content: {
      concept: '축 압축을 받는 얇은 원통은 다이아몬드(Yoshimura) 패턴으로 좌굴한다: 균일 압축이 굽힘보다 에너지적으로 비싸지면, 계는 더 낮은 에너지의 변형 모드를 따른다.',
      observe: '좌굴 전: 축 에너지가 $\\sim u^2$로 증가한다. 좌굴 개시 시점: 축 에너지가 떨어지고 굽힘 에너지가 급증하며 반력이 떨어진다(스냅).',
      experiment: '압축 실험을 실행하고 $u$를 따라 훑어 본다. 반력 그래프에서 개시점을 찾는다.',
      meaning: '관찰되는 형상은 에너지적으로 유리한 모드에 해당한다. 주의: 메시가 Yoshimura 격자에 정렬되어 있으므로 모드 형상은 이산화의 영향을 받는다. 물리적 핵심은 에너지 경쟁이다.',
    },
    challenges: [{ id: 'c1', text: '압축을 증가시키며 좌굴 개시점($u$와 반력)을 찾아라.' }],
    theory: ['energy', 'reaction'],
  },
  {
    id: 'l5-compare', lecture: 5, title: 'Kresling vs Yoshimura', kind: 'lab', lab: 'kreslingVsYoshimura',
    content: {
      concept: 'Kresling: 비틀림 좌굴(압축이 비틀림과 연성됨). Yoshimura: 압축 좌굴(비틀림 연성 없음).',
      observe: '상판이 자유롭게 회전하도록 두고 두 구조에 같은 압축을 가한다: Kresling만 회전한다.',
      experiment: '공용 압축 및 비틀림 슬라이더를 사용하여 에너지와 유도된 비틀림을 비교한다.',
      meaning: '크리스 패턴의 카이랄성(chirality)이 어떤 하중 모드가 연한(soft)지를 결정한다.',
    },
    challenges: [{ id: 'c1', text: 'Kresling에 잘못된 방향으로 비틀림을 지정하라. 에너지는 어떻게 되는가?' }],
    theory: ['kresling', 'energy'],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
