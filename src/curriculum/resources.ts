/**
 * Videos, tools and readings for the "beyond / tools / hobby" pages.
 *
 * Every URL here was checked by hand when this file was written:
 * - YouTube links were checked with the oEmbed endpoint
 *   (https://www.youtube.com/oembed?url=<watch url>&format=json), which gives
 *   the real title and channel, and against the watch page for length and description.
 * - Other links were fetched and their page title or README read.
 * A link that could not be confirmed is left out. Do not add a link without checking it the same way.
 */

export type Level = 'beginner' | 'intermediate' | 'advanced';
export interface Bi { ko: string; en: string }

export interface Video {
  /** short kebab id, e.g. 'lang-ted-math-magic' */
  id: string;
  /** the real title as on YouTube (original language) */
  title: string;
  /** channel / speaker */
  channel: string;
  /** verified watch URL */
  url: string;
  /** spoken language ('none' = no narration) */
  lang: 'en' | 'ko' | 'ja' | 'none';
  level: Level;
  /** approximate length in minutes */
  minutes?: number;
  /** one sentence: what you learn */
  about: Bi;
  topics: string[];
}

export interface Tool {
  id: string;
  name: string;
  url: string;
  author: string;
  kind: 'design' | 'simulate' | 'format' | 'library' | 'learn';
  platform: Bi;
  free: boolean;
  /** one or two sentences: what it does */
  what: Bi;
  /** when to use it, concretely */
  useFor: Bi;
  level: Level;
  /** verified GitHub repository, when the source is public */
  repo?: string;
  /**
   * licence exactly as the repository states it (its LICENSE file, or 'none stated').
   * This decides what we may reuse: MIT/Apache code and example files can be copied
   * with the notice kept; GPL code cannot be pasted into this app without making it GPL.
   */
  license?: string;
}

