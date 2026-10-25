# Origami BaBolaB

An interactive **Origami Engineering** textbook and simulator for everyone, in Korean and English: from your first fold to rigid kinematics, energy methods and the tools used in research. Pick a structure by field of interest (space, medicine, architecture, robotics, everyday objects), fold it as a whole with one slider, stop anywhere and inspect the shape in 3D, in projections and in numbers, then print its crease pattern and fold it by hand.

**Live site:** https://baboseonho.github.io/origami-engineering-lab/ — every push to `main` is tested and deployed by GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm test           # unit tests (Vitest)
npm run test:e2e   # browser tests (Playwright; run `npx playwright install chromium` once)
```

Core idea: **select one crease, prescribe its fold angle, and the rigid solver computes every other fold angle from the closure constraints** — or explains why no rigid configuration exists. Facet bending/stretching is only allowed in the separate *Energy* mode.

Angle convention: ρ = 0 flat, ρ > 0 valley (blue), ρ < 0 mountain (red), |ρ| → 180° fully folded.

Sheets are addressable by URL hash, e.g. `#l0-welcome`, `#l0-atlas`, `#l4-miura`, `#l3-bag`. The language follows the browser and can be switched with the EN/한 button.

**Generalized Kawasaki Lab** (S = ±360° and winding): [docs/GENERALIZED_KAWASAKI.md](docs/GENERALIZED_KAWASAKI.md) — web lab `#l3-gkawasaki`, Blender renders via `blender -b -P scripts/generalized_kawasaki.py -- --all` → [renders/](renders/).

Documentation: [docs/](docs/) — PLAN, ARCHITECTURE, MATH, MODELS, SOLVERS, LECTURE_MAPPING (concept → feature → test), PROGRESS.
