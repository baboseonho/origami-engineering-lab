# Lecture → feature → code → validation

| Lecture concept | Implemented feature (lesson id) | Main files | Validation |
|---|---|---|---|
| L1 origami as configuration ↔ function mapping; storage, deployable, metamaterial… | Concept Lab: 1-DoF Miura from deployed to stowed, footprint/thickness live (`l1-concept`) | `labs/ModelLabs.tsx` (ConceptLab), `analysis/metrics.ts` (sheetDims) | `models.test.ts` (Miura auxetic), e2e lesson load |
| L2 terminology; flat-foldable vs rigid-foldable | Square twist: flat state closes, rigid drive infeasible with reasons (`l2-terms`) | `generators/squareTwist.ts`, `RigidKinematicSolver.ts` (diagnose) | `models.test.ts` (square twist), e2e "Square twist" |
| L2 1D simple folds: end fold, crimp, collision, sequence theorem | 1D Simple Fold Lab with drag/toggle, highlights, auto-solve, stepping (`l2-strip`) | `constraints/strip1D.ts`, `labs/Strip1DLab.tsx` | `theorems.test.ts` (1D strip), e2e "1D strip" |
| L2 Kawasaki–Justin | Kawasaki Explorer: draggable rays, residual, make flat-foldable, break theorem (`l2-kawasaki`) | `constraints/kawasaki.ts`, `labs/VertexLabs.tsx` | `theorems.test.ts` ([90,90,90,90], [120,90,60,90], perturbed), e2e "Kawasaki" |
| L2 Maekawa–Justin, necessary vs sufficient | Maekawa Explorer (`l2-maekawa`) | `constraints/maekawa.ts`, `constraints/mvAssignment.ts` | `theorems.test.ts` (M=3,V=1 valid; M=2,V=2 invalid; Maekawa-but-invalid) |
| L2 M/V assignment, crimp theorem, recursive proof | Recursive crimp proof with animation (`l2-mv`) | `constraints/mvAssignment.ts` | `theorems.test.ts` (degree 4, 6) |
| L2 single vertex in 3D | Single Vertex Playground (`l2-single`) | `generators/singleVertex.ts` | `rigid.test.ts` (closed-form degree-4 relation) |
| L3 non-flat vertex: A ∈ {0, ±360°}, Σθ <, =, > 360° | Generalized lab with winding diagram (`l3-generalized`) | `constraints/generalizedFlatFold.ts` | `theorems.test.ts` (0°, +360°, −360°) |
| L3 generalized Maekawa | same lab | same | `theorems.test.ts` |
| L3 shopping bag theorem | Bag model, [Open]·[Flat] isolated states, test-every-crease, energy collapse experiment (`l3-bag`) | `generators/shoppingBag.ts`, `analysis/experiments.ts` | `models.test.ts` (local flat-foldability, flat closure, no rigid motion), e2e "Shopping bag" |
| L3 DoF ≥ N − 3M, rank, singular states, redundancy | DoF Explorer + DoF tab (singular values, warnings) (`l3-dof`) | `solver/rigid/jacobian.ts` | `rigid.test.ts` (degree-4 DoF = 1, flat singular, Miura N−3M = 0 but DoF 1) |
| L3 rigid constraint solver (closure, Jacobian, nonlinear solve) | General Constraint Solver lesson, locks, M/V enforcement (`l3-solver`) | `solver/rigid/*` | `rigid.test.ts` (residual < 1e-8, edge lengths, path independence) |
| L3 stepwise assembly (projection, symmetry, orthogonality, law of cosines) | Stepwise lab with live derivation vs solver (`l3-stepwise`) | `analysis/metrics.ts` (miuraStepwise), `labs/ModelLabs.tsx` | `rigid.test.ts` (α = 45°, 60°, 75°) |
| L3 energy method (V_axial, V_crease, V_facet, F = −∇V, damping) | Energy mode, presets rigid-like/paper-like/very flexible (`l3-energy`) | `solver/energy/*` | `energy.test.ts` (gradient FD check, energy decrease, FIRE convergence, rigid cross-validation) |
| L4 Miura: 1 DoF, dependent angles, W/H, auxetic, compact | Miura lesson: ρ1..ρ4, sweep plot, W/L/T, measured & analytic ν, auxetic arrows (`l4-miura`) | `generators/miura.ts`, `analysis/GeometryTab.tsx` | `rigid.test.ts` (Miura), `models.test.ts` (ν within 2 %), e2e "Miura" |
| L4 Miura analytic view (normals, cos ρ = n₁·n₂) | Theory → Derivation overlay (normals n1, n2, crease arrows) | `viewport/Viewport3D.tsx` (DerivationOverlay), `theory/TheoryPanel.tsx` | visual |
| L4 Waterbomb: auxetic, positive Gaussian curvature | Waterbomb tessellation, coarse angle defect, radial fold grading (`l4-waterbomb`); waterbomb base with symmetry links (`l4-wbbase`) | `generators/waterbomb.ts`, `analysis/metrics.ts` (angleDefects) | `models.test.ts` (vertex conditions) |
| L5 Ron Resch: auxetic, vertex conditions, valid vs invalid variant | Resch lesson with vertex statistics (`l5-resch`) | `generators/resch.ts` | `models.test.ts` (Kawasaki ✓ / Maekawa ✕, perturbed variant ✕) |
| L5 Box pleating framework | Box-pleat grid with tray / pleat / framework presets (`l5-boxpleat`) | `generators/boxpleat.ts` | validation test |
| L5 Kresling: twist, axial shortening, torsional buckling, not a free rigid mechanism | Rigid DoF 0, analytic compatibility (prescribed path), energy compression experiment with twist (`l5-kresling`) | `generators/kresling.ts`, `analysis/experiments.ts` | `models.test.ts` (DoF 0, compatibility strain, predicted twist), e2e "Kresling" |
| L5 Yoshimura: compressive buckling, energy-favourable mode | Compression experiment with energy & reaction plots (`l5-yoshimura`) | `generators/yoshimura.ts`, `analysis/experiments.ts` | manual / screenshot (buckling at u ≈ 0.3) |
| L5 Kresling vs Yoshimura | Side-by-side synchronized loading lab (`l5-compare`) | `labs/ModelLabs.tsx` | e2e lesson load |
| FOLD format | Settings → import/export | `core/fold/*` | `models.test.ts` (round trip for 4 models) |
| Angle convention ρ | Legend, theory panel, `signedFoldAngle`, `dihedralToFoldAngle` | `geometry/angles.ts` | `theorems.test.ts` (angle conventions) |
