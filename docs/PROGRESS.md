# Progress

_Last updated: 2026-10-07_

## Completed
* **Milestones 1–8** (see PLAN.md): app shell, synchronized 2D/3D views with shared selection/hover, M/V colouring and legend, signed fold angles, driving-crease UI (slider, numeric, quick buttons, 3D drag ring), locks, undo/redo, Learn/Explore/Challenge modes.
* Lecture 2 labs: 1D strip, Kawasaki, Maekawa, recursive crimp proof, single-vertex playground.
* Lecture 3: generalized vertex lab, shopping bag theorem, DoF explorer, general constraint solver, stepwise derivation, energy method.
* Lecture 4: Miura (angle coupling plot, W/L/T, Poisson ratio, auxetic arrows, derivation overlay), waterbomb tessellation (coarse curvature, radial grading) and waterbomb base.
* Lecture 5: Ron Resch, box pleating, Kresling (rigid DoF 0, compatibility plot, worker experiment), Yoshimura (compression experiment), Kresling vs Yoshimura lab.
* Lecture 1 Concept Lab.
* FOLD import/export, collision diagnostics, KaTeX theory panel with hover-linked symbols.

## Validation performed
* `npm run build` (tsc + vite) — passes.
* `npm test` — **116 unit tests pass** (incl. a CSS ↔ `theme/tokens.ts` drift check): theorem checks, angle sign convention, 1D strip, crimp proofs, degree-4 closed-form relation, Miura kinematics / path independence / auxetic ν vs Schenk–Guest (< 2 %), stepwise derivation vs solver, hinge-gradient finite differences, energy decrease, FIRE convergence, energy ↔ rigid cross-validation, structural validation of every preset, shopping bag theorem, square twist, Kresling DoF/compatibility/twist, Resch vertex types, waterbomb vertex conditions, FOLD round trip.
* `npm run test:e2e` — **7 Playwright tests pass** in Chromium: every lesson loads without runtime errors; Miura drive; bag theorem; Kawasaki break/repair; 1D collision & auto-solve; square twist infeasibility reasons; Kresling worker experiment.
* Visual inspection of screenshots for all lesson types.

