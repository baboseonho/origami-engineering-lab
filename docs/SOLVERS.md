# Solvers

Common interface (`src/core/solver/types.ts`):

```ts
interface OrigamiSolver {
  initialize(model, foldAngles?): void;
  setDrivingCrease(id, targetAngle): void;
  step(dt?): SolverState;
  solve(): SolverResult;   // success, status, iterations, residualNorm, jacobianRank, conditionEstimate, reasons
  reset(): void;
}
```

## RigidKinematicSolver (`core/solver/rigid/`)

* **Variables**: one fold angle per M/V/U crease between two faces. F edges are locked at their reference angle (rigid facet interior). The driving crease and user-locked creases are removed from the unknowns.
* **Constraints**: vertex closure blocks (9 rows each) + loop closure blocks for non-contractible cycles (12 rows each). Optional soft rows: M/V sign (M ⇒ ρ ≤ 0, V ⇒ ρ ≥ 0) and symmetry links ρ_a = r·ρ_b.
* **Corrector**: Levenberg–Marquardt on the block-sparse system (normal matrix accumulated per block, Cholesky solve), per-variable step clamp 0.25 rad, NaN rejection, tiny null-space regularisation toward the predictor (picks the minimal change for multi-DoF linkages) followed by an unregularised polish.
* **Continuation**: the drive angle moves in adaptive steps (1.5°, grows ×1.5 on success, halves on failure down to 0.02°). Predictors: (1) tangent from the linearised constraints, (2) secant from the previous accepted step, (3) an M/V-informed seed scaled by the current angle ratios (always used at the singular reference state, otherwise as fallback). The best converged candidate that satisfies the M/V and link constraints is accepted.
* **Infeasibility**: when the step falls below the minimum, the solver keeps the last valid configuration (it never deforms the geometry) and diagnoses: full-rank Jacobian (locked DoF), first-order-only mobility, near-singular Jacobian, locked creases, M/V conflict (re-solve with M/V ignored and list the creases that would flip), the ±180° limit, or a generic "not rigid-foldable to this target".
* **Diagnostics**: rank of the vertex-closure Jacobian and of the full Jacobian (Jacobi SVD), DoF_local = N − rank, condition number, warnings when N − 3M is misleading.
* **Sweeps**: `sweep()` re-runs continuation from the flat reference for plots (each sample is an exact solve).

## EnergySolver (`core/solver/energy/`)

* Faces triangulated (ear clipping); triangulation diagonals become facet hinges. Bars on every edge.
* Forces from axial springs (EA/L₀), crease torsion (k_c L₀, toward a target), facet bending (k_f L₀, toward the reference angle); analytic dihedral gradient (see MATH.md §6).
* Driving crease in energy mode = stiff torsion spring (default 40× k_c) toward the target. Other creases: rest = current angles (free hinges), reference (paper memory) or "fold all" toward the assignment with an optional radial grading; fold-all targets are ramped in gradually.
* **Dynamics**: semi-implicit Euler with per-bar damping. *Engineering deviation from naive explicit Euler*: the position update uses the new velocity (symplectic), which is conditionally stable for stiff springs at no extra cost. The time step is re-estimated every 20 steps from a Gershgorin bound including damping (see MATH.md), and a checkpoint/rollback guard handles runaways.
* **Quasi-static**: FIRE minimisation (`relaxFIRE`) used by experiments and "Relax".
* Outputs: fold angles per model edge, axial strain per bar, facet bending, energy breakdown, reaction forces on vertex groups.

### Relation to Origami Simulator
Amanda Ghassaei's Origami Simulator (MIT licence, © 2018 Amanda Ghassaei) was read to verify the force formulas, sign convention (valley positive), stiffness scaling (EA/L₀, k·L₀), damping (c = 2ζ√(k m), relative velocity), quad triangulation into F edges and strain colouring. **No code was copied**; the solver is a fresh TypeScript implementation. Deviations: CPU instead of GPU, adaptive damped stability bound instead of a fixed dt, FIRE for quasi-static experiments, prescribed-displacement boundary conditions, and checkpoint rollback.

## Experiments (`core/analysis/experiments.ts`, `workers/solver.worker.ts`)

Displacement-controlled sweeps: bottom ring fixed, top ring z prescribed (x,y free = twist free, or clamped / prescribed twist). At each step FIRE relaxes to equilibrium; recorded: energy breakdown, reaction (Σ F_z on the top plate), finite-difference dV/du, twist, max strain, positions. Runs in a Web Worker; the model is rebuilt from the generator registry.

## Collision (`core/solver/collision/collision.ts`)
Run after solves at reduced frequency (120 ms throttle) for models up to 4000 triangles.
