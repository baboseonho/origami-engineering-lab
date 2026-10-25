import { getLang } from '../i18n';

/** Fields a reader may care about; each structure lists where it is used. */
export type Field = 'space' | 'medical' | 'architecture' | 'robotics' | 'everyday' | 'vehicles' | 'art';

export const FIELDS: { id: Field; ko: string; en: string; icon: string }[] = [
  { id: 'everyday', ko: '생활 · 포장', en: 'Everyday · packaging', icon: 'ShoppingBag' },
  { id: 'space', ko: '우주', en: 'Space', icon: 'Satellite' },
  { id: 'medical', ko: '의료', en: 'Medicine', icon: 'HeartPulse' },
  { id: 'architecture', ko: '건축', en: 'Architecture', icon: 'Building2' },
  { id: 'robotics', ko: '로봇', en: 'Robotics', icon: 'Bot' },
  { id: 'vehicles', ko: '자동차 · 안전', en: 'Vehicles · safety', icon: 'Car' },
  { id: 'art', ko: '예술 · 취미', en: 'Art · hobby', icon: 'Palette' },
];

interface Bi { ko: string; en: string }

export interface Structure {
  id: string;
  /** the sheet that teaches it */
  sheet: string;
  name: Bi;
  /** an everyday question that makes you want to open it */
  hook: Bi;
  fields: Field[];
  /** where it is used, one line each */
  uses: Bi[];
  /** what it teaches, each linked to a sheet */
  theory: { label: Bi; sheet: string }[];
  /** how it folds, in one phrase */
  motion: Bi;
  level: 1 | 2 | 3;
}

