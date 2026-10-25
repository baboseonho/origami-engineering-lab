import { create } from 'zustand';
import { getLang, setLang as setGlobalLang, type Lang } from '../i18n';

export type Selection = { kind: 'edge' | 'vertex' | 'face'; id: number } | null;
export type ViewMode = '3d' | '2d' | 'split' | 'proj';
export type AppMode = 'learn' | 'explore' | 'challenge';
export type BottomTab = 'angles' | 'constraints' | 'dof' | 'energy' | 'strain' | 'geometry' | 'theory';
export type OverlayKey =
  | 'normals' | 'vertexIds' | 'edgeIds' | 'foldLabels' | 'sectorLabels' | 'residual' | 'strain'
  | 'facetBending' | 'energyDensity' | 'collisions' | 'axes' | 'symmetry' | 'vertices';

export interface UIState {
  lecture: number;
  /** interface and content language */
  lang: Lang;
  setLang: (l: Lang) => void;
  appMode: AppMode;
  viewMode: ViewMode;
  selection: Selection;
  hover: Selection;
  /** symbol hovered in the theory panel, e.g. 'ρ1' or 'θ3' */
  theoryHover: string | null;
  bottomTab: BottomTab;
  overlays: Record<OverlayKey, boolean>;
  camera: 'perspective' | 'orthographic';
  /** bumping this asks the viewport to apply a view preset */
  viewRequest: { preset: 'fit' | 'top' | 'front' | 'side' | 'iso' | 'reset'; n: number };
  showDerivation: boolean;
  settingsOpen: boolean;
  /** the drawing index (cover sheet) */
  coverOpen: boolean;
  /** the lesson explanation in the main area is unfolded */
  briefOpen: boolean;
  setBriefOpen: (b: boolean) => void;
  /** a short notice about something the app changed by itself */
  notice: { text: string; n: number } | null;
  notify: (text: string) => void;
  setCoverOpen: (v: boolean) => void;
  exaggeration: number;
  bottomHeight: number;
  bottomFolded: boolean;
  /** narrow screens: which edge sheet is unfolded */
  drawer: null | 'index' | 'inspector';
  setDrawer: (d: null | 'index' | 'inspector') => void;
  /** playback speed of every fold motion (1 = normal, 0.1 = ten times slower) */
  foldSpeed: number;
  setFoldSpeed: (v: number) => void;
  setBottomFolded: (b: boolean) => void;
  /** auxetic demonstration arrows (derived from measured dW, dL) */
  auxetic: { axisW: [number, number, number]; axisL: [number, number, number]; signW: number; signL: number } | null;
  setLecture: (l: UIState['lecture']) => void;
  setAppMode: (m: AppMode) => void;
  setViewMode: (m: ViewMode) => void;
  select: (s: Selection) => void;
  setHover: (s: Selection) => void;
  setTheoryHover: (s: string | null) => void;
  setBottomTab: (t: BottomTab) => void;
  toggleOverlay: (k: OverlayKey) => void;
  setCamera: (c: UIState['camera']) => void;
  requestView: (p: UIState['viewRequest']['preset']) => void;
  setShowDerivation: (b: boolean) => void;
  setSettingsOpen: (b: boolean) => void;
  setExaggeration: (x: number) => void;
  setBottomHeight: (h: number) => void;
}

export const useUI = create<UIState>((set) => ({
  lecture: 4,
  lang: getLang(),
  setLang: (lang) => { setGlobalLang(lang); set({ lang }); },
  appMode: 'learn',
  viewMode: 'split',
  selection: null,
  hover: null,
  theoryHover: null,
  bottomTab: 'angles',
  overlays: {
    normals: false, vertexIds: false, edgeIds: false, foldLabels: true, sectorLabels: true, residual: false, strain: false,
    facetBending: false, energyDensity: false, collisions: true, axes: true, symmetry: false, vertices: false,
  },
  camera: 'perspective',
  viewRequest: { preset: 'fit', n: 0 },
  showDerivation: false,
  settingsOpen: false,
  coverOpen: false,
  briefOpen: true,
  setBriefOpen: (briefOpen) => set({ briefOpen }),
  notice: null,
  notify: (text) => set((st) => ({ notice: { text, n: (st.notice?.n ?? 0) + 1 } })),
  setCoverOpen: (coverOpen) => set({ coverOpen }),
  exaggeration: 1,
  bottomHeight: 340,
  bottomFolded: true,
  drawer: null,
  setDrawer: (drawer) => set({ drawer }),
  foldSpeed: (() => { try { const v = parseFloat(localStorage.getItem('oel.foldSpeed') ?? ''); return v > 0 && v <= 4 ? v : 1; } catch { return 1; } })(),
  setFoldSpeed: (foldSpeed) => { set({ foldSpeed }); try { localStorage.setItem('oel.foldSpeed', String(foldSpeed)); } catch { /* storage unavailable */ } },
  setBottomFolded: (bottomFolded) => set({ bottomFolded }),
  auxetic: null,
  setLecture: (lecture) => set({ lecture }),
  setAppMode: (appMode) => set({ appMode }),
  setViewMode: (viewMode) => set({ viewMode }),
  select: (selection) => set({ selection }),
  setHover: (hover) => set({ hover }),
  setTheoryHover: (theoryHover) => set({ theoryHover }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
  toggleOverlay: (k) => set((s) => ({ overlays: { ...s.overlays, [k]: !s.overlays[k] } })),
  setCamera: (camera) => set({ camera }),
  requestView: (preset) => set((s) => ({ viewRequest: { preset, n: s.viewRequest.n + 1 } })),
  setShowDerivation: (showDerivation) => set({ showDerivation }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setExaggeration: (exaggeration) => set({ exaggeration }),
  setBottomHeight: (bottomHeight) => set({ bottomHeight }),
}));