export interface Reading {
  id: string;
  title: string;
  author: string;
  year?: number;
  url?: string;
  kind: 'book' | 'course' | 'paper' | 'site' | 'community';
  about: Bi;
  level: Level;
}

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const VIDEOS: Video[] = [
  // ───────────────────────── hobby basics ─────────────────────────
  {
    id: 'basics-valley-mountain',
    title: 'Origami Basics - Valley Folds and Mountain Folds Tutorial',
    channel: 'Art of Fold',
    url: yt('gLNHKyjXngk'),
    lang: 'en',
    level: 'beginner',
    minutes: 3,
    about: {
      ko: '모든 접기의 바탕인 골접기와 산접기를 접는 법과 도면 기호를 배운다.',
      en: 'How to make valley and mountain folds, the two folds every other fold is built from.',
    },
    topics: ['hobby-basics'],
  },
  {
    id: 'basics-squash-swivel',
    title: 'Origami Basics - Squash Folds & Swivel Folds Tutorial',
    channel: 'Art of Fold',
    url: yt('JCb0betOtSc'),
    lang: 'en',
    level: 'beginner',
    minutes: 3,
    about: {
      ko: '주머니를 펼쳐 누르는 펼쳐눌러접기(squash)와 스위블 접기를 익힌다.',
      en: 'How to open and flatten a flap with a squash fold, and how a swivel fold works.',
    },
    topics: ['hobby-basics'],
  },
  {
    id: 'nemo-basic-terms',
    title: '종이접기 기본용어 설명',
    channel: '네모아저씨',
    url: yt('Zxd7wogC_7o'),
    lang: 'ko',
    level: 'beginner',
    minutes: 23,
    about: {
      ko: '골접기·산접기, 안으로/밖으로 뒤집어접기, 계단접기, 펼쳐눌러접기, 함몰접기 같은 기본 용어를 한국어로 하나씩 보여 준다.',
      en: 'A Korean walkthrough of the basic fold names: valley/mountain, inside and outside reverse, pleat, squash and sink folds.',
    },
    topics: ['hobby-basics'],
  },
  {
    id: 'jjongi-10-basic-folds',
    title: '종이접기 기본 접기 10가지, 10 basic types of origami',
    channel: '쫑이쌤',
    url: yt('doBIa3swEo4'),
    lang: 'ko',
    level: 'beginner',
    minutes: 10,
    about: {
      ko: '여러 작품의 출발점이 되는 기본형 10가지를 한국어 설명과 함께 접어 본다.',
      en: 'Ten basic starting forms that many models begin from, explained in Korean.',
    },
    topics: ['hobby-basics'],
  },
  {
    id: 'tavin-preliminary-base',
    title: 'How to make the Origami preliminary base',
    channel: "Tavin's Origami Instructions",
    url: yt('aQETgposr4I'),
    lang: 'en',
    level: 'beginner',
    minutes: 3,
    about: {
      ko: '학과 새 기본형으로 가는 첫 단계인 정사각 기본형(preliminary base)을 천천히 접는다.',
      en: 'A slow walkthrough of the preliminary (square) base, the first step toward the bird base and the crane.',
    },
    topics: ['hobby-basics'],
  },
  {
    id: 'tavin-waterbomb-base',
    title: 'Origami Waterbomb Base',
    channel: "Tavin's Origami Instructions",
    url: yt('BjeKdDqRA24'),
    lang: 'en',
    level: 'beginner',
    minutes: 3,
    about: {
      ko: '물풍선 기본형(waterbomb base)을 접는다. 정사각 기본형과 산·골이 뒤바뀐 짝이다.',
      en: 'How to fold the traditional waterbomb base, the mountain/valley mirror of the preliminary base.',
    },
    topics: ['hobby-basics', 'waterbomb'],
  },
  {
    id: 'paperkawaii-bird-base',
    title: 'Origami Bird Base',
    channel: 'Paper Kawaii - Origami Tutorials',
    url: yt('E95AYqd1P2c'),
    lang: 'none',
    level: 'beginner',
    minutes: 4,
    about: {
      ko: '정사각 기본형에서 꽃잎 접기로 새 기본형(bird base)을 만든다. 학과 날갯짓하는 새의 바탕이다.',
      en: 'From the preliminary base to the bird base with petal folds, the base of the crane and the flapping bird.',
    },
    topics: ['hobby-basics', 'crane'],
  },
  {
    id: 'jo-nakashima-crane',
    title: 'Origami Tsuru (crane)',
    channel: 'Origami with Jo Nakashima',
    url: yt('F6I7uzy-ZKg'),
    lang: 'none',
    level: 'beginner',
    minutes: 5,
    about: {
      ko: '전통 종이학을 처음부터 끝까지 짧고 깔끔하게 접는다.',
      en: 'The traditional crane, start to finish, in five clear minutes.',
    },
    topics: ['hobby-basics', 'crane'],
  },
  {
    id: 'paperkawaii-crane',
    title: 'Easy Origami Crane Tutorial - Tsuru - Paper Kawaii',
    channel: 'Paper Kawaii - Origami Tutorials',
    url: yt('Ue0dVhO30cw'),
    lang: 'none',
    level: 'beginner',
    minutes: 11,
    about: {
      ko: '같은 전통 학을 더 천천히, 단계를 잘게 나누어 접는다.',
      en: 'The same traditional crane at a slower pace, with smaller steps.',
    },
    topics: ['hobby-basics', 'crane'],
  },
  {
    id: 'nemo-crane-two-ways',
    title: '[어느게 더 예쁜지 투표] 두가지 디자인의 종이학 접는 방법',
    channel: '네모아저씨',
    url: yt('Qsu5IL0eFTs'),
    lang: 'ko',
    level: 'beginner',
    minutes: 19,
    about: {
      ko: '흔히 배우는 종이학과 날씬한 종이학 두 가지를 한국어 설명으로 나란히 접는다.',
      en: 'Two versions of the paper crane folded side by side, with Korean narration.',
    },
    topics: ['hobby-basics', 'crane'],
  },
  {
    id: 'jo-nakashima-jumping-frog',
    title: 'ORIGAMI JUMPING FROG (Traditional model)',
    channel: 'Origami with Jo Nakashima',
    url: yt('Vlb2udqPx-M'),
    lang: 'none',
    level: 'beginner',
    minutes: 4,
    about: {
      ko: '등을 눌렀다 놓으면 뛰어오르는 전통 개구리를 접는다. 특별한 종이가 필요 없다.',
      en: 'A traditional frog that jumps when you press and release its back; any paper works.',
    },
    topics: ['hobby-basics'],
  },
  {
    id: 'paperkawaii-masu-box',
    title: 'Easy Origami Masu Box Tutorial - Easiest Method - Paper Kawaii',
    channel: 'Paper Kawaii - Origami Tutorials',
    url: yt('Cd5Z8hmcb10'),
    lang: 'en',
    level: 'beginner',
    minutes: 5,
    about: {
      ko: '종이 한 장으로 쓸모 있는 마스 상자를 가장 간단한 순서로 접는다.',
      en: 'A useful masu box from one sheet, using the shortest folding sequence.',
    },
    topics: ['hobby-basics'],
  },

  // ───────────────────── tessellations and patterns ─────────────────────
  {
    id: 'jester-miura-ori',
    title: 'Easy Miura-Ori Origami Tutorial',
    channel: 'Brian Jester',
    url: yt('2-fh1sA09mc'),
    lang: 'en',
    level: 'beginner',
    minutes: 9,
    about: {
      ko: '미우라 접기(Miura-ori)를 손으로 접고, 한 번에 펴지고 접히는 모습을 확인한다.',
      en: 'Fold a Miura-ori by hand and see it open and close in one motion.',
    },
    topics: ['miura', 'tessellation', 'applications'],
  },
  {
    id: 'happyfolding-waterbomb-tessellation',
    title: 'Origami Tessellation Instructions: Water Bomb Tessellation (Eric Gjerde)',
    channel: 'happyfolding.com - enjoy origami online',
    url: yt('VXIVHjws15U'),
    lang: 'en',
    level: 'intermediate',
    minutes: 17,
    about: {
      ko: '격자를 미리 접은 뒤 물풍선 기본형을 반복해 모아 접는 물풍선 테셀레이션(Eric Gjerde 디자인)을 배운다.',
      en: 'Pre-crease a grid, then collapse repeated waterbomb units into Eric Gjerde’s waterbomb tessellation.',
    },
    topics: ['waterbomb', 'tessellation'],
  },
  {
    id: 'gatheringfolds-closed-square-twist',
    title: 'Closed Square Twist Origami Tessellation Tutorial',
    channel: 'Gathering Folds',
    url: yt('2OvjainsOqk'),
    lang: 'en',
    level: 'intermediate',
    minutes: 7,
    about: {
      ko: '8칸 격자 위에서 테셀레이션의 가장 기본 동작인 정사각 트위스트를 접는다.',
      en: 'The closed square twist, the most basic tessellation move, on an 8-division grid.',
    },
    topics: ['twist', 'tessellation'],
  },
  {
    id: 'gjerde-hypar',
    title: 'Origami Hyperbolic Parabola Instructions',
    channel: 'Eric Gjerde',
    url: yt('4g1OcLHp6yI'),
    lang: 'en',
    level: 'beginner',
    minutes: 12,
    about: {
      ko: '동심 사각형 주름만으로 종이가 말안장 모양(하이퍼)으로 휘는 바우하우스 연습 작품을 접는다.',
      en: 'The Bauhaus hypar: concentric square pleats that make the sheet twist into a saddle.',
    },
    topics: ['tessellation', 'curved-crease'],
  },
  {
    id: 'aghabayli-yoshimura',
    title: 'Origami Tutorial - "Yoshimura pattern" (three scale variations)',
    channel: 'Aydan Aghabayli',
    url: yt('lqyeMqgYsdU'),
    lang: 'none',
    level: 'intermediate',
    minutes: 10,
    about: {
      ko: '요시무라 패턴을 세 가지 크기로 접어 보고 건축 형태로 쓰이는 모습을 본다.',
      en: 'Fold the Yoshimura pattern at three scales and see how it reads as architecture.',
    },
    topics: ['tessellation', 'applications'],
  },

  // ───────────────────── math and engineering ─────────────────────
  {
    id: 'ted-ed-satisfying-math',
    title: 'The satisfying math of folding origami - Evan Zodl',
    channel: 'TED-Ed',
    url: yt('etCW9M9VdGk'),
    lang: 'en',
    level: 'beginner',
    minutes: 5,
    about: {
      ko: '평평하게 접히는 꼭짓점이 따르는 규칙(마에카와·가와사키)을 짧은 애니메이션으로 소개한다.',
      en: 'A short animation of the rules a flat-folded vertex must obey (Maekawa and Kawasaki).',
    },
    topics: ['flat-foldability'],
  },
  {
    id: 'wired-11-levels',
    title: '11 Levels of Origami: Easy to Complex | WIRED',
    channel: 'WIRED',
    url: yt('MDwPXRy9IFc'),
    lang: 'en',
    level: 'beginner',
    minutes: 16,
    about: {
      ko: 'Robert J. Lang이 전통 매미부터 아주 복잡한 매미까지 11단계로 접기가 어떻게 어려워지는지 보여 준다.',
      en: 'Robert J. Lang climbs 11 levels of difficulty, from a traditional cicada to a highly complex one.',
    },
    topics: ['design', 'tree-method', 'hobby-basics'],
  },
  {
    id: 'lang-ted-math-magic',
    title: 'The math and magic of origami',
    channel: 'Robert Lang | TED',
    url: yt('NYKcOFQCeno'),
    lang: 'en',
    level: 'beginner',
    minutes: 18,
    about: {
      ko: '수학 규칙과 컴퓨터 설계가 현대 종이접기와 공학 응용(우주 망원경, 에어백, 스텐트)을 어떻게 바꿨는지 듣는다.',
      en: 'How math rules and computer design changed modern origami and its uses in telescopes, airbags and stents.',
    },
    topics: ['flat-foldability', 'tree-method', 'design', 'applications'],
  },
  {
    id: 'numberphile-fold-and-cut',
    title: 'Fold and Cut Theorem - Numberphile',
    channel: 'Numberphile',
    url: yt('ZREp1mAPKTM'),
    lang: 'en',
    level: 'beginner',
    minutes: 10,
    about: {
      ko: 'Katie Steckles가 종이를 접고 가위질 한 번으로 어떤 직선 도형이든 오려낼 수 있다는 정리를 보여 준다.',
      en: 'Katie Steckles shows that any straight-edged shape can be cut out with folds and one straight cut.',
    },
    topics: ['flat-foldability', 'kirigami'],
  },
  {
    id: 'numberphile-trisect-angle',
    title: 'How to Trisect an Angle with Origami - Numberphile',
    channel: 'Numberphile',
    url: yt('SL2lYcggGpc'),
    lang: 'en',
    level: 'intermediate',
    minutes: 8,
    about: {
      ko: '자와 컴퍼스로는 안 되는 각의 삼등분이 종이접기로는 된다는 것을 Zsuzsanna Dancso가 보여 준다.',
      en: 'Zsuzsanna Dancso trisects an angle by folding, which ruler and compass cannot do.',
    },
    topics: ['flat-foldability'],
  },
  {
    id: 'veritasium-engineering-origami',
    title: 'Engineering with Origami',
    channel: 'Veritasium',
    url: yt('ThwuT3_AG6w'),
    lang: 'en',
    level: 'beginner',
    minutes: 18,
    about: {
      ko: 'Robert J. Lang과 BYU 연구진이 접는 구조를 우주 태양전지판, 의료 기구, 접이식 방탄 방패에 쓰는 법을 보여 준다.',
      en: 'Robert J. Lang and BYU engineers show folding in space arrays, medical devices and a fold-out ballistic barrier.',
    },
    topics: ['engineering', 'applications', 'miura'],
  },
  {
    id: 'byu-origami-solar-arrays',
    title: 'Origami in Space: BYU-designed solar arrays inspired by origami',
    channel: 'Brigham Young University',
    url: yt('3E12uju1vgQ'),
    lang: 'en',
    level: 'beginner',
    minutes: 3,
    about: {
      ko: 'BYU와 NASA/JPL이 작게 접어 실어 보냈다가 우주에서 펼치는 태양전지판을 설계하는 과정을 본다.',
      en: 'BYU and NASA/JPL engineers design solar arrays that pack small for launch and unfold in space.',
    },
    topics: ['engineering', 'applications'],
  },
  {
    id: 'jpl-starshade',
    title: 'Crazy Engineering: Starshade/Coronagraph',
    channel: 'NASA Jet Propulsion Laboratory',
    url: yt('ALGI0ex0-ac'),
    lang: 'en',
    level: 'beginner',
    minutes: 4,
    about: {
      ko: '별빛을 가려 외계 행성을 찍기 위한, 접혀 있다가 펼쳐지는 스타셰이드를 JPL이 설명한다.',
      en: 'JPL explains the starshade, a fold-up screen that blocks starlight so telescopes can see planets.',
    },
    topics: ['engineering', 'applications'],
  },
  {
    id: 'mit-self-folding-robot',
    title: 'Robot Origami: Robot self-folds, walks, and completes tasks',
    channel: 'Massachusetts Institute of Technology (MIT)',
    url: yt('ZVYz7g-qLjs'),
    lang: 'en',
    level: 'beginner',
    minutes: 3,
    about: {
      ko: '열을 받으면 평평한 시트가 스스로 접혀 걷고 헤엄치는 1cm 크기 로봇을 본다.',
      en: 'A centimetre-sized robot that folds itself from a flat sheet when heated, then walks and swims.',
    },
    topics: ['engineering', 'applications'],
  },
  {
    id: 'mit-ingestible-origami-robot',
    title: 'Ingestible origami robot',
    channel: 'Massachusetts Institute of Technology (MIT)',
    url: yt('3Waj08gk7v8'),
    lang: 'en',
    level: 'beginner',
    minutes: 2,
    about: {
      ko: '삼킨 캡슐 안에서 펼쳐져 자석으로 움직이며 위 속의 단추 전지를 꺼내는 종이접기 로봇을 본다.',
      en: 'An origami robot that unfolds from a swallowed capsule and is steered by magnets to remove a button battery.',
    },
    topics: ['engineering', 'applications'],
  },
  {
    id: 'harvard-kirigami-snake-robot',
    title: 'How Kirigami Turns Soft Robots into Snake-Like Crawlers',
    channel: 'Harvard John A. Paulson School of Engineering and Applied Sciences',
    url: yt('0avdwGpOC98'),
    lang: 'none',
    level: 'beginner',
    minutes: 2,
    about: {
      ko: '칼집을 낸 시트(키리가미)가 늘어나면 비늘처럼 솟아 소프트 로봇이 뱀처럼 기어가게 된다.',
      en: 'A cut sheet (kirigami) pops into scales when stretched, letting a soft robot crawl like a snake.',
    },
    topics: ['kirigami', 'engineering', 'applications'],
  },
  {
    id: 'between-the-folds-trailer',
    title: 'Between The Folds Official Trailer',
    channel: 'Vanessa Gould',
    url: yt('tE4lqYzS2m0'),
    lang: 'en',
    level: 'beginner',
    minutes: 2,
    about: {
      ko: '종이접기 작가와 과학자들을 다룬 다큐멘터리 「Between the Folds」의 공식 예고편이다.',
      en: 'The official trailer of the documentary about origami artists and scientists.',
    },
    topics: ['design', 'applications'],
  },
  {
    id: 'hull-maa-folding-tomorrow',
    title: '"Folding a New Tomorrow: Origami Meets Math and Science," Thomas Hull',
    channel: 'Mathematical Association of America',
    url: yt('6Yg9J8KuHa8'),
    lang: 'en',
    level: 'intermediate',
    minutes: 15,
    about: {
      ko: 'Thomas Hull이 평탄 접기의 수학이 로봇, 에어백, 우주 구조물 연구로 이어지는 과정을 설명한다.',
      en: 'Thomas Hull on how the math of flat folding feeds into robotics, airbags and space structures.',
    },
    topics: ['flat-foldability', 'engineering', 'applications'],
  },
  {
    id: 'demaine-momath-geometry',
    title: 'Math Encounters - The Geometry of Origami -- Erik Demaine (Full Workshop)',
    channel: 'National Museum of Mathematics',
    url: yt('DHVjPxZLviA'),
    lang: 'en',
    level: 'beginner',
    minutes: 13,
    about: {
      ko: 'Erik Demaine이 일반 관객에게 접기의 수학을 소개하고 함께 접어 보는 공개 강연이다.',
      en: 'Erik Demaine introduces the math of folding to a general audience, with a hands-on fold.',
    },
    topics: ['flat-foldability', 'curved-crease'],
  },

  // ───────────────── MIT 6.849 (Erik Demaine, Fall 2012) ─────────────────
  {
    id: 'mit-6849-l01-overview',
    title: 'Lecture 1: Overview of Geometric Folding Algorithms: Linkages, Origami, Polyhedra',
    channel: 'MIT OpenCourseWare',
    url: yt('MDcAOTaCXHs'),
    lang: 'en',
    level: 'intermediate',
    minutes: 80,
    about: {
      ko: '접기 알고리즘 강의 전체의 주제(접힘 가능성, 설계, 응용)와 열린 문제를 둘러본다.',
      en: 'A tour of the course: foldability, design questions, applications and open problems.',
    },
    topics: ['flat-foldability', 'design', 'engineering'],
  },
  {
    id: 'mit-6849-l03-single-vertex',
    title: 'Lecture 3: Single-Vertex Crease Patterns',
    channel: 'MIT OpenCourseWare',
    url: yt('5lO7gBJEzH4'),
    lang: 'en',
    level: 'advanced',
    minutes: 83,
    about: {
      ko: '꼭짓점 하나의 평탄 접힘 조건, 즉 가와사키 정리와 마에카와 정리를 증명과 함께 다룬다.',
      en: 'Flat-foldability of a single vertex: Kawasaki’s and Maekawa’s theorems with proofs.',
    },
    topics: ['flat-foldability', 'tree-method'],
  },
  {
    id: 'mit-6849-l04-efficient-design',
    title: 'Lecture 4: Efficient Origami Design',
    channel: 'MIT OpenCourseWare',
    url: yt('AxCavqjfy6w'),
    lang: 'en',
    level: 'advanced',
    minutes: 86,
    about: {
      ko: '트리 메서드와 단축 기본형(uniaxial base)을 이어서 다루고, 다면체를 접는 Origamizer를 소개한다.',
      en: 'The tree method and uniaxial bases, then Origamizer for folding any polyhedron.',
    },
    topics: ['tree-method', 'design'],
  },
  {
    id: 'mit-6849-l05-artistic-design',
    title: 'Lecture 5: Artistic Origami Design',
    channel: 'MIT OpenCourseWare',
    url: yt('M8Jn9JdzoHU'),
    lang: 'en',
    level: 'intermediate',
    minutes: 86,
    about: {
      ko: 'Jason Ku가 작품 예시와 함께 트리 메서드로 실제 모델(게)을 TreeMaker에서 설계하는 과정을 보여 준다.',
      en: 'Jason Ku shows artistic origami and designs a crab with the tree method in TreeMaker.',
    },
    topics: ['tree-method', 'design', 'box-pleating'],
  },
  {
    id: 'mit-6849-l09-pleat-folding',
    title: 'Lecture 9: Pleat Folding',
    channel: 'MIT OpenCourseWare',
    url: yt('_OcgtpQvrVs'),
    lang: 'en',
    level: 'advanced',
    minutes: 83,
    about: {
      ko: '하이퍼(쌍곡포물면), 원형 주름, 주름 사이에서 종이가 휘는 방식과 가우스 곡률을 다룬다.',
      en: 'The hypar, circular pleats, how paper bends between creases, and Gaussian curvature.',
    },
    topics: ['curved-crease', 'tessellation'],
  },

  // ───────────────────────── design methods ─────────────────────────
  {
    id: 'rickman-box-pleating-1',
    title: 'Box Pleating: Origami Design Tutorial (Level 1)',
    channel: 'Rickman Origami',
    url: yt('kkfITtFKvf0'),
    lang: 'en',
    level: 'intermediate',
    minutes: 7,
    about: {
      ko: '정사각 격자와 45° 선만으로 플랩을 만드는 박스 플리팅 설계의 첫걸음을 배운다.',
      en: 'The first step of box-pleating design: making a basic feature with only grid and 45° lines.',
    },
    topics: ['box-pleating', 'design'],
  },
  {
    id: 'plant-bpstudio-treemaker',
    title: 'Bp Studio and Treemaker Crash Course | Origami design softwares',
    channel: 'The Plant Psychologist',
    url: yt('OCDR8cRvKAY'),
    lang: 'en',
    level: 'intermediate',
    minutes: 14,
    about: {
      ko: 'Box Pleating Studio와 TreeMaker를 함께 써서 크리즈 패턴을 설계하는 방법을 빠르게 훑는다.',
      en: 'A quick course on using Box Pleating Studio and TreeMaker together to design crease patterns.',
    },
    topics: ['box-pleating', 'tree-method', 'design'],
  },
  {
    id: 'mori-solve-crease-patterns',
    title: 'How to solve crease patterns (CP) - Advanced origami lessons',
    channel: 'Tadashi Mori',
    url: yt('iRJMvMC9ZEk'),
    lang: 'en',
    level: 'intermediate',
    minutes: 16,
    about: {
      ko: '도면(접는 순서) 없이 크리즈 패턴만 보고 모델을 접어 내는 법을 소개한다.',
      en: 'An introduction to folding a model from its crease pattern alone, without step-by-step diagrams.',
    },
    topics: ['design', 'box-pleating'],
  },
  {
    id: 'neospica-huffman-tower',
    title: 'David Huffman Curved Tower with Origami Box / How It\'s Made',
    channel: 'NeoSpica Paper Structures',
    url: yt('hrpwaNZWep0'),
    lang: 'none',
    level: 'advanced',
    minutes: 27,
    about: {
      ko: 'David Huffman의 곡선 주름 탑을 실제로 만드는 과정을 처음부터 끝까지 보여 준다.',
      en: 'A full build of a David Huffman curved-crease tower.',
    },
    topics: ['curved-crease', 'design'],
  },
  {
    id: 'tachi-computational-design',
    title: 'GFSW04 | Dr. Tomohiro Tachi | Computational Origami Design',
    channel: 'INI Seminar Room 1',
    url: yt('d56e8N6JyrA'),
    lang: 'en',
    level: 'advanced',
    minutes: 46,
    about: {
      ko: 'Tomohiro Tachi가 강체 접기, 자유곡면 접기 등 컴퓨터로 접기 형태를 설계하는 방법을 강연한다.',
      en: 'Tomohiro Tachi on computational origami design, including rigid and freeform folding.',
    },
    topics: ['rigid-origami', 'design', 'engineering'],
  },
];

