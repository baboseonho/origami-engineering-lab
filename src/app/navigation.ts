/**
 * Sheet navigation and the browser history.
 *
 * Each sheet is a history entry (`#lesson-id`), so the phone's back button
 * goes to the previous sheet instead of leaving the site. Only the first load
 * is normalised with replaceState; every later sheet change pushes an entry.
 */
import { lessonById } from '../curriculum/lessons';
import { useModel } from '../state/modelStore';
import { useUI } from '../state/uiStore';
import { animatePatternFold, cancelPatternFold, foldSpeed, loadLesson, patternFoldMode, patternFoldProgress } from '../state/actions';
import { DEFAULT_LESSON } from './routes';

const hashId = () => {
  try { return decodeURIComponent(window.location.hash.slice(1)); } catch { return ''; }
};

// a sheet load runs inside a view transition, so the store updates a frame or two later:
// remember what is on its way so popstate + hashchange (or StrictMode) do not load it twice
let inFlight: { id: string; at: number } | null = null;
function go(id: string) {
  if (id === useModel.getState().lessonId) return;
  if (inFlight && inFlight.id === id && performance.now() - inFlight.at < 1500) return;
  inFlight = { id, at: performance.now() };
  loadLesson(id);
}

let firstVisit = false;
/** True on a first visit (no sheet in the address) until the visitor opens a sheet. */
export const isFirstVisit = () => firstVisit;

/** Open a sheet as a new history entry (Back returns to the sheet before it). */
export function openSheet(id: string) {
  if (!lessonById(id)) return;
  useUI.getState().setCoverOpen(false);
  firstVisit = false;
  if (id === useModel.getState().lessonId) return;
  if (hashId() !== id) history.pushState(null, '', `#${id}`);
  go(id);
  introFold(id);
}

/**
 * First load and history: opens the sheet in the address (or the welcome sheet
 * under the cover on a first visit), follows Back/Forward and edited links, and
 * keeps the address in step with sheets opened any other way. Returns a cleanup.
 */
export function initRouting(): () => void {
  const first = hashId();
  const known = !!lessonById(first);
  const id = known ? first : DEFAULT_LESSON;
  // normalise the first entry only (no sheet, or an unknown one, in the address): never adds an entry
  // a first visit (no sheet in the address) opens on the cover, the drawing index; the entry
  // remembers it, so Back from the first sheet opened there returns to the cover
  if (!known) history.replaceState(first ? history.state : { cover: true }, '', `#${id}`);
  // (a reload of that entry, or StrictMode running this twice, finds the mark and opens the cover again)
  const onCover = !first || !!(history.state as { cover?: boolean } | null)?.cover;
  go(id);
  if (onCover) { firstVisit = true; useUI.getState().setCoverOpen(true); }
  else if (known) introFold(id);

  const onHistory = () => {
    const to = hashId();
    if (!lessonById(to)) return;
    const st = history.state as { cover?: boolean } | null;
    useUI.getState().setCoverOpen(!!st?.cover);
    go(to);
  };
  window.addEventListener('popstate', onHistory);
  window.addEventListener('hashchange', onHistory);
  // sheets opened with loadLesson directly (prev/next, index, lab links) still get their own entry
  const unsub = useModel.subscribe((s, prev) => {
    const to = s.lessonId;
    if (to === prev.lessonId || !to || !lessonById(to)) return;
    if (prev.lessonId) firstVisit = false;
    if (hashId() !== to) history.pushState(null, '', `#${to}`);
  });
  return () => {
    window.removeEventListener('popstate', onHistory);
    window.removeEventListener('hashchange', onHistory);
    unsub();
  };
}

const introPlayed = new Set<string>();
let stopIntro: (() => void) | null = null;

/**
 * A structure sheet moves once when it is opened from a link or a card: the
 * whole pattern folds to 85 % and settles back (to where the sheet rests, or
 * 30 % if it opened flat), about 3 s, once per sheet per page load.
 *
 * Only rigid whole-pattern folds play it: every frame is a rigid solve on the
 * sheet's own solver. Energy sheets with the Energy solver already fold in from
 * flat when they open (loadLesson); rigid sheets whose whole-pattern fold needs
 * Energy (shopping bag, Kresling) would have to switch solver, which changes the
 * verdicts the sheet opens with, so they do not play it. Sheets with an
 * experiment instead (Yoshimura) have their own card. Any touch on a control or
 * key press stops it; turning the 3D view does not.
 */
export function introFold(id = useModel.getState().lessonId) {
  if (typeof window === 'undefined' || introPlayed.has(id)) return;
  const lesson = lessonById(id);
  if (!lesson || lesson.kind !== 'model' || lesson.patternFold !== 'rigid') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  introPlayed.add(id);
  stopIntro?.();

  let stopped = false, started = false, seen = false, timer = 0, raf = 0;
  const t0 = performance.now();
  const onUser = (e: Event) => {
    if (e.type === 'pointerdown' && (e.target as Element | null)?.tagName === 'CANVAS') return;
    stop(true);
  };
  const unsub = useModel.subscribe((s) => {
    if (s.lessonId === id) seen = true;
    else if (seen) stop(true);
  });
  function stop(cancelFold: boolean) {
    if (stopped) return;
    stopped = true;
    if (cancelFold && started) cancelPatternFold();
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    window.removeEventListener('pointerdown', onUser, true);
    window.removeEventListener('keydown', onUser, true);
    unsub();
    if (stopIntro === stopNow) stopIntro = null;
  }
  const stopNow = () => stop(true);
  stopIntro = stopNow;
  window.addEventListener('pointerdown', onUser, true);
  window.addEventListener('keydown', onUser, true);

  const speed = () => foldSpeed();
  const leg = (to: number, ms: number) => {
    const from = patternFoldProgress();
    animatePatternFold(to, ms);
    return (ms * Math.max(0.25, Math.abs(to - from))) / speed();
  };
  const run = () => {
    if (stopped) return;
    if (useModel.getState().lessonId !== id || patternFoldMode() !== 'rigid') { stop(false); return; }
    started = true;
    const rest = patternFoldProgress();
    const settle = rest > 0.05 ? rest : 0.3;
    const up = leg(0.85, 1900);
    timer = window.setTimeout(() => {
      if (stopped) return;
      const down = leg(settle, 1900);
      timer = window.setTimeout(() => stop(false), down + 100);
    }, up + 120);
  };
  // wait for the sheet to be in the store and its 3D view on screen, then let the
  // opening drive of the default crease finish before taking over
  const wait = () => {
    if (stopped) return;
    const now = performance.now();
    const here = useModel.getState().lessonId === id;
    if (here) seen = true;
    if (now - t0 > 8000) { stop(false); return; }
    const viewReady = !!document.querySelector('main canvas') || now - t0 > 4000;
    if (!here || patternFoldMode() === null || !viewReady) { raf = requestAnimationFrame(wait); return; }
    timer = window.setTimeout(run, 700 / speed());
  };
  raf = requestAnimationFrame(wait);
}
