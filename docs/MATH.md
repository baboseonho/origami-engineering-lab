# Mathematics

## 1. Angle convention (used everywhere)

* **Sector angle θᵢ** — angle between consecutive crease rays in the unfolded (reference) pattern.
* **Fold angle ρ** — signed rotation about a crease.
  ρ = 0 flat · ρ > 0 **valley** · ρ < 0 **mountain** · |ρ| → 180° fully folded.

Edge orientation: crease `a→b` is traversed in that direction by its **left** face L (faces are CCW seen from the front side). With front normals n_L, n_R and ê = (b−a)/|b−a|:

  ρ = atan2((n_R × n_L)·ê, n_R·n_L)

Rotating L about +ê by +δ lifts it toward the front side and increases ρ by δ (valley). The sign does not depend on which face is called left (ê flips with it). The conventional interior dihedral angle φ (= π when flat, measured on the front side) converts as ρ = π − φ (`dihedralToFoldAngle`). This coincides with the FOLD spec (`edges_foldAngle`, valley positive) and with Origami Simulator. Tests: `src/tests/theorems.test.ts` (angle conventions), `energy.test.ts` (valley-positive hinge).

## 2. Flat single vertex

* **Kawasaki–Justin**: even n, Σθ = 2π, Σ_odd θᵢ = Σ_even θᵢ = π. Residual shown: Σ_odd − Σ_even.
  *Make flat-foldable*: rotate one ray of the selected sector by δ = −residual/2 (θₖ += δ, θₖ₊₁ −= δ), keeping Σθ = 2π.
