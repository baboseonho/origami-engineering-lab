import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import { creaseName } from '../../core/topology/names';
import { fmtDeg } from '../../core/geometry/angles';
import { ASSIGN_COLOR } from '../controls/ui';
import { tr } from '../../i18n';
import { edgeLength3, faceArea3, faceCorners3, pos3, vertexSectors } from './measure';
import { SUB_CLASS, Sym } from '../controls/sym';
import { deg, num } from '../analysis/num';

/**
 * Hover readouts shared by the 3D view, the crease pattern and the
 * projections: a small paper note that follows the pointer (offset below
 * right, flipped at the view's edges) and never takes pointer events, so it
 * cannot get in the way of clicking, orbiting or dragging a crease.
 */

export interface TipRow { k: ReactNode; v: ReactNode }
export interface TipContent { title: ReactNode; assignment?: Assignment; rows: TipRow[]; note?: ReactNode }

const DASH: Partial<Record<Assignment, string>> = { M: '6 2.5 1.5 2.5', V: '5 3' };

export const assignmentWord = (a: Assignment): string =>
  ({ M: tr('산접기 M', 'Mountain M'), V: tr('골접기 V', 'Valley V'), F: tr('면 F', 'Facet F'), B: tr('경계 B', 'Boundary B'), U: tr('미지정 U', 'Unassigned U') })[a];

/** Follows the pointer inside `host`; hidden while a button is held (orbit, pan, fold drag). */
export function PointerTip({ host, show, children }: { host: RefObject<HTMLElement | null>; show: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef<{ x: number; y: number; down: boolean } | null>(null);
  const place = () => {
    const el = ref.current, h = host.current, p = pos.current;
    if (!el || !h) return;
    if (!p || p.down || !show) { el.style.visibility = 'hidden'; return; }
    const W = h.clientWidth, H = h.clientHeight, w = el.offsetWidth, ht = el.offsetHeight;
    let x = p.x + 16, y = p.y + 18;
    if (x + w > W - 12) x = p.x - 14 - w;
    if (y + ht > H - 12) y = p.y - 12 - ht;
    x = Math.max(12, Math.min(W - 12 - w, x));
    y = Math.max(12, Math.min(H - 12 - ht, y));
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    el.style.visibility = 'visible';
  };
  const placeRef = useRef(place);
  placeRef.current = place;
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const mv = (e: PointerEvent) => {
      const r = h.getBoundingClientRect();
      pos.current = { x: e.clientX - r.left, y: e.clientY - r.top, down: e.buttons !== 0 };
      placeRef.current();
    };
    const leave = () => { pos.current = null; placeRef.current(); };
    h.addEventListener('pointermove', mv);
    h.addEventListener('pointerdown', mv);
    h.addEventListener('pointerup', mv);
    h.addEventListener('pointerleave', leave);
    return () => {
      h.removeEventListener('pointermove', mv);
      h.removeEventListener('pointerdown', mv);
      h.removeEventListener('pointerup', mv);
      h.removeEventListener('pointerleave', leave);
    };
  }, [host]);
  useLayoutEffect(() => { placeRef.current(); });
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-20" style={{ visibility: 'hidden' }} role="status" aria-live="off">
      {show && children}
    </div>
  );
}

