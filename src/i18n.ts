/**
 * Two languages, Korean and English. Text is written next to its translation
 * (`tr('한국어', 'English')`) so the two never drift apart. Switching the
 * language remounts the app (see App), so module-level text must be read
 * inside components or functions, never frozen into a constant at import.
 */
export type Lang = 'ko' | 'en';

const KEY = 'oel.lang';

function detect(): Lang {
  if (typeof window === 'undefined') return 'ko';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return /^ko\b/i.test(navigator.language || '') ? 'ko' : 'en';
}

let current: Lang = detect();
const listeners = new Set<(l: Lang) => void>();

export const getLang = (): Lang => current;

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((f) => f(l));
}

export function onLangChange(f: (l: Lang) => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** The text for the current language. Works for strings and React nodes alike. */
export function tr<T>(ko: T, en: T): T {
  return current === 'en' ? en : ko;
}

if (typeof document !== 'undefined') document.documentElement.lang = current;