export const STRUCTURES: Structure[] = [
  {
    id: 'shoppingBag', sheet: 'l3-bag', level: 2,
    name: { ko: '쇼핑백', en: 'Shopping bag' },
    hook: { ko: '쇼핑할 때 쓰는 쇼핑백, 어떤 원리로 납작하게 접히는지 궁금한가요?', en: 'The paper bag you carry home from the shop: how does it fold flat?' },
    fields: ['everyday'],
    uses: [
      { ko: '바닥이 평평한 종이봉투와 그 접는 방식은 오늘날 쇼핑백과 포장 상자의 기본이다.', en: 'The flat-bottomed paper bag and the way it folds underlie today\'s shopping bags and packaging.' },
      { ko: '포장 설계에서는 "납작하게 운반했다가 세워 쓰는" 구조를 만들 때 같은 질문을 한다.', en: 'Packaging design asks the same question whenever something ships flat and stands up in use.' },
    ],
    theory: [
      { label: { ko: '강체로는 접히지 않는다 (쇼핑백 정리)', en: 'It cannot fold rigidly (shopping-bag theorem)' }, sheet: 'l3-bag' },
      { label: { ko: '면이 휘어야 접힌다 (에너지법)', en: 'Faces must bend (energy method)' }, sheet: 'l3-energy' },
      { label: { ko: '자유도 세기', en: 'Counting degrees of freedom' }, sheet: 'l3-dof' },
    ],
    motion: { ko: '모든 크리스가 함께 접히고 면이 살짝 휜다', en: 'Every crease folds together while the faces bend slightly' },
  },
  {
    id: 'miura', sheet: 'l4-miura', level: 1,
    name: { ko: '미우라 접기', en: 'Miura-ori' },
    hook: { ko: '큰 지도를 대각선으로 한 번 당기면 펴지고, 밀면 접힌다. 우주의 태양전지판도 같은 원리다.', en: 'Pull a big map by two corners and it opens; push and it folds. Solar panels in space use the same idea.' },
    fields: ['space', 'everyday', 'architecture'],
    uses: [
      { ko: '한 번에 펴고 접는 지도, 접이식 판넬과 차양에 쓰인다.', en: 'Maps that open and close in one motion, folding panels and shades.' },
      { ko: '접힌 심재(core)는 가볍고 단단한 샌드위치 판의 재료로 연구된다.', en: 'Folded cores are studied for light, stiff sandwich panels.' },
    ],
    theory: [
      { label: { ko: '자유도 1: 하나가 전부를 정한다', en: 'One DoF: one angle decides everything' }, sheet: 'l3-dof' },
      { label: { ko: 'Kawasaki 조건', en: 'Kawasaki condition' }, sheet: 'l2-kawasaki' },
      { label: { ko: '단계적 기구학 유도', en: 'Stepwise kinematics' }, sheet: 'l3-stepwise' },
    ],
    motion: { ko: '각도 하나로 전체가 동시에 접힌다 (강체, 자유도 1)', en: 'The whole sheet folds together from one angle (rigid, 1 DoF)' },
  },
  {
    id: 'yoshimura', sheet: 'l5-yoshimura', level: 2,
    name: { ko: 'Yoshimura 패턴', en: 'Yoshimura pattern' },
    hook: { ko: '빈 캔을 위에서 밟으면 왜 다이아몬드 무늬로 찌그러질까?', en: 'Step on an empty can: why does it crumple into diamonds?' },
    fields: ['vehicles', 'space', 'everyday'],
    uses: [
      { ko: '얇은 원통이 축 방향으로 눌릴 때 저절로 나타나는 좌굴 무늬다.', en: 'The buckling pattern that thin cylinders form on their own under axial load.' },
      { ko: '충격을 흡수하는 크래시 박스와 접이식 원통 구조의 설계에 응용된다.', en: 'Applied to energy-absorbing crash boxes and collapsible tubes.' },
    ],
    theory: [
      { label: { ko: '좌굴과 에너지 경쟁', en: 'Buckling and competing energies' }, sheet: 'l5-yoshimura' },
      { label: { ko: 'Kresling과 비교', en: 'Compared with Kresling' }, sheet: 'l5-compare' },
    ],
    motion: { ko: '눌리면 좌굴하며 다이아몬드로 접힌다 (Energy)', en: 'Buckles into diamonds when pressed (Energy)' },
  },
  {
    id: 'kresling', sheet: 'l5-kresling', level: 3,
    name: { ko: 'Kresling 원통', en: 'Kresling tube' },
    hook: { ko: '누르면서 비틀면 "딸깍" 하고 납작해지는 원통. 두 모양을 기억하는 구조다.', en: 'Press and twist: a tube that snaps flat with a click, a structure that remembers two shapes.' },
    fields: ['robotics', 'space', 'vehicles'],
    uses: [
      { ko: '접었다 펴는 전개 붐, 쌍안정 로봇 관절과 크롤링 로봇의 몸체로 연구된다.', en: 'Studied for deployable booms, bistable robot joints and crawling robot bodies.' },
      { ko: '두 안정 상태를 이용한 기계식 스위치와 메모리의 기본 단위가 된다.', en: 'A basic unit for mechanical switches and memory that use two stable states.' },
    ],
    theory: [
      { label: { ko: '쌍안정과 에너지 지형', en: 'Bistability and the energy landscape' }, sheet: 'l5-kresling' },
      { label: { ko: '비틀림 좌굴 vs 압축 좌굴', en: 'Twist buckling vs compression buckling' }, sheet: 'l5-compare' },
    ],
    motion: { ko: '압축과 비틀림이 함께 일어나며 두 상태 사이를 오간다', en: 'Compresses and twists together, snapping between two states' },
  },
  {
    id: 'waterbomb', sheet: 'l4-waterbomb', level: 2,
    name: { ko: '워터밤 테셀레이션', en: 'Waterbomb tessellation' },
    hook: { ko: '평평한 종이가 공처럼 둥글게 말린다. 종이는 늘어나지 않는데 어떻게?', en: 'A flat sheet curls into a ball. Paper does not stretch, so how?' },
    fields: ['medical', 'robotics', 'architecture'],
    uses: [
      { ko: '모양이 바뀌는 바퀴와 부드러운 로봇 몸체로 연구된다.', en: 'Studied for shape-changing wheels and soft robot bodies.' },
    ],
    theory: [
      { label: { ko: '가우스 곡률과 가전개성', en: 'Gaussian curvature and developability' }, sheet: 'l4-waterbomb' },
      { label: { ko: '물폭탄 기본형의 자유도', en: 'DoF of the waterbomb base' }, sheet: 'l4-wbbase' },
    ],
    motion: { ko: '모든 베이스를 함께 접으면 돔이나 원통으로 말린다 (Energy)', en: 'Folding every base together curls it into a dome or tube (Energy)' },
  },
  {
    id: 'waterbombTube', sheet: 'l6-wbtube', level: 2,
    name: { ko: '워터밤 튜브', en: 'Waterbomb tube' },
    hook: { ko: '둘레에 몇 개, 길이 방향으로 몇 개를 반복하느냐에 따라 반지름과 길이가 정해진다. 직접 바꿔 보자.', en: 'How many units around and how many along decide the radius and length. Change them yourself.' },
    fields: ['medical', 'robotics', 'art'],
    uses: [
      { ko: '지름이 크게 줄었다 늘어나는 관 구조로, 스텐트와 로봇 몸체 연구에 쓰인다.', en: 'A tube whose diameter shrinks and grows a lot, studied for stents and robot bodies.' },
      { ko: '종이접기 작품 "매직 볼"의 기본 구조다.', en: 'The structure behind the folded "magic ball".' },
    ],
    theory: [
      { label: { ko: '반복 수와 반지름의 관계', en: 'Repeat count and radius' }, sheet: 'l6-wbtube' },
      { label: { ko: '워터밤 테셀레이션', en: 'Waterbomb tessellation' }, sheet: 'l4-waterbomb' },
    ],
    motion: { ko: '둘레를 따라 접으면 지름이 줄고 길이가 바뀐다', en: 'Folding around the tube shrinks the diameter and changes the length' },
  },
  {
    id: 'resch', sheet: 'l5-resch', level: 3,
    name: { ko: 'Ron Resch 패턴', en: 'Ron Resch pattern' },
    hook: { ko: '삼각형만 접었는데 매끈한 돔이 된다. 1960년대 예술가이자 공학자가 만든 패턴이다.', en: 'Fold only triangles and get a smooth dome. A pattern by a 1960s artist and engineer.' },
    fields: ['architecture', 'art'],
    uses: [
      { ko: '접어서 만드는 곡면 패널, 가구와 건축 외피의 형태 연구에 쓰인다.', en: 'Used to study folded curved panels, furniture and building skins.' },
    ],
    theory: [
      { label: { ko: '평탄 접힘 불가지만 강체 접힘 가능', en: 'Not flat-foldable, yet rigid-foldable' }, sheet: 'l5-resch' },
      { label: { ko: 'Maekawa 조건', en: 'Maekawa condition' }, sheet: 'l2-maekawa' },
    ],
    motion: { ko: '턱(tuck)이 모이며 표면이 곡면을 이룬다 (Energy)', en: 'Tucks gather and the surface forms a curve (Energy)' },
  },
  {
    id: 'squareTwist', sheet: 'l2-terms', level: 2,
    name: { ko: '사각 꼬임', en: 'Square twist' },
    hook: { ko: '가운데를 비틀면 납작해진다. 그런데 면을 휘지 않고는 절대 접히지 않는다. 왜일까?', en: 'Twist the centre and it flattens, yet it never folds without bending its faces. Why?' },
    fields: ['art', 'architecture'],
    uses: [
      { ko: '테셀레이션 작품의 기본 단위다 (Fujimoto).', en: 'A basic unit of tessellation art (Fujimoto).' },
      { ko: '평탄 접힘과 강체 접힘이 다르다는 것을 보여 주는 대표 예다.', en: 'The standard example that flat folding and rigid folding differ.' },
    ],
    theory: [
      { label: { ko: '평탄 ≠ 강체', en: 'Flat ≠ rigid' }, sheet: 'l2-terms' },
      { label: { ko: 'Kawasaki 조건', en: 'Kawasaki condition' }, sheet: 'l2-kawasaki' },
    ],
    motion: { ko: '가운데가 돌며 네 플리트가 함께 눕는다 (Energy)', en: 'The centre turns while four pleats lie down together (Energy)' },
  },
  {
    id: 'twist', sheet: 'l6-twist', level: 2,
    name: { ko: '다각형 꼬아 접기', en: 'Polygon twist folds' },
    hook: { ko: '삼각형, 사각형, 육각형을 비틀어 접으면 어떤 무늬가 될까?', en: 'Twist a triangle, a square, a hexagon: what patterns appear?' },
    fields: ['art', 'space'],
    uses: [
      { ko: '테셀레이션 작품에서 꼬임을 이어 붙여 큰 무늬를 만든다.', en: 'Tessellation artists join twists into large patterns.' },
      { ko: '회전하며 펼쳐지는 전개 구조의 아이디어가 된다.', en: 'An idea behind structures that deploy by rotating.' },
    ],
    theory: [
      { label: { ko: 'Kawasaki 조건', en: 'Kawasaki condition' }, sheet: 'l2-kawasaki' },
      { label: { ko: 'big–little–big', en: 'Big–little–big' }, sheet: 'l2-mv' },
    ],
    motion: { ko: '가운데 다각형이 돌며 플리트가 눕는다', en: 'The centre polygon turns as the pleats lie down' },
  },
  {
    id: 'pleat', sheet: 'l0-pleat', level: 1,
    name: { ko: '플리트 (아코디언)', en: 'Pleat (accordion)' },
    hook: { ko: '부채, 아코디언, 블라인드. 가장 단순한 접기에서 모든 것이 시작된다.', en: 'Fans, accordions, blinds: everything starts with the simplest fold.' },
    fields: ['everyday', 'architecture', 'art'],
    uses: [
      { ko: '부채, 블라인드, 주름 갓, 아코디언 주름관(벨로즈)에 쓰인다.', en: 'Fans, blinds, pleated shades and bellows.' },
      { ko: '접힌 판(folded plate) 지붕은 같은 원리로 얇은 판을 단단하게 만든다.', en: 'Folded-plate roofs use the same idea to stiffen thin sheets.' },
    ],
    theory: [
      { label: { ko: '산접기와 골접기', en: 'Mountain and valley folds' }, sheet: 'l0-pleat' },
      { label: { ko: '1D 접기', en: '1D folding' }, sheet: 'l2-strip' },
    ],
    motion: { ko: '모든 크리스가 같은 각도로 함께 접힌다', en: 'Every crease folds together by the same angle' },
  },
  {
    id: 'hypar', sheet: 'l6-hypar', level: 2,
    name: { ko: '하이파 (쌍곡포물면)', en: 'Hypar (hyperbolic paraboloid)' },
    hook: { ko: '직선만 접었는데 말안장 모양 곡면이 된다. 왜 그럴까?', en: 'Fold only straight lines and get a saddle. Why?' },
    fields: ['architecture', 'art'],
    uses: [
      { ko: '같은 쌍곡포물면 형태가 얇은 콘크리트 셸 지붕에 쓰인다.', en: 'The same hyperbolic-paraboloid form is used for thin concrete shell roofs.' },
      { ko: '바우하우스의 종이 조형 수업에서 유명해진 패턴이다.', en: 'A pattern made famous by paper studies at the Bauhaus.' },
    ],
    theory: [
      { label: { ko: '면이 휘어야 접힌다 (에너지법)', en: 'Faces must bend (energy method)' }, sheet: 'l3-energy' },
      { label: { ko: '곡률', en: 'Curvature' }, sheet: 'l4-waterbomb' },
    ],
    motion: { ko: '동심 사각형을 함께 접으면 말안장으로 휜다 (Energy)', en: 'Folding the concentric squares together bends it into a saddle (Energy)' },
  },
  {
    id: 'boxpleat', sheet: 'l5-boxpleat', level: 3,
    name: { ko: '박스 플리팅', en: 'Box pleating' },
    hook: { ko: '다리가 여덟 개인 거미를 종이 한 장으로 접으려면 어떻게 설계할까?', en: 'How do you design an eight-legged spider from one sheet?' },
    fields: ['art', 'robotics'],
    uses: [
      { ko: '사실적인 곤충·동물 작품의 설계 방법이다.', en: 'A design method for realistic insects and animals.' },
      { ko: '격자 위에서 설계하므로 계산과 제작이 쉬워 공학 설계에도 쓰인다.', en: 'Designed on a grid, so it is easy to compute and build, and is used in engineering too.' },
    ],
    theory: [
      { label: { ko: '격자와 설계', en: 'Grids and design' }, sheet: 'l5-boxpleat' },
      { label: { ko: '설계 알고리즘 지도', en: 'Map of design algorithms' }, sheet: 'l7-beyond' },
    ],
    motion: { ko: '격자 중 고른 선만 접어 트레이를 만든다 (Energy)', en: 'Folds only the chosen grid lines into a tray (Energy)' },
  },
  {
    id: 'singleVertex', sheet: 'l2-single', level: 1,
    name: { ko: '꼭짓점 하나', en: 'A single vertex' },
    hook: { ko: '모든 패턴은 꼭짓점의 모임이다. 꼭짓점 하나가 어떻게 접히는지부터 보자.', en: 'Every pattern is a collection of vertices. Start with how one vertex folds.' },
    fields: ['art'],
    uses: [{ ko: '모든 크리스 패턴을 이해하는 출발점이다.', en: 'The starting point for understanding any crease pattern.' }],
    theory: [
      { label: { ko: 'Kawasaki 조건', en: 'Kawasaki condition' }, sheet: 'l2-kawasaki' },
      { label: { ko: 'Maekawa 조건', en: 'Maekawa condition' }, sheet: 'l2-maekawa' },
      { label: { ko: '닫힘 조건', en: 'Closure condition' }, sheet: 'l3-solver' },
    ],
    motion: { ko: '4개짜리 꼭짓점은 각도 하나로 전부 정해진다', en: 'A four-crease vertex is set by one angle' },
  },
];

/** The structure a sheet is about, if any. */
export const structureForSheet = (sheet: string) => STRUCTURES.find((s) => s.sheet === sheet);

/** Pick the current-language string of a bilingual pair. */
export const bi = (b: Bi) => (getLang() === 'en' ? b.en : b.ko);