/** The paper note itself: name (with its line style), then key–value rows in tabular figures. */
export function HoverCard({ title, assignment, rows, note }: TipContent) {
  return (
    <div className="min-w-[150px] max-w-[300px] rounded-[2px] border border-ink/50 bg-paper/95 px-2 py-1.5 text-[13px] leading-snug text-ink shadow-sm">
      <div className="flex items-baseline gap-2">
        <span className="lbl-greek text-[14px] font-semibold">{title}</span>
        {assignment && (
          <span className="flex items-center gap-1 text-[12px] text-ink-2">
            <svg width="18" height="6" aria-hidden className="self-center"><line x1="1" y1="3" x2="17" y2="3" stroke={assignment === 'B' ? 'var(--color-ink)' : ASSIGN_COLOR[assignment]} strokeWidth={assignment === 'F' ? 1 : 2} strokeDasharray={DASH[assignment]} /></svg>
            {assignmentWord(assignment)}
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <dl className="tnum mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {rows.map((r, i) => (
            <div key={i} className="contents">
              <dt className="text-[12px] leading-[1.6] text-ink-3">{r.k}</dt>
              <dd className="text-right">{r.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <div className="mt-1 text-[12px] text-ink-3">{note}</div>}
    </div>
  );
}

/** Lengths and coordinates: 3 decimals, Unicode minus, never "−0.000". */
const L = (x: number) => num(x, 3);
const G = ({ children }: { children: ReactNode }) => <span className="greek">{children}</span>;

/** Fold angle of an edge, or the word "boundary" where there is no second face. */
export function rhoText(model: OrigamiModel, eid: number, rho: ArrayLike<number>): ReactNode {
  const e = model.edges[eid];
  if (e.faces[1] < 0) return tr('경계', 'boundary');
  return fmtDeg(rho[eid] ?? 0, 1);
}

/** Crease: name, length, current ρ. `current` adds the 3D length when the sheet has stretched (energy). */
export function edgeTip(model: OrigamiModel, eid: number, rho: ArrayLike<number>, opts: { lengthLabel?: ReactNode; length?: number; current?: boolean; extra?: TipRow[] } = {}): TipContent {
  const e = model.edges[eid];
  const rows: TipRow[] = [{ k: opts.lengthLabel ?? tr('길이', 'Length'), v: L(opts.length ?? e.restLength) }];
  if (opts.current) {
    const l3 = edgeLength3(model, eid);
    if (Math.abs(l3 - e.restLength) > 1e-3 * Math.max(e.restLength, 1e-9)) rows.push({ k: tr('현재 길이', 'Current length'), v: L(l3) });
  }
  rows.push(...(opts.extra ?? []));
  rows.push({ k: <><G>ρ</G> {tr('접힘각', 'fold angle')}</>, v: rhoText(model, eid, rho) });
  return { title: <Sym text={creaseName(model, eid)} />, assignment: e.assignment, rows };
}

/** Sector angles as rows θ1 … θk and their sum. */
function sectorRows(sectors: number[]): TipRow[] {
  const rows: TipRow[] = sectors.map((s, i) => ({ k: <Sym text={`θ${i + 1}`} />, v: deg(s, 1) }));
  rows.push({ k: <><G>Σθ</G><sub className={SUB_CLASS}><i>i</i></sub></>, v: deg(sectors.reduce((a, b) => a + b, 0), 1) });
  return rows;
}

/** Vertex: id, xyz (optional) and, for an interior vertex, its sector angles. */
export function vertexTip(model: OrigamiModel, vid: number, opts: { xyz?: boolean; sectors?: boolean } = { xyz: true, sectors: true }): TipContent {
  const rows: TipRow[] = [];
  if (opts.xyz) {
    const p = pos3(model, vid);
    rows.push({ k: 'x, y, z', v: `${L(p[0])}, ${L(p[1])}, ${L(p[2])}` });
  }
  let note: ReactNode;
  if (opts.sectors) {
    const st = vertexSectors(model, vid);
    if (st.interior) rows.push(...sectorRows(st.sectors));
    else note = tr('경계 꼭짓점 (섹터각 합은 정해지지 않음)', 'Boundary vertex (no sector-angle sum)');
  }
  return { title: `v${vid}`, rows, note };
}

/** Face: current area and corner angles. */
export function faceTip(model: OrigamiModel, fid: number): TipContent {
  const f = model.faces[fid];
  const corners = faceCorners3(model, fid);
  const rows: TipRow[] = [{ k: tr('면적', 'Area'), v: L(faceArea3(model, fid)) }];
  f.vertices.forEach((v, i) => rows.push({ k: <>∠v{v}</>, v: deg(corners[i], 1) }));
  return { title: `f${fid}`, rows: rows.slice(0, 9), note: f.vertices.length > 8 ? tr(`꼭짓점 ${f.vertices.length}개 중 8개`, `8 of ${f.vertices.length} corners`) : undefined };
}

/** Shows `key` only after the pointer rests on it for `ms` (faces), immediately otherwise. */
export function useDwell(key: string | null, ms: number): string | null {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!key || ms <= 0) { setShown(key); return; }
    setShown(null);
    const t = setTimeout(() => setShown(key), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return key && shown === key ? key : ms <= 0 ? key : null;
}