export const TOOLS: Tool[] = [
  {
    id: 'origami-simulator',
    name: 'Origami Simulator',
    url: 'https://origamisimulator.org/',
    author: 'Amanda Ghassaei',
    kind: 'simulate',
    platform: { ko: '웹 브라우저', en: 'Web browser' },
    free: true,
    what: {
      ko: '크리즈 패턴(SVG, FOLD)을 불러와 접히는 과정을 실시간 3D로 보여 준다. 접기 정도를 슬라이더로 조절하고 면이 얼마나 늘어나는지 색으로 본다.',
      en: 'Loads a crease pattern (SVG or FOLD) and folds it in real-time 3D. A slider sets how far it folds, and colours show strain.',
    },
    useFor: {
      ko: '직접 그린 패턴이 3D로 어떻게 접히는지, 강체로 접히는지 먼저 확인하고 싶을 때 쓴다.',
      en: 'Check how a pattern you drew folds in 3D, and whether it folds without stretching, before you fold paper.',
    },
    level: 'beginner',
    repo: 'https://github.com/amandaghassaei/OrigamiSimulator',
    license: 'MIT',
  },
  {
    id: 'oripa',
    name: 'ORIPA',
    url: 'https://github.com/oripa/oripa',
    author: 'Jun Mitani',
    kind: 'design',
    platform: { ko: '데스크톱 (Java)', en: 'Desktop (Java)' },
    free: true,
    what: {
      ko: '종이접기 크리즈 패턴을 그리는 전용 편집기다. 그린 패턴에서 평평하게 접힌 모양을 계산해 보여 준다.',
      en: 'A drawing program made for origami crease patterns. It computes the flat-folded shape from the pattern.',
    },
    useFor: {
      ko: '평탄 접기 패턴을 정확히 그리고, 실제로 평평하게 접히는지와 접힌 모습을 확인할 때 쓴다.',
      en: 'Draw flat-foldable patterns precisely and check that they fold flat and what the result looks like.',
    },
    level: 'intermediate',
    repo: 'https://github.com/oripa/oripa',
    license: 'GPL-3.0',
  },
  {
    id: 'oriedita',
    name: 'Oriedita',
    url: 'https://oriedita.github.io/',
    author: 'Oriedita contributors (fork of Orihime)',
    kind: 'design',
    platform: { ko: '데스크톱', en: 'Desktop' },
    free: true,
    what: {
      ko: 'Orihime를 바탕으로 한 크리즈 패턴 편집기다. 그리기 도구가 많고, 평탄 접힘 여부를 판정해 접힌 모습을 보여 준다.',
      en: 'A crease-pattern editor based on Orihime, with many drawing tools. It tells you whether a pattern folds flat and shows the folded result.',
    },
    useFor: {
      ko: '복잡한 박스 플리팅 패턴을 그리고 접힌 결과까지 확인할 때 쓴다.',
      en: 'Draw complex box-pleated patterns and check the folded result.',
    },
    level: 'intermediate',
    repo: 'https://github.com/oriedita/oriedita',
    license: 'MIT (LICENSE.md also quotes the original Orihime author: free to use, modify and redistribute)',
  },
  {
    id: 'cp-editor',
    name: 'Crease Pattern Editor',
    url: 'http://erikdemaine.org/cp-editor/',
    author: 'Erik Demaine',
    kind: 'design',
    platform: { ko: '웹 브라우저', en: 'Web browser' },
    free: true,
    what: {
      ko: '브라우저에서 크리즈 패턴을 그리는 간단한 편집기다.',
      en: 'A simple web-based crease pattern editor.',
    },
    useFor: {
      ko: '설치 없이 패턴을 빠르게 그려 FOLD 형식 도구들로 넘기고 싶을 때 쓴다.',
      en: 'Sketch a pattern quickly without installing anything, then pass it to FOLD-based tools.',
    },
    level: 'intermediate',
    repo: 'https://github.com/edemaine/cp-editor',
    license: 'MIT',
  },
  {
    id: 'treemaker',
    name: 'TreeMaker',
    url: 'https://langorigami.com/article/treemaker/',
    author: 'Robert J. Lang',
    kind: 'design',
    platform: { ko: '데스크톱 (내려받기)', en: 'Desktop (download)' },
    free: true,
    what: {
      ko: '만들고 싶은 모양을 막대 나무(stick figure)로 입력하면 원·강 패킹을 최적화해 기본형의 크리즈 패턴을 계산한다.',
      en: 'You enter the shape as a stick-figure tree; it optimises the circle/river packing and computes a base crease pattern.',
    },
    useFor: {
      ko: '다리, 날개, 더듬이 수와 길이가 정해진 곤충·동물을 트리 메서드로 설계할 때 쓴다.',
      en: 'Design an insect or animal with a set number and length of flaps using the tree method.',
    },
    level: 'advanced',
  },
  {
    id: 'treefaker',
    name: 'TreeFaker',
    url: 'https://6849-2020.github.io/treefaker/',
    author: 'MIT 6.849 (Fall 2020) project',
    kind: 'design',
    platform: { ko: '웹 브라우저', en: 'Web browser' },
    free: true,
    what: {
      ko: 'TreeMaker의 기능을 웹에서 구현한 것이다.',
      en: 'A web-based implementation of TreeMaker.',
    },
    useFor: {
      ko: '프로그램 설치 없이 트리 메서드와 원 패킹을 바로 실험해 볼 때 쓴다.',
      en: 'Try the tree method and circle packing right away without installing software.',
    },
    level: 'advanced',
    repo: 'https://github.com/6849-2020/treefaker',
    license: 'none stated',
  },
  {
    id: 'reference-finder',
    name: 'ReferenceFinder',
    url: 'https://mutsuntsai.github.io/reference-finder/',
    author: 'Robert J. Lang (web version by Mu-Tsun Tsai)',
    kind: 'design',
    platform: { ko: '웹 브라우저 (원본은 데스크톱)', en: 'Web browser (original is desktop)' },
    free: true,
    what: {
      ko: '종이 위의 임의의 점이나 선을 자 없이 몇 번의 접기로 찾는 순서를 계산한다.',
      en: 'Finds a short folding sequence that locates any point or line on the square, without a ruler.',
    },
    useFor: {
      ko: '격자에 맞지 않는 기준점(예: 0.3721 지점)을 접기만으로 잡아야 할 때 쓴다.',
      en: 'Locate a reference point that is not on a grid (say at 0.3721) by folding alone.',
    },
    level: 'intermediate',
    repo: 'https://github.com/mutsuntsai/reference-finder',
    license: 'GPL-2.0 (LICENSE: "distributed under the terms of the GNU GPL", version 2 text)',
  },
  {
    id: 'bp-studio',
    name: 'Box Pleating Studio',
    url: 'https://bpstudio.abstreamace.com/',
    author: 'Mu-Tsun Tsai',
    kind: 'design',
    platform: { ko: '웹 브라우저', en: 'Web browser' },
    free: true,
    what: {
      ko: '박스 플리팅 방식으로 복잡한 모델의 설계도(플랩 배치와 연결 주름)를 그리는 도구다.',
      en: 'A tool for blueprinting complex box-pleated designs: placing flaps and generating the connecting pleats.',
    },
    useFor: {
      ko: '격자 위에서 플랩을 배치하고 그 사이를 잇는 주름 패턴을 자동으로 얻고 싶을 때 쓴다.',
      en: 'Place flaps on a grid and get the pleats between them generated for you.',
    },
    level: 'advanced',
    repo: 'https://github.com/bp-studio/box-pleating-studio',
    license: 'MIT',
  },
  {
    id: 'flat-folder',
    name: 'Flat-Folder',
    url: 'https://origamimagiro.github.io/flat-folder/',
    author: 'Jason S. Ku',
    kind: 'simulate',
    platform: { ko: '웹 브라우저', en: 'Web browser' },
    free: true,
    what: {
      ko: '크리즈 패턴(FOLD, SVG, OPX, CP)을 불러와 가능한 평탄 접힘 상태와 층 순서를 모두 계산한다. 산·골이 정해지지 않은 패턴도 다룬다.',
      en: 'Loads a crease pattern (FOLD, SVG, OPX or CP) and computes its valid flat-folded states and layer orders, with or without mountain/valley assignment.',
    },
    useFor: {
      ko: '패턴이 정말 평평하게 접히는지, 층이 어떤 순서로 겹치는지, 해가 몇 개인지 확인할 때 쓴다.',
      en: 'Check whether a pattern really folds flat, how the layers stack, and how many solutions exist.',
    },
    level: 'advanced',
    repo: 'https://github.com/origamimagiro/flat-folder',
    license: 'MIT',
  },
  {
    id: 'tachi-software',
    name: 'Rigid Origami Simulator / Origamizer / Freeform Origami',
    url: 'https://origami.c.u-tokyo.ac.jp/~tachi/software/',
    author: 'Tomohiro Tachi',
    kind: 'simulate',
    platform: { ko: 'Windows', en: 'Windows' },
    free: true,
    what: {
      ko: 'Rigid Origami Simulator는 면이 휘지 않는 강체 접기의 움직임을 계산하고, Origamizer는 주어진 다면체로 접히는 패턴을 만들며, Freeform Origami는 접힌 형태를 보면서 패턴을 편집한다.',
      en: 'Rigid Origami Simulator computes rigid folding motion, Origamizer makes a pattern that folds into a given polyhedron, and Freeform Origami edits a pattern while you watch the folded form.',
    },
    useFor: {
      ko: '두꺼운 판이나 금속처럼 면이 휘면 안 되는 재료로 접을 구조를 연구할 때 쓴다. 비상업적 사용 조건과 인용 요구를 먼저 확인한다.',
      en: 'Study structures for panels that must not bend, such as thick boards or metal. Check the non-commercial terms and citation request first.',
    },
    level: 'advanced',
  },
  {
    id: 'rabbit-ear',
    name: 'Rabbit Ear',
    url: 'https://github.com/rabbit-ear/rabbit-ear',
    author: 'Amber Kraft',
    kind: 'library',
    platform: { ko: 'JavaScript (npm)', en: 'JavaScript (npm)' },
    free: true,
    what: {
      ko: '종이접기 모델을 FOLD 형식으로 만들고 고치고 그리는 JavaScript 라이브러리다. 수학 함수와 SVG·WebGL 렌더링을 포함한다.',
      en: 'A JavaScript library for building, editing and drawing origami models in FOLD format, with a math library and SVG/WebGL rendering.',
    },
    useFor: {
      ko: '웹에서 접기 계산이나 크리즈 패턴 그림이 필요한 프로그램을 직접 만들 때 쓴다.',
      en: 'Write your own web program that computes folds or draws crease patterns.',
    },
    level: 'advanced',
    repo: 'https://github.com/rabbit-ear/rabbit-ear',
    license: 'GPL-3.0',
  },
  {
    id: 'fold-format',
    name: 'FOLD file format',
    url: 'https://github.com/edemaine/fold',
    author: 'Erik D. Demaine, Jason S. Ku, Robert J. Lang',
    kind: 'format',
    platform: { ko: 'JSON 파일 형식 + JavaScript 도구', en: 'JSON file format + JavaScript tools' },
    free: true,
    what: {
      ko: '꼭짓점, 모서리, 면, 산·골 지정, 면의 겹침 순서까지 담는 JSON 기반 종이접기 파일 형식이다. 명세, 예제, 뷰어가 함께 있다.',
      en: 'A JSON-based origami file format that stores vertices, edges, faces, mountain/valley assignment and face stacking order, with a spec, examples and a viewer.',
    },
    useFor: {
      ko: '여러 도구(Origami Simulator, Flat-Folder, Rabbit Ear 등) 사이에서 패턴을 주고받을 때 쓴다.',
      en: 'Move patterns between tools such as Origami Simulator, Flat-Folder and Rabbit Ear.',
    },
    level: 'intermediate',
    repo: 'https://github.com/edemaine/fold',
    license: 'MIT',
  },
  {
    id: 'fold-viewer',
    name: 'FOLD Viewer',
    url: 'https://edemaine.github.io/fold/examples/foldviewer.html',
    author: 'Erik D. Demaine (FOLD project)',
    kind: 'format',
    platform: { ko: '웹 브라우저', en: 'Web browser' },
    free: true,
    what: {
      ko: 'FOLD 파일을 브라우저에서 열어 보는 뷰어다.',
      en: 'A browser viewer for FOLD files.',
    },
    useFor: {
      ko: '내보낸 .fold 파일이 제대로 만들어졌는지 빠르게 확인할 때 쓴다.',
      en: 'Quickly check that an exported .fold file looks right.',
    },
    level: 'intermediate',
  },
  {
    id: 'swomps',
    name: 'SWOMPS (Sequentially Working Origami Multi-Physics Simulator)',
    url: 'https://github.com/zzhuyii/OrigamiSimulator',
    author: 'Yi Zhu, Evgueni Filipov',
    kind: 'simulate',
    platform: { ko: 'MATLAB', en: 'MATLAB' },
    free: true,
    what: {
      ko: '막대-힌지 모델로 능동 종이접기 구조의 큰 변형, 면 사이 접촉, 열 전달, 전열 구동을 시뮬레이션한다. 이후 개발은 Sim-FAST로 옮겨 갔다.',
      en: 'A bar-and-hinge simulator for active origami: large folding deformation, panel contact, heat transfer and electro-thermal actuation. New work has moved to Sim-FAST.',
    },
    useFor: {
      ko: '스스로 접히는 구조나 하중을 받는 접기 구조의 역학을 연구할 때 쓴다.',
      en: 'Research the mechanics of self-folding or load-bearing origami structures.',
    },
    level: 'advanced',
    repo: 'https://github.com/zzhuyii/OrigamiSimulator',
    license: 'none stated',
  },
  {
    id: 'sim-fast',
    name: 'Sim-FAST (Simulator For Active STructures)',
    url: 'https://github.com/zzhuyii/Sim-FAST',
    author: 'Yi Zhu',
    kind: 'simulate',
    platform: { ko: 'MATLAB (Python 판도 있음)', en: 'MATLAB (a Python version also exists)' },
    free: true,
    what: {
      ko: '종이접기, 텐세그리티, 트러스, 메타물질 같은 능동 구조를 회전 스프링 요소로 모델링하는 교육·연구용 패키지다.',
      en: 'An education and research package that models active structures (origami, tensegrity, trusses, metamaterials) with rotational-spring elements.',
    },
    useFor: {
      ko: '접기 구조의 비선형 해석 코드를 직접 읽고 고쳐 보고 싶을 때 쓴다.',
      en: 'Read and modify nonlinear analysis code for folded structures yourself.',
    },
    level: 'advanced',
    repo: 'https://github.com/zzhuyii/Sim-FAST',
    license: 'none stated in a LICENSE file; the README says CC-BY 4.0',
  },
  {
    id: 'openprc',
    name: 'OpenPRC',
    url: 'https://github.com/DARE-Lab-VT/OpenPRC-dev',
    author: 'DARE Lab, Virginia Tech (Phalak, Lor, Khairnar, Jantzen, Naughton, Li)',
    kind: 'simulate',
    platform: { ko: 'Python (pip install openprc)', en: 'Python (pip install openprc)' },
    free: true,
    what: {
      ko: '물리 저수지 컴퓨팅(physical reservoir computing)을 위한 GPU 가속 Python 프레임워크다. 질량-스프링 망부터 강체 접기 종이접기(Miura-ori 테셀레이션 예제 포함)까지 시뮬레이션한다.',
      en: 'A GPU-accelerated Python framework for physical reservoir computing. It simulates substrates from mass-spring networks to rigid-foldable origami, with a Miura-ori tessellation example.',
    },
    useFor: {
      ko: '접기 구조의 동역학을 계산에 쓰는(예: 접기 구조가 신호를 처리하는) 연구를 시작할 때 쓴다.',
      en: 'Start research that uses the dynamics of a folded structure as a computer, for example to process signals.',
    },
    level: 'advanced',
    repo: 'https://github.com/DARE-Lab-VT/OpenPRC-dev',
    license: 'Apache-2.0',
  },
];

