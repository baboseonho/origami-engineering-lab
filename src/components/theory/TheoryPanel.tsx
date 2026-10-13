import { FitTex, Rich } from '../controls/Rich';

import type { TheoryKey } from '../../curriculum/lessons';
import { lessonById } from '../../curriculum/lessons';
import { useModel } from '../../state/modelStore';
import { useUI } from '../../state/uiStore';
import { Toggle } from '../controls/ui';

/** \htmlData{sym=rho2}{\rho_2} → hovering highlights crease labelled ρ2 */
const r = (i: number) => `\\htmlData{sym=rho${i}}{\\rho_{${i}}}`;
const t = (i: number) => `\\htmlData{sym=theta${i}}{\\theta_{${i}}}`;

export const EQUATIONS: Record<TheoryKey, { title: string; tex: string[]; note?: string }> = {
  convention: {
    title: '접힘각 부호 규약',
    tex: [`\\rho = 0\\ \\text{flat},\\quad \\rho>0\\ \\text{valley},\\quad \\rho<0\\ \\text{mountain},\\quad |\\rho|\\to\\pi\\ \\text{fully folded}`, `\\rho = \\pi - \\varphi_{\\text{dihedral, front}} ,\\qquad \\rho = \\operatorname{atan2}\\big((\\mathbf n_R\\times\\mathbf n_L)\\cdot\\hat{\\mathbf e},\\ \\mathbf n_R\\cdot\\mathbf n_L\\big)`],
    note: 'θi는 펼친 패턴의 섹터각이고, ρ는 크리스에 대한 접힘각이다. 둘은 서로 다른 양이다.',
  },
  kawasaki: {
    title: 'Kawasaki–Justin',
    tex: [`${t(1)} - ${t(2)} + ${t(3)} - ${t(4)} + \\dots = 0 \\iff \\sum_{\\text{odd}}\\theta_i = \\sum_{\\text{even}}\\theta_i = \\pi`],
    note: '평탄한(Σθ = 2π) 짝수 차수 꼭짓점에 대한 조건이다. 기하에만 관한 조건이다.',
  },
  maekawa: { title: 'Maekawa–Justin', tex: ['|M - V| = 2'], note: '필요조건이지만 충분조건은 아니다.' },
  generalized: {
    title: '일반화 평탄 접힘 가능성 (비평탄 꼭짓점)',
    tex: [`A = \\sum_{i=1}^{n} (-1)^{i+1}\\,\\theta_i = ${t(1)} - ${t(2)} + ${t(3)} - \\dots \\in \\{0,\\ +2\\pi,\\ -2\\pi\\}`],
  },
  generalizedMaekawa: { title: '일반화 Maekawa', tex: ['A = 0 \\Rightarrow |M - V| = 2, \\qquad A = \\pm 2\\pi \\Rightarrow M = V'] },
  winding: {
    title: '곡률과 감김은 다른 양',
    tex: ['T = \\sum_i \\theta_i, \\qquad \\delta = 360^\\circ - T', '\\varphi_0 = 0,\\quad \\varphi_k = \\varphi_{k-1} + (-1)^{k+1}\\theta_k,\\quad \\varphi_n = S', 'S = O - E \\in \\{0,\\ \\pm 360^\\circ\\} \\iff \\text{winding } S/360^\\circ \\in \\{0, \\pm 1\\}'],
    note: 'δ > 0 원뿔, δ = 0 평평, δ < 0 안장. 평탄 접힘에서 광선 k는 방향 φ_(k−1)에 놓인다.',
  },
  vertexClosure: {
    title: '강체 패널의 3D 닫힘 조건',
    tex: ['\\sum_{i\\in I}\\theta_i - \\sum_{i\\notin I}\\theta_i \\ \\le\\ (|I|-1)\\,180^\\circ \\quad (|I|\\ \\text{odd})', 'n = 6:\\ I = \\{1,3,5\\} \\Rightarrow S \\le 360^\\circ'],
    note: '등호이면 한 평면(대원) 위에서만 닫힌다(Kapovich–Millson). 그래서 6-크리스 꼭짓점의 S = ±360°는 평탄하게 감긴 상태로만 존재한다.',
  },
  strip: {
    title: '1D 단순 접기',
    tex: ['\\text{End fold: } s_0 \\le s_1', '\\text{Crimp}(c_i,c_{i+1}):', '\\mathrm{MV}(c_i) \\ne \\mathrm{MV}(c_{i+1}),\\ s_{i-1} \\ge s_i \\le s_{i+1}', '\\text{Collision}(c_i,c_{i+1}):', '\\mathrm{MV}(c_i) = \\mathrm{MV}(c_{i+1}),\\ s_{i-1} > s_i < s_{i+1}'],
  },
  crimpLemma: {
    title: 'Big–little–big과 crimp(크림프) 축약',
    tex: [`${t(2)} < ${t(1)},\\ ${t(2)} < ${t(3)} \\Rightarrow \\mathrm{MV}(c_2) \\ne \\mathrm{MV}(c_3)`, '(\\theta_{i-1},\\theta_i,\\theta_{i+1}) \\longrightarrow \\theta_{i-1}-\\theta_i+\\theta_{i+1}'],
  },
  dof: {
    title: '자유도 (DoF)',
    tex: ['\\text{DoF} \\ \\ge\\ N - 3M', '\\text{DoF}_{\\text{local}} = N - \\operatorname{rank} J(q)'],
    note: '첫 줄의 등호는 3M개의 꼭짓점 방정식이 독립일 때, 그리고 그때에만 성립한다. N − 3M이 음수이면 가동성이 음수라는 뜻이 아니라 구속이 중복된다는 신호이다.',
  },
  closure: {
    title: '꼭짓점 닫힘 (강체 기구학)',
    tex: [`R(\\mathbf d_1,${r(1)})\\,R(\\mathbf d_2,${r(2)})\\,R(\\mathbf d_3,${r(3)})\\cdots R(\\mathbf d_k,\\rho_k) = I`, '\\frac{\\partial C}{\\partial \\rho_j} = [\\mathbf w_j]_\\times,\\qquad \\mathbf w_j = \\text{current direction of crease } j'],
  },
  lm: { title: '비선형 풀이 (Levenberg–Marquardt)', tex: ['\\min_{q_{\\text{free}}}\\ \\|C(q)\\|^2 \\quad\\text{s.t. } \\rho_{\\text{drive}} = \\rho^{*}', '(J^\\top J + \\lambda\\,\\mathrm{diag}(J^\\top J))\\,\\delta = -J^\\top C'] },
  energy: {
    title: '에너지법 (막대-힌지)',
    tex: ['V_{\\text{axial}} = \\tfrac12\\,\\tfrac{k_a}{L_0}(l - L_0)^2,\\quad V_{\\text{crease}} = \\tfrac12\\,k_c L_0(\\rho-\\rho_{t})^2,\\quad V_{\\text{facet}} = \\tfrac12\\,k_f L_0(\\alpha-\\alpha_0)^2', 'V_{\\text{total}} = \\sum V_{\\text{axial}} + \\sum V_{\\text{crease}} + \\sum V_{\\text{facet}}'],
  },
  force: {
    title: '힘과 시간 적분',
    tex: ['\\mathbf F = -\\nabla V,\\qquad \\frac{\\partial\\rho}{\\partial\\mathbf x_l} = \\frac{\\mathbf n_L}{h_l},\\quad \\frac{\\partial\\rho}{\\partial\\mathbf x_r} = \\frac{\\mathbf n_R}{h_r}', '\\mathbf v \\leftarrow \\mathbf v + \\Delta t\\,\\mathbf F/m,\\qquad \\mathbf x \\leftarrow \\mathbf x + \\Delta t\\,\\mathbf v \\quad(\\text{semi-implicit Euler})'],
  },
  miura: {
    title: 'Miura-ori 꼭짓점',
    tex: [`${r(3)} = -${r(1)},\\qquad ${r(4)} = ${r(2)}`, `\\tan\\frac{|${r(1)}|}{2} = \\cos\\alpha\\,\\tan\\frac{|${r(2)}|}{2}`, '\\cos\\rho = \\frac{\\mathbf n_1\\cdot\\mathbf n_2}{|\\mathbf n_1||\\mathbf n_2|}\\quad(\\text{sign from } (\\mathbf n_1\\times\\mathbf n_2)\\cdot\\hat{\\mathbf e})'],
  },
  miuraPoisson: {
    title: '오세틱 응답',
    tex: ['\\nu_{LW} = -\\frac{d\\ln L}{d\\ln W} = -\\frac{1}{\\cos^2\\theta\\,\\tan^2\\alpha},\\qquad \\nu_{WL} = -\\cos^2\\theta\\,\\tan^2\\alpha'],
    note: 'W는 직선 크리스 방향, L은 지그재그 방향, θ = |ρ_zigzag|/2 (면-평면 각); Schenk & Guest, PNAS 2013. a, b와 무관하다. 테스트 스위트에서 측정한 꼭짓점 위치와 대조하여 검증했다.',
  },
  stepwise: {
    title: '단계별 유도 (대칭 꼭짓점)',
    tex: [`\\cos\\delta = \\cos^2\\alpha - \\sin^2\\alpha\\cos ${r(1)}`, '\\cos\\theta_1 = \\cos\\alpha / \\cos(\\delta/2),\\qquad \\gamma = \\pi - 2\\theta_1', `\\cos ${r(2)} = -\\frac{\\cos\\gamma + \\cos^2\\alpha}{\\sin^2\\alpha}`],
  },
  gaussian: { title: '이산 가우스 곡률', tex: ['K_v \\approx 2\\pi - \\sum_{f \\ni v} \\alpha_{f,v}'], note: '각 결손이다. 종이 자체는 K_v = 0이다 (전개 가능). 조대화한 곡면에서 평가한다.' },
  kresling: {
    title: 'Kresling 기하',
    tex: ['b^2 = H^2 + 2R^2(1-\\cos\\varphi),\\quad c^2 = H^2 + 2R^2\\big(1-\\cos(\\varphi + \\tfrac{2\\pi}{n})\\big)', '\\varphi_1 = \\pi - \\tfrac{2\\pi}{n} - \\varphi_0,\\qquad H_1^2 = H_0^2 + 2R^2(\\cos\\varphi_1 - \\cos\\varphi_0)'],
    note: '두 무응력 상태는 a, b, c를 공유한다. 그 사이에서는 삼각형 모서리가 변형되어야 한다.',
  },
  reaction: { title: '반력 (수치 추정)', tex: ['F(u) \\approx \\frac{dV_{\\min}}{du} \\approx \\frac{V_{\\min}(u+\\Delta u) - V_{\\min}(u-\\Delta u)}{2\\,\\Delta u}'] },
  bag: { title: '쇼핑백 정리', tex: ['H > D/2:\\qquad \\mathcal C_{\\text{rigid}} = \\{\\text{open}\\} \\cup \\{\\text{flat}\\}\\ \\ (\\text{isolated points})'], note: 'Balkcom, Demaine, Demaine, Ochsendorf, You (2004/2006).' },
};


