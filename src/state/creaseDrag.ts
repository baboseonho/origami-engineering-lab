import { isCrease } from '../core/topology/types';
import { engine } from './engine';
import { useSim } from './simulationStore';
import { useUI } from './uiStore';
import { cancelFoldAnimation, pushHistory, setDriveEdge, setTarget } from './actions';

/** Pixels of drag for a half turn (180°) of the grabbed crease. */
const PX_PER_PI = 320;
/** Movement below this is a click (select only), not a fold. */
const CLICK_SLOP = 4;

/** True when `edge` is a fold line that can be driven (an interior M/V/U crease). */
export function canDriveEdge(edge: number): boolean {
  const e = engine.model?.edges[edge];
  return !!e && e.faces[1] >= 0 && isCrease(e.assignment);
}

/**
 * Screen-space unit normal of a crease drawn from `a` to `b` (pixel coords,
 * y down), oriented so that dragging along it means "fold further": it points
 * up the screen, or right for a vertical crease.
 */
export function foldDirection(a: [number, number], b: [number, number]): [number, number] {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  if (l < 1e-9) return [0, -1];
  dx /= l; dy /= l;
  let n: [number, number] = [-dy, dx];
  if (n[1] > 0.2 || (Math.abs(n[1]) <= 0.2 && n[0] < 0)) n = [-n[0], -n[1]];
  return n;
}

/**
 * Press on a crease and drag: the crease becomes the driving crease and its
 * fold angle follows the pointer. Dragging along `dir` folds further in the
 * crease's assigned sense (valley +, mountain −); dragging back unfolds.
 * Every intermediate angle goes through the solver (rigid continuation or the
 * energy dynamics), so the sheet only takes configurations the solver found.
 * Returns false (and does nothing) when the edge cannot be driven.
 */
export function beginCreaseDrag(edge: number, x0: number, y0: number, dir: [number, number], onDone?: (moved: boolean) => void): boolean {
  if (!canDriveEdge(edge)) return false;
  const assignment = engine.model!.edges[edge].assignment;
  const sense = assignment === 'M' ? -1 : 1;
  let started = false;
  let start = 0;
  let pending: number | null = null;
  let raf = 0;

  const flush = () => {
    raf = 0;
    if (pending === null) return;
    setTarget(pending);
    pending = null;
  };
  const move = (ev: PointerEvent) => {
    const px = (ev.clientX - x0) * dir[0] + (ev.clientY - y0) * dir[1];
    if (!started) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < CLICK_SLOP) return;
      started = true;
      cancelFoldAnimation();
      useUI.getState().select({ kind: 'edge', id: edge });
      if (useSim.getState().drive !== edge) setDriveEdge(edge); // records history
      else pushHistory();
      const s = useSim.getState();
      start = s.solverMode === 'rigid' && engine.rigid ? engine.rigid.rho[edge] : s.target;
      document.body.style.cursor = 'grabbing';
    }
    const angle = Math.max(-Math.PI, Math.min(Math.PI, start + sense * (px / PX_PER_PI) * Math.PI));
    pending = angle;
    if (!raf) raf = requestAnimationFrame(flush);
  };
  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    if (raf) { cancelAnimationFrame(raf); flush(); }
    document.body.style.cursor = '';
    if (!started) useUI.getState().select({ kind: 'edge', id: edge });
    else {
      // the click that ends a drag lands on the background: it must not clear the selection
      const swallow = (c: MouseEvent) => { c.stopPropagation(); c.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 60);
    }
    onDone?.(started);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  return true;
}