/** Which tools read and write which crease-pattern files. Each line was checked in the tool's README or docs. */
export const INTEROP_NOTES: Bi[] = [
  {
    ko: 'Origami Simulator는 SVG와 FOLD 크리즈 패턴을 불러오고, 접힌 상태를 FOLD, STL, OBJ로 내보낸다.',
    en: 'Origami Simulator imports SVG and FOLD crease patterns and exports the folded state as FOLD, STL or OBJ.',
  },
  {
    ko: 'Flat-Folder는 FOLD, SVG, OPX(ORIPA), CP 파일을 열고, 화면을 SVG로 내보낸다.',
    en: 'Flat-Folder opens FOLD, SVG, OPX (ORIPA) and CP files, and exports a snapshot as SVG.',
  },
  {
    ko: 'ORIPA는 .opx와 .cp를 열고, 1.10판부터 FOLD를 불러오고 내보낸다. 접힌 모양은 SVG로 저장한다.',
    en: 'ORIPA opens .opx and .cp files; from v1.10 it also imports and exports FOLD, and saves the folded shape as SVG.',
  },
  {
    ko: 'Oriedita는 FOLD 형식을 불러오고 내보내며, 원과 글자는 "oriedita:" 접두사가 붙은 추가 필드에 저장한다.',
    en: 'Oriedita imports and exports FOLD, keeping its circles and text in extra fields prefixed "oriedita:".',
  },
  {
    ko: 'Crease Pattern Editor(Demaine)는 .fold와 .svg로 저장한다.',
    en: 'Demaine’s Crease Pattern Editor saves to .fold and .svg.',
  },
  {
    ko: 'Rabbit Ear는 FOLD를 기본 자료 구조로 쓰고, 변환기에서 SVG를 불러오고 내보낼 수 있다.',
    en: 'Rabbit Ear is built on FOLD, and its converter imports and exports SVG.',
  },
  {
    ko: 'Tachi의 Freeform Origami는 FOLD 입출력을 지원하고, Rigid Origami Simulator는 .opx와 .dxf 패턴을 읽는다.',
    en: 'Tachi’s Freeform Origami reads and writes FOLD; his Rigid Origami Simulator reads .opx and .dxf patterns.',
  },
  {
    ko: 'FOLD 저장소의 fold-convert 명령은 ORIPA .opx 파일을 .fold로 바꾼다.',
    en: 'The FOLD repository’s fold-convert command turns ORIPA .opx files into .fold.',
  },
  {
    ko: 'FOLD 저장소에는 예제 .fold 파일(box, simple, squaretwist, diagonal-cp, diagonal-folded)이 MIT 라이선스로 들어 있어, 출처를 밝히면 앱에서 다시 쓸 수 있다.',
    en: 'The FOLD repository ships example .fold files (box, simple, squaretwist, diagonal-cp, diagonal-folded) under its MIT licence, so they can be reused with the notice kept.',
  },
];