* **Maekawa–Justin**: |M − V| = 2. Necessary, not sufficient.
* **Big–little–big / crimp** (Demaine & O'Rourke §12.2): if θᵢ is a strict local minimum, its two creases differ. Crimping a (non-strict) local-minimum sector with opposite creases removes both creases and merges (θᵢ₋₁, θᵢ, θᵢ₊₁) → θᵢ₋₁ − θᵢ + θᵢ₊₁, preserving Kawasaki and Maekawa. Valid iff the reduction reaches two collinear creases with equal assignment.

## 3. Non-flat vertex (Lecture 3)

A = Σ(−1)^{i+1} θᵢ must be 0 or ±2π: the folded image of ray k is φₖ = θ₁ − θ₂ + … ± θₖ, and the closed walk must return to the first ray, either directly (A = 0) or after one full turn (A = ±2π, only possible when Σθ > 2π). Generalized Maekawa (lecture): A = 0 ⇒ |M − V| = 2; A = ±2π ⇒ M = V. Tests: `theorems.test.ts` (0°, +360°, −360°, failing cone).

## 4. 1D folding (Lecture 2)

Strip with creases c₁ < … < cₙ, segments s₀ … sₙ.
End fold: s₀ ≤ s₁ (or sₙ ≤ sₙ₋₁). Crimp (cᵢ, cᵢ₊₁): opposite M/V and sᵢ₋₁ ≥ sᵢ ≤ sᵢ₊₁ (strip shortens by 2sᵢ).
Collision: same M/V and **strict** local minimum sᵢ₋₁ > sᵢ < sᵢ₊₁. Equal-distance (non-strict) same-direction pairs are flagged "degenerate", not forced collisions; the memoised DFS over operations decides. Theorem: Arkin et al., "When can you fold a map?" (2004).

## 5. Rigid kinematics (Lecture 3)

Facets are rigid; each M/V/U crease contributes one variable ρₑ (F creases are locked at their reference angle). A spanning tree of the face graph from a base facet gives every face a rigid transform

  T_child = T_parent ∘ Rot(p_a, s·d̂ₑ, ρₑ − ρ⁰ₑ),  s = +1 if the child is the left face,

with d̂ₑ, p_a, ρ⁰ₑ from the **reference configuration** (flat sheet: ρ⁰ = 0; the bag and cylinders use a 3D reference).

**Vertex closure** (Belcastro–Hull 2002, Tachi 2009): walking CCW around an interior vertex, Π R(sᵢd̂ᵢ, Δᵢ) = I (9 residual entries). With prefix products P, ∂Π/∂Δⱼ = [wⱼ]× Π, wⱼ = P_{j−1} sⱼ d̂ⱼ = current crease direction. Rank ≤ 3 per vertex ⇒ the lecture's 3M.

**Loop closure** (non-contractible cycles, e.g. open tubes): for each non-tree crease, T_R ∘ Rot(dₑ, Δₑ) − T_L = 0 (9 rotation + 3 translation entries) with analytic twist Jacobian ∂(T_X x)/∂ρⱼ = ωⱼ × (T_X x − aⱼ). Loops are added only when #non-tree edges > #interior vertices (disk: equal; closed sphere: one fewer; tube: one more).

**DoF**: lecture estimate DoF ≥ N − 3M; local truth DoF_local = N − rank J. Rank from one-sided Jacobi SVD with relative threshold 1e-7. Flat states are singular (all wⱼ coplanar ⇒ rank ≤ 2 per vertex).

**Degree-4 check** (Evans, Lang, Magleby, Howell 2015): for sectors α, β, π−α, π−β the two branches satisfy tan(ρ₂/2) = −cos((α+β)/2)/cos((α−β)/2)·tan(ρ₁/2) (ρ₃ = ρ₁, ρ₄ = −ρ₂) and the sin-ratio branch. Our solver reproduces both to 1e-8 (`rigid.test.ts`).

**Miura vertex (stepwise, Lecture 3)**: sectors α, π−α, π−α, α with c₁, c₃ collinear:
cos δ = cos²α − sin²α cos ρ₁ (law of cosines) → cos θ₁ = cos α / cos(δ/2) (projection/orthogonality) → γ = π − 2θ₁ (symmetry) → cos ρ₂ = −(cos γ + cos²α)/sin²α (law of cosines). Equivalent to tan(|ρ₁|/2) = cos α tan(|ρ₂|/2). Verified against the generic solver for α = 45°, 60°, 75°.

**Miura Poisson ratio** (Schenk & Guest, PNAS 2013): with W along the straight creases, L along the zig-zag and θ = |ρ_zigzag|/2, ν_LW = −d ln L / d ln W = −1/(cos²θ tan²α). The measured value from vertex positions of an 8×8 sheet agrees within 0.3 % (`models.test.ts`).

## 6. Energy method (Lecture 3)

Bar-and-hinge model (Schenk & Guest 2011; Liu & Paulino 2017; Ghassaei et al. 2018):

  V = Σ ½ (k_a/L₀)(l − L₀)² + Σ ½ k_c m L₀ (ρ − ρ_t)² + Σ ½ k_f L₀ (α − α₀)²

(k per unit hinge length; m = stiffness multiplier, e.g. the driven crease). Hinge gradient, h = wing distance to the hinge line, t = projection parameter of the wing along the hinge:

  ∂ρ/∂x_l = n_L/h_l,  ∂ρ/∂x_r = n_R/h_r,
  ∂ρ/∂x_a = −(1−t_l)∂ρ/∂x_l − (1−t_r)∂ρ/∂x_r,  ∂ρ/∂x_b = −t_l ∂ρ/∂x_l − t_r ∂ρ/∂x_r.

Identical to Origami Simulator's shader (confirmed by reading the source); verified against central finite differences (`energy.test.ts`). Angles are unwrapped against the previous value so ρ stays continuous through ±π.

Damping: per-bar relative-velocity damping c = 2ζ√(k m). Integration: semi-implicit Euler v ← v + dt F/m, x ← x + dt v.

**Stable time step** (re-estimated from the current geometry every 20 steps): Gershgorin bounds λ_K ≤ max_i Σⱼ|K_ij|/m_i (bars contribute 2k, hinges k_h|gᵢ|Σⱼ|gⱼ|) and λ_C likewise for damping; damped semi-implicit Euler is stable for ω dt < 2(√(1+β²) − β), β = γ/2ω. A 0.7 safety factor covers the geometric stiffness not included. A verified checkpoint and a runaway guard (strain > 300 % or extreme kinetic energy) roll back and halve dt.

**Quasi-static**: FIRE (Bitzek et al., PRL 2006) for experiments; reaction = Σ F_z on the top plate at equilibrium, cross-checked with dV_min/du by central differences.

## 7. Kresling (Lecture 5)

a = 2R sin(π/n), b² = H² + 2R²(1 − cos φ), c² = H² + 2R²(1 − cos(φ + 2π/n)). A second stress-free state with the same a, b, c: φ₁ = π − 2π/n − φ₀, H₁² = H₀² + 2R²(cos φ₁ − cos φ₀). Along any path in between, the triangles must strain: the "prescribed geometric path" plot keeps b fixed and reports the required strain of c (not a solver result). With rigid end polygons the closed polyhedron has DoF_local = 0. The energy experiment (twist free) produces the twist φ₁ − φ₀ at H₁ — verified within 20 % in `models.test.ts` (30.0° vs 30° predicted for n = 6, φ₀ = 45°, H = 1.2).

## 8. Curvature (Lecture 4)

Discrete Gaussian curvature by angle defect K_v ≈ 2π − Σ incident angles. The paper itself is developable (K = 0 at interior vertices); the app evaluates K on a **coarse surface** through the waterbomb base centres. Uniform folding gives K ≈ 0 (cylinder-like), radial grading with more folding toward the edges gives K > 0 (dome), the opposite gives K < 0 (saddle).

## 9. Collisions

Triangle–triangle intersection between non-adjacent triangles (pairs sharing a vertex are skipped), AABB sweep-and-prune broad phase, segment–triangle narrow phase in both directions. Coplanar contact (flat-folded layers) counts as touching, not penetrating; layer ordering is not checked.

## Sources

Kawasaki (1989); Justin (1986); Hull, *Origametry* (2020); Demaine & O'Rourke, *Geometric Folding Algorithms* (2007); Arkin et al., CGTA 29 (2004); Belcastro & Hull, Lin. Alg. Appl. 348 (2002); Tachi, Origami⁴ (2009); Evans et al., PLoS ONE 10 (2015); Schenk & Guest, PNAS 110 (2013); Liu & Paulino, Proc. R. Soc. A 473 (2017); Ghassaei, Demaine, Gershenfeld, 7OSME (2018); Balkcom, Demaine, Demaine, Ochsendorf, You, "Folding paper shopping bags" (2004/2006); Kidambi & Wang, arXiv:2003.10411; Bitzek et al., PRL 97 (2006); FOLD spec 1.2 (github.com/edemaine/fold).
