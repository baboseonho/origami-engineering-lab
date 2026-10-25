# Implementation plan

Interactive Origami Engineering textbook and simulator, Parts 0–7 (Parts 1–5 follow a standard origami-engineering syllabus).

Guiding rule: **fold angles are coupled.** The user prescribes one *driving crease*; the rigid solver determines every other fold angle from closure constraints, or reports infeasibility. Facet deformation is only allowed in the explicitly separate *Energy / Elastic* mode. Nothing is animated by canned interpolation and presented as a solver result.

| Milestone | Content | Status |
|---|---|---|
| 1 | Vite/React/TS scaffold, Three.js viewport, panel layout, Zustand stores, `OrigamiModel` types, crease picking, signed ρ display, synchronized 2D/3D selection | done |
| 2 | Lecture 2 tools: 1D strip (end fold / crimp / collision / auto-solve), Kawasaki, Maekawa, recursive crimp proof, single-vertex editor | done |
| 3 | Rigid core: normals, signed fold angle, driving crease, vertex & loop closure, Levenberg–Marquardt + continuation, Jacobian rank / DoF | done |
| 4 | Miura generator, M/V, 1-DoF folding, angle coupling plot, W/L/T and Poisson ratio from geometry, auxetic arrows, lesson | done |
| 5 | Energy solver: bars, crease torsion, facet bending, damping, semi-implicit Euler, FIRE, strain overlay | done |
| 6 | Waterbomb (tessellation + base), shopping bag, Ron Resch, box pleating | done |
| 7 | Kresling, Yoshimura, rigid-vs-elastic, displacement-controlled experiments in a Web Worker, Kresling vs Yoshimura lab | done |
| 8 | FOLD import/export, collision diagnostics, lesson polish, challenge mode, documentation, e2e tests | done (see PROGRESS.md for known issues) |

See `PROGRESS.md` for the current state and `LECTURE_MAPPING.md` for the concept → feature → test map.
