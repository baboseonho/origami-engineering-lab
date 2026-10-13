/** Predefined vertices of the Generalized Kawasaki Lab (sector angles in degrees). */
export interface GKCase {
  id: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
  theta: number[];
  /** what this case is meant to show */
  note: string;
}

export const GK_CASES: GKCase[] = [
  {
    id: 'A', title: '평범한 평탄 꼭짓점', theta: [90, 90, 90, 90],
    note: 'Σθ = 360°인 보통 종이. S = 0°: 기본 Kawasaki 정리의 기준선.',
  },
  {
    id: 'B', title: '안장이지만 S = 0', theta: [100, 70, 60, 80, 50, 60],
    note: 'Σθ = 420° (안장)인데 홀수 합 = 짝수 합 = 210°라서 S = 0°. "Σθ > 360°이면 S = ±360°"가 아니다.',
  },
  {
    id: 'C', title: 'S = +360° (한 바퀴 감김)', theta: [130, 10, 130, 10, 130, 10],
    note: '홀수 섹터 130°×3 = 390°, 짝수 섹터 10°×3 = 30°. S = +360°: 접힌 경로가 꼭짓점을 반시계로 한 바퀴 돈다.',
  },
  {
    id: 'D', title: 'S = −360° (반대로 한 바퀴)', theta: [10, 130, 10, 130, 10, 130],
    note: 'C를 한 칸 밀어 놓은 것: 홀수 = 30°, 짝수 = 390°. S = −360°: 시계 방향으로 한 바퀴.',
  },
  {
    id: 'E', title: '안장이지만 조건 불만족', theta: [100, 40, 100, 40, 100, 40],
    note: 'Σθ = 420° (안장)이지만 S = +180°. 안장 모양과 평탄 접힘 가능성은 다른 개념이다.',
  },
];