export type FieldName = 'space' | 'medical' | 'architecture' | 'robotics' | 'packaging' | 'everyday' | 'vehicles' | 'energy';
export interface FieldUse {
  /** the app's structure key */
  structure: string;
  field: FieldName;
  example: Bi;
  /** authors and year of the source */
  source?: string;
  /** verified link to the source */
  url?: string;
}

/** Real applications by field, each with a source that was checked. */
export const FIELD_USES: FieldUse[] = [
  {
    structure: 'miura',
    field: 'space',
    example: {
      ko: '1995년에 발사된 일본의 Space Flyer Unit은 미우라 접기로 접어 둔 2D 어레이를 우주에서 펼쳤다.',
      en: 'Japan’s Space Flyer Unit, launched in 1995, deployed its 2D Array from a Miura-folded state in orbit.',
    },
    source: 'Wikipedia, "Miura fold" (Applications)',
    url: 'https://en.wikipedia.org/wiki/Miura_fold',
  },
  {
    structure: 'miura',
    field: 'everyday',
    example: {
      ko: '미우라 접기 지도는 대각선 양 끝을 당기면 한 번에 펼쳐지고 다시 한 번에 접힌다.',
      en: 'A Miura-folded map opens in one pull on opposite corners and closes again in one motion.',
    },
    source: 'Ian Bain, "The Miura-Ori map", New Scientist (1980), cited in Wikipedia "Miura fold"',
  },
  {
    structure: 'flasher',
    field: 'energy',
    example: {
      ko: 'BYU와 NASA JPL, Robert J. Lang은 플래셔 패턴을 두꺼운 판에도 쓰도록 바꿔, 지름비 9.2로 펼쳐지는 우주 태양전지판 축소 시제품을 만들었다.',
      en: 'BYU, NASA JPL and Robert J. Lang adapted the flasher pattern to thick panels and built a 1/20-scale solar array prototype with a deployed-to-stowed diameter ratio of 9.2.',
    },
    source: 'Zirbel, Lang, Thomson, Sigel, Walkemeyer, Trease, Magleby, Howell (2013), J. Mech. Des. 135(11):111005',
    url: 'https://ntrs.nasa.gov/citations/20150008719',
  },
  {
    structure: 'waterbombTube',
    field: 'medical',
    example: {
      ko: '물풍선 튜브는 누르면 길이와 지름이 함께 줄어드는 성질이 있어, 체온 근처에서 스스로 펴지는 형상기억합금 박막 스텐트 그라프트에 쓰였다.',
      en: 'The waterbomb tube shrinks in both length and radius when compressed, which was used for a self-deploying stent graft made of shape-memory alloy foil.',
    },
    source: 'Kuribayashi, Tsuchiya, You et al. (2006), Mater. Sci. Eng. A 419:131–137; as reviewed in Ma, Feng, Chen, Hou, You (2020), "Folding of Tubular Waterbomb", Research',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7171592/',
  },
  {
    structure: 'waterbombTube',
    field: 'robotics',
    example: {
      ko: '서울대 연구진은 물풍선(매직볼) 패턴 바퀴를 만들어, 지름 11cm 바퀴를 4cm로 줄여 5cm 틈을 지나가게 했다.',
      en: 'A Seoul National University team built a wheel from the waterbomb (magic-ball) pattern that shrinks from 11 cm to 4 cm, so the robot passes a 5 cm gap.',
    },
    source: 'Lee, Jung, Sin, Ahn, Cho (2013), "Deformable Wheel Robot Based on Origami Structure", IEEE ICRA',
    url: 'https://spectrum.ieee.org/robots-get-flexible-and-torqued-up-with-deformable-origami-wheels',
  },
  {
    structure: 'waterbombTube',
    field: 'robotics',
    example: {
      ko: '물풍선 튜브로 몸통을 만들어 연동 운동으로 기어가는 지렁이 로봇이 만들어졌다.',
      en: 'A worm robot whose body is a waterbomb tube crawls by peristaltic motion.',
    },
    source: 'Onal, Wood, Rus (2013), "An origami-inspired approach to worm robots", IEEE/ASME Trans. Mechatronics; cited in Ma et al. (2020)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7171592/',
  },
  {
    structure: 'waterbomb',
    field: 'robotics',
    example: {
      ko: 'MIT와 하버드 연구진은 물풍선 테셀레이션(매직볼)을 얇은 막으로 감싸고 진공으로 오므리는 원뿔형 소프트 그리퍼를 만들었다. 부드러운 음식부터 무거운 병까지 집는다.',
      en: 'MIT and Harvard researchers wrapped a waterbomb "magic-ball" in a thin membrane to make a vacuum-driven cone gripper that picks up delicate food and heavy bottles.',
    },
    source: 'Li, Stampfli, Xu, Malkin, Villegas Diaz, Rus, Wood (2019), IEEE ICRA',
    url: 'https://news.mit.edu/2019/new-robot-hand-gripper-soft-and-strong-0315',
  },
  {
    structure: 'kresling',
    field: 'robotics',
    example: {
      ko: '쌍안정 크레슬링 단위마다 자석판을 붙여, 자기장으로 각 단위를 따로 접고 펴는 소형 로봇과 기계식 논리 소자를 만들었다.',
      en: 'Bistable Kresling cells with magnetic plates fold and unfold one by one under a magnetic field, for small robots and mechanical logic.',
    },
    source: 'Novelino, Ze, Wu, Paulino, Zhao (2020), PNAS 117(39):24096–24101',
    url: 'https://collaborate.princeton.edu/en/publications/untethered-control-of-functional-origami-microrobots-with-distrib/',
  },
  {
    structure: 'kresling',
    field: 'vehicles',
    example: {
      ko: '크레슬링 패턴을 넣은 얇은 금속관은 각기둥 관보다 처음 충격 최대 힘이 크게 낮으면서 흡수 에너지는 거의 줄지 않아, 충돌 흡수 부재로 연구된다.',
      en: 'Thin-walled tubes with a Kresling pattern cut the initial peak force well below a prismatic tube without losing much absorbed energy, so they are studied as crash absorbers.',
    },
    source: 'Li, Chen, Feng, Feng, Sareh (2021), J. Int. Assoc. Shell and Spatial Structures',
    url: 'https://livrepository.liverpool.ac.uk/3131755/',
  },
  {
    structure: 'yoshimura',
    field: 'vehicles',
    example: {
      ko: '요시무라 패턴을 넣은 얇은 관의 에너지 흡수와 최대 충돌 힘을 수치 해석으로 최적화해, 차량 충돌 흡수 부재 설계에 쓴다.',
      en: 'Thin-walled tubes with a Yoshimura pattern are optimised numerically for energy absorption and peak crushing force, for crash-absorber design.',
    },
    source: 'Fang et al. (2024), Facta Universitatis, Series: Mechanical Engineering',
    url: 'https://casopisi.junis.ni.ac.rs/index.php/FUMechEng/article/view/11000',
  },
  {
    structure: 'shoppingBag',
    field: 'everyday',
    example: {
      ko: '흔한 종이 쇼핑백은 면이 휘지 않는 강체 접기로는 평평하게 접히지 않는다. 주름을 더하거나 면이 휘어야 접힌다.',
      en: 'The ordinary paper shopping bag cannot be flattened by rigid folding along its usual creases; it needs extra creases or bending panels.',
    },
    source: 'Balkcom, Demaine, Demaine, Ochsendorf, You (2006), "Folding Paper Shopping Bags", OSME 2006',
    url: 'https://erikdemaine.org/papers/PaperBag_OSME2006/',
  },
  {
    structure: 'resch',
    field: 'architecture',
    example: {
      ko: 'Tachi는 Ron Resch의 테셀레이션을 일반화해, 주어진 자유 곡면을 한 장의 시트로 접어 근사하는 설계법을 만들었고, 후속 연구에서 금속 접기 제작에 적용했다.',
      en: 'Tachi generalised Ron Resch’s tessellations to fold one sheet into a given freeform surface, and later applied the method to folding metal.',
    },
    source: 'Tachi (2013), "Freeform Origami Tessellations by Generalizing Resch’s Patterns", ASME IDETC / J. Mech. Des.',
  },
];