const symName = (s: string) => s.replace('rho', 'ρ').replace('theta', 'θ');

export function TheoryPanel({ keys }: { keys?: TheoryKey[] }) {
  const lessonId = useModel((s) => s.lessonId);
  const showDerivation = useUI((s) => s.showDerivation);
  const list = keys ?? lessonById(lessonId)?.theory ?? ['convention'];
  const extra: TheoryKey[] = showDerivation && !list.includes('stepwise') && (list.includes('miura') || lessonId === 'l4-miura') ? ['stepwise'] : [];
  return (
    <div
      className="space-y-2"
      onMouseOver={(e) => {
        const el = (e.target as HTMLElement).closest('[data-sym]') as HTMLElement | null;
        useUI.getState().setTheoryHover(el ? symName(el.dataset.sym ?? '') : null);
      }}
      onMouseLeave={() => useUI.getState().setTheoryHover(null)}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-3">기호(ρi, θi)에 마우스를 올리면 뷰에서 강조된다.</span>
        <Toggle checked={showDerivation} onChange={(b) => useUI.getState().setShowDerivation(b)} label="유도" />
      </div>
      {[...list, ...extra].map((k) => {
        const eq = EQUATIONS[k];
        return (
          <div key={k} className="rounded border border-rule bg-paper-2 px-3 py-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{eq.title}</div>
            {eq.tex.map((x, i) => <FitTex key={i} tex={x} />)}
            {eq.note && <div className="text-[12.5px] leading-relaxed text-ink-3"><Rich text={eq.note} /></div>}
          </div>
        );
      })}
    </div>
  );
}
