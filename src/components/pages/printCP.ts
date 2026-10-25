import type { Vec2 } from '../../core/geometry/vectors';
import type { OrigamiModel } from '../../core/topology/types';
import { tr } from '../../i18n';
import { C } from '../../theme/tokens';

/** 2D end points of an edge, unwrapping periodic (cylinder) layouts. */
function edgePts(model: OrigamiModel, eid: number): [Vec2, Vec2] {
  const ov = model.edu.layout2D?.edgeOverrides?.[eid];
  if (ov) return ov;
  const e = model.edges[eid];
  const a = model.vertices[e.vertices[0]].initialPosition2D;
  let b = model.vertices[e.vertices[1]].initialPosition2D;
  const per = model.edu.layout2D?.periodX;
  if (per) {
    const dx = b[0] - a[0];
    if (dx > per / 2) b = [b[0] - per, b[1]];
    else if (dx < -per / 2) b = [b[0] + per, b[1]];
  }
  return [a, b];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The crease pattern as a printable SVG sized in millimetres to fit an A4 page:
 * mountain folds red dash-dot, valley folds blue dashed, the paper outline
 * solid. Flat (F) edges such as facet diagonals are left out: they are not
 * folded by hand.
 */
export function creasePatternSVG(model: OrigamiModel, title: string): string {
  let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
  const lines: { a: Vec2; b: Vec2; kind: 'M' | 'V' | 'B' | 'U' }[] = [];
  for (const e of model.edges) {
    const boundary = e.faces[1] < 0;
    const kind = boundary ? 'B' : e.assignment;
    if (kind === 'F') continue;
    const [a, b] = edgePts(model, e.id);
    lines.push({ a, b, kind: kind as 'M' | 'V' | 'B' | 'U' });
    for (const p of [a, b]) { lx = Math.min(lx, p[0]); hx = Math.max(hx, p[0]); ly = Math.min(ly, p[1]); hy = Math.max(hy, p[1]); }
  }
  // A4 portrait, 15 mm margin, room for a title and a legend
  const PW = 210, PH = 297, M = 15, top = 30, bottom = 22;
  const w = hx - lx || 1, h = hy - ly || 1;
  const k = Math.min((PW - 2 * M) / w, (PH - top - bottom) / h);
  const ox = (PW - w * k) / 2, oy = top + (PH - top - bottom - h * k) / 2;
  const X = (p: Vec2) => (ox + (p[0] - lx) * k).toFixed(2);
  const Y = (p: Vec2) => (oy + (hy - p[1]) * k).toFixed(2); // +y up on paper
  const style = {
    M: `stroke="${C.mountain}" stroke-width="0.5" stroke-dasharray="4 1.2 0.8 1.2"`,
    V: `stroke="${C.valley}" stroke-width="0.5" stroke-dasharray="3 1.6"`,
    U: `stroke="${C.unassigned}" stroke-width="0.4"`,
    B: `stroke="#1d242c" stroke-width="0.6"`,
  };
  const body = lines.map((l) => `<line x1="${X(l.a)}" y1="${Y(l.a)}" x2="${X(l.b)}" y2="${Y(l.b)}" ${style[l.kind]} stroke-linecap="round"/>`).join('\n');
  const ly0 = PH - 12;
  const legend = [
    ['M', tr('산접기 (mountain)', 'Mountain fold')],
    ['V', tr('골접기 (valley)', 'Valley fold')],
    ['B', tr('종이 가장자리 (자르는 선)', 'Paper edge (cut line)')],
  ].map(([kk, label], i) => {
    const x = M + i * 62;
    return `<line x1="${x}" y1="${ly0}" x2="${x + 12}" y2="${ly0}" ${style[kk as 'M' | 'V' | 'B']}/><text x="${x + 15}" y="${ly0 + 1.4}" font-size="3.6">${esc(label)}</text>`;
  }).join('');
  const note = tr('앞면에서 본 그림. 접기 전에 모든 선을 한 번씩 접어 자국을 내면(pre-crease) 훨씬 쉽게 접힌다.',
    'Seen from the front. Pre-crease every line once before collapsing: it folds far more easily.');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="Pretendard, 'Segoe UI', sans-serif" fill="#1d242c">
<text x="${M}" y="16" font-size="6" font-weight="600">${esc(title)}</text>
<text x="${M}" y="23" font-size="3.4" fill="#5b6672">${esc(note)}</text>
${body}
${legend}
<text x="${PW - M}" y="${ly0 + 1.4}" font-size="3.2" text-anchor="end" fill="#5b6672">Origami BaBolaB</text>
</svg>`;
}

/** Save the crease pattern as an SVG file. */
export function downloadCreasePattern(model: OrigamiModel, title: string) {
  const blob = new Blob([creasePatternSVG(model, title)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\w가-힣 -]+/g, '').trim().replace(/\s+/g, '-') || 'crease-pattern'}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open the crease pattern on its own page and bring up the print dialog. */
export function printCreasePattern(model: OrigamiModel, title: string) {
  const w = window.open('', '_blank');
  if (!w) { downloadCreasePattern(model, title); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}svg{display:block;width:210mm;height:297mm}</style></head>
<body>${creasePatternSVG(model, title)}<script>window.onload=()=>{window.focus();window.print();}<\/script></body></html>`);
  w.document.close();
}