export const READINGS: Reading[] = [
  {
    id: 'lang-origami-design-secrets',
    title: 'Origami Design Secrets: Mathematical Methods for an Ancient Art (2nd ed.)',
    author: 'Robert J. Lang',
    year: 2011,
    url: 'https://www.routledge.com/Origami-Design-Secrets-Mathematical-Methods-for-an-Ancient-Art-Second-Edition/Lang/p/book/9781568814360',
    kind: 'book',
    about: {
      ko: '기본형 조합에서 원·강 패킹, 트리 이론, 박스 플리팅까지 종이접기 설계를 차근차근 가르치는 대표 교재다.',
      en: 'The standard text on origami design, from combining bases to circle/river packing, tree theory and box pleating.',
    },
    level: 'intermediate',
  },
  {
    id: 'hull-origametry',
    title: 'Origametry: Mathematical Methods in Paper Folding',
    author: 'Thomas C. Hull',
    year: 2020,
    kind: 'book',
    about: {
      ko: '작도, 평탄 접기의 조합 기하, 대수·위상, 평평하지 않은 접기까지 종이접기 수학을 정리한 참고서다.',
      en: 'A reference on origami mathematics: constructions, the combinatorics of flat folding, algebra and topology, and non-flat folding.',
    },
    level: 'advanced',
  },
  {
    id: 'demaine-orourke-gfa',
    title: 'Geometric Folding Algorithms: Linkages, Origami, Polyhedra',
    author: "Erik D. Demaine, Joseph O'Rourke",
    year: 2007,
    url: 'https://en.wikipedia.org/wiki/Geometric_Folding_Algorithms',
    kind: 'book',
    about: {
      ko: '링키지, 종이, 다면체 세 부분으로 접기의 계산 기하학을 다룬 책이다. MIT 6.849의 교재다.',
      en: 'The computational geometry of folding in three parts (linkages, paper, polyhedra); the textbook of MIT 6.849.',
    },
    level: 'advanced',
  },
  {
    id: 'mit-6849-fall2020',
    title: '6.849: Geometric Folding Algorithms: Linkages, Origami, Polyhedra (Fall 2020)',
    author: 'Erik Demaine (MIT)',
    year: 2020,
    url: 'https://courses.csail.mit.edu/6.849/fall20/',
    kind: 'course',
    about: {
      ko: '강의 영상, 손글씨 노트, 슬라이드를 무료로 볼 수 있는 MIT 접기 알고리즘 강의 페이지다.',
      en: 'MIT’s folding-algorithms course page, with free lecture videos, handwritten notes and slides.',
    },
    level: 'advanced',
  },
  {
    id: 'mit-ocw-6849-fall2012',
    title: 'Geometric Folding Algorithms: Linkages, Origami, Polyhedra (MIT OpenCourseWare, Fall 2012)',
    author: 'Erik Demaine (MIT OpenCourseWare)',
    year: 2012,
    url: 'https://ocw.mit.edu/courses/6-849-geometric-folding-algorithms-linkages-origami-polyhedra-fall-2012/',
    kind: 'course',
    about: {
      ko: '위 VIDEOS의 MIT 강의(2012년판)가 정리된 OCW 페이지로, 강의 노트와 과제가 함께 있다.',
      en: 'The OCW page for the 2012 lectures listed in the videos, with notes and problem sets.',
    },
    level: 'advanced',
  },
  {
    id: 'demaine-huffman-curved',
    title: "Reconstructing David Huffman's Legacy in Curved-Crease Folding",
    author: 'Erik D. Demaine, Martin L. Demaine, Duks Koschitz',
    year: 2010,
    url: 'https://erikdemaine.org/papers/Huffman_Origami5/',
    kind: 'paper',
    about: {
      ko: 'David Huffman이 남긴 곡선 주름 작품과 노트를 분석해 그 설계 원리를 되살린 논문이다.',
      en: 'A paper that studies Huffman’s curved-crease models and notes to recover how he designed them.',
    },
    level: 'advanced',
  },
  {
    id: 'ghassaei-origami-simulator-paper',
    title: 'Fast, Interactive Origami Simulation using GPU Computation',
    author: 'Amanda Ghassaei, Erik D. Demaine, Neil Gershenfeld',
    year: 2018,
    url: 'https://erikdemaine.org/papers/OrigamiSimulator_Origami7/',
    kind: 'paper',
    about: {
      ko: 'Origami Simulator가 GPU로 접기를 실시간 계산하는 방법을 설명한 논문이다.',
      en: 'The paper behind Origami Simulator: how it computes folding in real time on the GPU.',
    },
    level: 'advanced',
  },
  {
    id: 'demaine-curved-sculpture',
    title: 'Curved-Crease Sculpture by Erik and Martin Demaine',
    author: 'Erik Demaine, Martin Demaine',
    url: 'https://erikdemaine.org/curved/',
    kind: 'site',
    about: {
      ko: '동심원 주름으로 휘어지는 종이 조각 작품과 그 배경을 모아 둔 페이지다.',
      en: 'A gallery of paper sculptures folded from concentric curved creases, with background notes.',
    },
    level: 'intermediate',
  },
  {
    id: 'lang-origami-site',
    title: 'Robert J. Lang Origami',
    author: 'Robert J. Lang',
    url: 'https://langorigami.com/',
    kind: 'site',
    about: {
      ko: '작품, 크리즈 패턴, 논문, 설계 소프트웨어(TreeMaker, ReferenceFinder)를 모아 둔 Lang의 공식 사이트다.',
      en: 'Lang’s site: artworks, crease patterns, papers and his design software (TreeMaker, ReferenceFinder).',
    },
    level: 'intermediate',
  },
  {
    id: 'gilad-origami-page',
    title: "Gilad's Origami Page",
    author: 'Gilad Aharoni',
    url: 'https://www.giladorigami.com/',
    kind: 'site',
    about: {
      ko: '가장 큰 종이접기 책 리뷰 모음과 모델 데이터베이스가 있어, 어떤 모델이 어느 책에 실렸는지 찾을 수 있다.',
      en: 'The largest collection of origami book reviews plus a model database, so you can find which book has a model.',
    },
    level: 'beginner',
  },
  {
    id: 'cfc-diagram-pool',
    title: 'CFC Diagram Pool',
    author: 'CFC Origami (Community for Creators of Origami)',
    url: 'https://cfcorigami.com/diagram-pool',
    kind: 'site',
    about: {
      ko: '종이접기 창작자 모임 CFC 회원들이 무료로 공개한 도면 모음이다.',
      en: 'Free diagrams shared by members of CFC, a community of origami creators.',
    },
    level: 'intermediate',
  },
  {
    id: 'origamiusa',
    title: 'OrigamiUSA',
    author: 'OrigamiUSA',
    url: 'https://origamiusa.org/',
    kind: 'community',
    about: {
      ko: '미국 종이접기 단체로, 무료 도면, 온라인 모임, 컨벤션, 출판물을 운영한다.',
      en: 'The US origami society: free diagrams, online sessions, conventions and publications.',
    },
    level: 'beginner',
  },
  {
    id: 'british-origami-society',
    title: 'British Origami Society',
    author: 'British Origami Society',
    url: 'https://www.britishorigami.org/',
    kind: 'community',
    about: {
      ko: '영국 종이접기 협회로, 모임과 컨벤션, 회지와 자료를 운영한다.',
      en: 'The British origami society, with meetings, conventions, a magazine and resources.',
    },
    level: 'beginner',
  },
  {
    id: 'jongie-culture-foundation',
    title: '종이문화재단 · 세계종이접기연합',
    author: '종이문화재단',
    kind: 'community',
    about: {
      ko: '1987년에 세워진 한국의 종이접기 단체로, K-종이접기 보급과 종이나라박물관 운영, 국내외 지부 활동을 한다.',
      en: 'A Korean paper-folding foundation founded in 1987 that promotes Korean jongie-jeopgi, runs the Jongie Nara paper museum and has branches at home and abroad.',
    },
    level: 'beginner',
  },
];

export const videoById = (id: string) => VIDEOS.find((v) => v.id === id);
