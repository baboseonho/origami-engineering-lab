# Architecture

```
src/
  core/                 ← pure TypeScript, no React, no Three.js (unit-tested)
    numerics/           tolerances.ts (all epsilons), linearAlgebra.ts (Mat3, rigid transforms, Cholesky, Jacobi SVD, rank)
    geometry/           vectors, angles (sign convention, safeAcos/asin, wrap), normals (Newell), triangulation (ear clipping)
    topology/           types (OrigamiModel, …), build (spec → model), adjacency (vertex stars), validation
    constraints/        kawasaki, maekawa, generalizedFlatFold, strip1D, mvAssignment (crimp proof)
    solver/
      types.ts          OrigamiSolver interface, SolverResult
      rigid/            kinematics (face tree, transforms), constraints (closure blocks + Jacobian),
                        jacobian (rank, DoF), nonlinearSolve (LM), RigidKinematicSolver (drive + continuation)
      energy/           mesh (bars/hinges), creaseEnergy (dihedral + gradient), EnergySolver (forces, damping,
                        semi-implicit Euler, FIRE, strain)
      collision/        triangle–triangle self-intersection
    analysis/           metrics (dimensions, curvature, vertex reports, stepwise derivation, Kresling compatibility),
                        experiments (displacement-controlled quasi-static sweeps)
    fold/               FOLD types, import, export
  models/
    generators/         deterministic parametric generators (one file per pattern)
    registry.ts         generator name → build function + parameter specs (used by UI, undo, worker)
  curriculum/lessons.ts lesson definitions: model/lab binding, lesson text, challenges, theory keys
  state/
    engine.ts           non-React holder of solver instances + position buffer (+ version counter)
    modelStore.ts       lesson / generator / params / assignment overrides / undo-redo history
    simulationStore.ts  solver mode, fold angles, drive & locks, results, DoF, energy params & history, experiments
    uiStore.ts          view mode, selection/hover (shared by 2D & 3D), overlays, theory hover, camera requests
    actions.ts          the ONLY place where stores, engine, solvers and the worker meet
  workers/solver.worker.ts   quasi-static sweeps off the main thread
  components/           React presentation only (layout, viewport, inspector, analysis, theory, labs, controls)
  tests/                Vitest unit tests (math, solvers, models, FOLD)
e2e/                    Playwright browser tests
```

## Data flow

1. A lesson names a generator + params (`curriculum/lessons.ts`). `actions.loadLesson` builds the model via `models/registry.ts`, applies assignment overrides, and installs a `RigidKinematicSolver` in `engine`.
2. UI events call actions (`setTarget`, `setDriveEdge`, `toggleLock`, `setAssignment`, `applyParams`, `setSolverMode`, …). Actions run the solver synchronously (rigid) or start the animation loop (energy), write positions to `engine.positions` and bump `engine.version`, and write low-frequency results (ρ, residual, DoF, energy, strain) to the stores.
3. The 3D viewport reads `engine.positions` inside `useFrame` when `engine.version` changes — per-frame solver output never re-renders React. Labels are projected into a DOM overlay without per-label React roots.
4. Selection/hover live in `uiStore`, so clicking a crease in 2D or 3D selects the same edge everywhere; hovering ρᵢ/θᵢ in a KaTeX equation sets `theoryHover`, which both views highlight.
5. Expensive diagnostics (Jacobian SVD, collisions, curvature) are throttled (`scheduleDiagnostics`, 120 ms).
6. Experiments post `{generator, params, overrides, config}` to the worker, which rebuilds the model deterministically and streams samples back; the UI plots them and lets the user scrub through recorded configurations.

## State separation

| Store | Holds | Undo |
|---|---|---|
| model | lesson, generator, params, M/V overrides, history | snapshots include params, overrides, drive, target, locks, ρ, solver mode |
| simulation | solver mode, ρ, drive/target, locks, results, DoF, energy params, experiment | via snapshots |
| ui | view, selection, overlays, camera, theory hover | not undoable (view state) |
| engine (non-React) | solver instances, position buffer | rebuilt from snapshots |

## Why no backend
Everything (solvers, FOLD I/O, experiments) runs client-side; the heaviest work (quasi-static sweeps) runs in a Web Worker.
