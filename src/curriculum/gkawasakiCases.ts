/** Predefined vertices of the Generalized Kawasaki Lab (sector angles in degrees). */
import { tr } from '../i18n';

export interface GKCase {
  id: 'A' | 'B' | 'C' | 'D' | 'E';
  readonly title: string;
  theta: number[];
  /** what this case is meant to show */
  readonly note: string;
}

// title / note are getters so they follow the current language
export const GK_CASES: GKCase[] = [
  {
    id: 'A', theta: [90, 90, 90, 90],
    get title() { return tr('평범한 평탄 꼭짓점', 'Ordinary flat vertex'); },
    get note() { return tr('Σθ = 360°인 보통 종이. S = 0°: 기본 Kawasaki 정리의 기준선.', 'Ordinary paper with Σθ = 360°. S = 0°: the baseline of the basic Kawasaki theorem.'); },
  },
  {
    id: 'B', theta: [100, 70, 60, 80, 50, 60],
    get title() { return tr('안장이지만 S = 0', 'Saddle, but S = 0'); },
    get note() { return tr('Σθ = 420° (안장)인데 홀수 합 = 짝수 합 = 210°라서 S = 0°. "Σθ > 360°이면 S = ±360°"가 아니다.', 'Σθ = 420° (saddle), but odd sum = even sum = 210°, so S = 0°. Σθ > 360° does not imply S = ±360°.'); },
  },
  {
    id: 'C', theta: [130, 10, 130, 10, 130, 10],
    get title() { return tr('S = +360° (한 바퀴 감김)', 'S = +360° (one full winding)'); },
    get note() { return tr('홀수 섹터 130°×3 = 390°, 짝수 섹터 10°×3 = 30°. S = +360°: 접힌 경로가 꼭짓점을 반시계로 한 바퀴 돈다.', 'Odd sectors 130°×3 = 390°, even sectors 10°×3 = 30°. S = +360°: the folded path goes once around the vertex counterclockwise.'); },
  },
  {
    id: 'D', theta: [10, 130, 10, 130, 10, 130],
    get title() { return tr('S = −360° (반대로 한 바퀴)', 'S = −360° (one winding, reversed)'); },
    get note() { return tr('C를 한 칸 밀어 놓은 것: 홀수 = 30°, 짝수 = 390°. S = −360°: 시계 방향으로 한 바퀴.', 'C shifted by one sector: odd = 30°, even = 390°. S = −360°: once around clockwise.'); },
  },
  {
    id: 'E', theta: [100, 40, 100, 40, 100, 40],
    get title() { return tr('안장이지만 조건 불만족', 'Saddle, but the condition fails'); },
    get note() { return tr('Σθ = 420° (안장)이지만 S = +180°. 안장 모양과 평탄 접힘 가능성은 다른 개념이다.', 'Σθ = 420° (saddle), but S = +180°. Being a saddle and being flat-foldable are different things.'); },
  },
];