## UI pass: folding, formulas, graphic design, motion
* **Pen-weight lines.** Crease lines are drawn at a fixed screen width like ink: 2D uses non-scaling strokes (crease 1.3 px, boundary 1.5 px, facet 0.7 px), 3D uses screen-space fat lines (LineSegments2) in layers, with invisible pick tubes for hover/drag. Vertex dots and the selection highlighter are finer.
* **Shopping bag folds flat (energy).** The bag experiment is now a fold-to-state sweep: all crease rest angles move together from the open to the flat state, relaxing (FIRE) at each step. The bag reaches the flat state strain-free, while the max axial strain peaks at ≈ 6.8 % mid-way — the numerical face of the tall-bag theorem (tested in `bagFold.test.ts`). The path is played back as a motion. The bag lesson also has a "쇼핑백 접기" panel at the top of the inspector: one fold-progress slider moves every crease together (`foldToState`: energy model, warm-started, FIRE-relaxed every frame), because no single crease can fold a non-mechanism; a failed rigid drive offers the same fold.
* **Fold the whole pattern** (Miura, waterbomb, shopping bag): one panel at the top of the inspector with a fold-progress slider, "전체 접기 / 전체 펼치기", the shared speed and size presets (Miura 3×3·5×5·7×7, waterbomb 3×3·4×4·6×6). Miura is a 1-DoF mechanism, so progress is the driving crease 0 → 180° and every frame is an exact rigid solution (fully flat at 100 %, ‖C‖ ≈ 1e-8). The waterbomb tessellation and the bag are not mechanisms: every crease moves together towards its fully folded angle (ρ_ref + p·(ρ_folded − ρ_ref)) and each step is relaxed to equilibrium (FIRE), in sub-steps of 0.05 for large jumps. The waterbomb lesson now opens by folding in quasi-statically to 30 %. The camera refits when a fold finishes.
* **Flat-folded states.** (1) Collision test: an edge that only grazes the other facet's plane (within 1e-4 of the model size) is contact, not penetration, so stacked layers are no longer reported as collisions (tested: real crossings still are). (2) Layer order (`LayerTracker`): while a pattern folds, every pair of overlapping, nearly parallel facets records which one is on top before they meet (paper cannot pass through itself); in contact they are drawn in that order, lifted apart by a small gap (whole stack ≤ 1.6 % of the model), with cycles broken and levels assigned topologically. No more z-fighting stripes; the panel shows the number of layers.
* **Kresling vs Yoshimura: the Yoshimura tube buckles.** Four rows of diamonds (same R, H, n and stiffness as the Kresling tube) with a 1 % deterministic imperfection: it shortens axially, then snaps into the diamond mode at about 34 % shortening (energy drops by ~70 %) and stays buckled on unloading down to about 13 % (bistable, hysteresis). Range up to 42 % without self-intersection (tested).
* **Fold speed.** One shared speed (0.1× · 0.25× · 0.5× · 1× · 2×, remembered per viewer) drives every fold motion: inspector "끝까지 접기 / 펴기", quick-angle buttons, bag fold, concept-lab stow/deploy, experiment playback, Kresling-vs-Yoshimura auto compression, and the energy dynamics (steps per frame). Motions run on a speed-aware clock, so the speed can change mid-motion.
* **Kresling vs Yoshimura rebuilt.** The top plate is now a rigid plate free to rotate about the axis (twist found from zero torque, `relaxFreeTwist`); before, the ring vertices were individually free and the plate could slide sideways through the tube. Both tubes are relaxed in a dedicated worker (latest-request-only), so the sliders never block the page. Range limited to 38 % shortening (no self-intersection, tested). Same boundary condition in the Kresling lesson's axial experiment.
* **Robustness fixes from the audit.** (1) Changing model parameters while a crease with a high id was selected crashed the whole app: ids (selection, hover, drive, locks) are now sanitized whenever the model changes, and every sheet sits in an error boundary that shows a recoverable notice instead of a blank page. (2) `FitTex` (display equations) could enter an endless stack/unstack loop from a stale font-loading callback, freezing the page (e.g. arrow keys on the concept-lab slider): stale callbacks are now ignored, only width changes trigger a refit, and scrolling sheets keep a stable scrollbar gutter.
* **Audit spec** (`e2e/audit.spec.ts`): opens and exercises all 21 lessons (views, fold buttons, speed, analysis tabs, solver switches, undo/redo/reset, lab buttons and sliders) and the phone layout/drawers/cover; any page error, console error or warning fails it. Passes.
* **Direct manipulation.** Press a crease (3D or crease pattern) and drag across it: the crease becomes the driving crease and folds with the pointer (dragging up the screen, or right for a vertical crease, folds further in its M/V sense; 320 px = 180°). The orbit camera is held during the drag, solves are coalesced to one per frame, and a click without movement only selects.
* **Folding UX.** Any crease's angle can be moved directly: the slider, ±90°/±45° buttons, the number field and the 3D ring make that crease the driving crease on the spot (no separate "set as drive" step). Angle changes animate (ease-out, 650 ms); every frame is a rigid solve and the animation stops at the first infeasible frame, so nothing is interpolated. Energy mode and reduced motion skip the animation.
* **Formulas.** Lesson text marks math as `$…# Progress

_Last updated: 2026-10-07_

## Completed
* **Milestones 1–8** (see PLAN.md): app shell, synchronized 2D/3D views with shared selection/hover, M/V colouring and legend, signed fold angles, driving-crease UI (slider, numeric, quick buttons, 3D drag ring), locks, undo/redo, Learn/Explore/Challenge modes.
* Lecture 2 labs: 1D strip, Kawasaki, Maekawa, recursive crimp proof, single-vertex playground.
* Lecture 3: generalized vertex lab, shopping bag theorem, DoF explorer, general constraint solver, stepwise derivation, energy method.
* Lecture 4: Miura (angle coupling plot, W/L/T, Poisson ratio, auxetic arrows, derivation overlay), waterbomb tessellation (coarse curvature, radial grading) and waterbomb base.
* Lecture 5: Ron Resch, box pleating, Kresling (rigid DoF 0, compatibility plot, worker experiment), Yoshimura (compression experiment), Kresling vs Yoshimura lab.
* Lecture 1 Concept Lab.
* FOLD import/export, collision diagnostics, KaTeX theory panel with hover-linked symbols.

## Validation performed
* `npm run build` (tsc + vite) — passes.
* `npm test` — **105 unit tests pass** (incl. a CSS ↔ `theme/tokens.ts` drift check): theorem checks, angle sign convention, 1D strip, crimp proofs, degree-4 closed-form relation, Miura kinematics / path independence / auxetic ν vs Schenk–Guest (< 2 %), stepwise derivation vs solver, hinge-gradient finite differences, energy decrease, FIRE convergence, energy ↔ rigid cross-validation, structural validation of every preset, shopping bag theorem, square twist, Kresling DoF/compatibility/twist, Resch vertex types, waterbomb vertex conditions, FOLD round trip.
* `npm run test:e2e` — **7 Playwright tests pass** in Chromium: every lesson loads without runtime errors; Miura drive; bag theorem; Kawasaki break/repair; 1D collision & auto-solve; square twist infeasibility reasons; Kresling worker experiment.
* Visual inspection of screenshots for all lesson types.

 (90 segments, all rendered by KaTeX with `strict: 'error'` in a check). Inline math never breaks across lines. Display equations fit their column: long relation lists are stacked at their top-level `\quad` separators, then scaled down to a floor of 0.7, and re-measured when KaTeX fonts arrive.
* **Cover sheet (도면 목록).** A drawing index of all 21 lessons, each with its real crease pattern drawn as a thumbnail. Opens on a first visit with no lesson in the URL, and from the title block.
* **Motion.** Lesson change uses a View Transition (the sheet unfolds about its top edge). The crease pattern is plotted in by a pen-plotter carriage. Verdict stamps thunk in when they change. Cover plates unfold in sequence and a pen draws each pattern. Everything respects `prefers-reduced-motion`.
* **Responsive.** ≥ 1280 px: three columns. 768–1279 px: view + inspector, with the index in a drawer. < 768 px: one column, with the index and inspector in paper-flap drawers opened from the top bar. Analysis tabs scroll sideways.
* **Labs.** The concept and stepwise labs fill the sheet with their own 3D frame (no frame inside a frame) and refit the camera after stow/deploy.

## Known issues / limitations
* "Type I / Type II" Kresling and Yoshimura variants: no standard definition was found, so chirality/caps (Kresling) and smooth/creased (Yoshimura) are offered instead. Align with the lecture's definitions if they differ.
* The lecture's Miura count N = 19, M = 6 is not reproduced exactly (counting convention unknown); the 3×4-panel preset gives N = 17, M = 6.
* Shopping-bag gusset M/V assignment is derived by exhaustive search (unique solution), not taken from the paper. Global layer ordering of flat states is not verified (only rotational closure + local vertex conditions).
* Layer order is tracked along the fold path for display; a state loaded already flat (never seen apart) falls back to a fixed order. There is no contact model in the solvers: the energy path of the shopping bag passes briefly through itself between about 65 % and 95 % (reported as collisions), and a buckled Yoshimura tube would fold through itself beyond 42 % shortening (range limited).
* Yoshimura buckling mode shape is guided by the mesh, which is aligned with the Yoshimura lattice (stated in the lesson).
* Box-pleat "tray" targets are an approximate design used in energy mode only.
* FOLD import requires `faces_vertices` (no face extraction from edges).
* Parameter sliders rebuild the model on every change and push one undo entry per change.
* Undo restores the rigid state; the transient dynamic state of energy mode is not part of history.
* Bundle is code-split: initial chunk ≈ 435 kB (141 kB gzip); the 3D view (Three.js, ≈ 950 kB) and KaTeX (≈ 260 kB) load on demand. Vite still warns about the Three.js chunk size.

## Next tasks
1. Cross-check lesson text and model variants against the actual lecture slides (Type I/II definitions, N = 19 example).
2. Layer-order check for flat-folded states.
3. Debounce parameter sliders.
4. Challenge mode: automatic checks for more challenges.
