# Generalized Kawasaki Lab — ±360° and winding

An experiment environment for one question in Origami Engineering (Part 3, rigid folding):

> For a single vertex with an even number of creases, flat-foldability requires
> S = θ1 − θ2 + θ3 − θ4 + … − θn ∈ {0°, +360°, −360°}.
> What does S = ±360° *mean*?

**Key takeaway:**

> Σθ describes the intrinsic angular curvature around the vertex,
> whereas the alternating sum S describes the signed angular closure
> of the flat-folded path. They are different quantities.

## Where to run it

| | How | What you get |
|---|---|---|
| Web lab (interactive) | Site → Part 3 → **일반화 Kawasaki 실험실: ±360°와 감김** (`#l3-gkawasaki`), or `npm run dev` → `http://localhost:5173/#l3-gkawasaki` | split view (3D vertex · sector diagram · angular walk), cases A–E, live angle sliders, step-by-step walk animation |
| Blender (renders) | `blender -b -P scripts/generalized_kawasaki.py -- --all` | validation table + `renders/case_*.png` |
| | `blender -b -P scripts/generalized_kawasaki.py -- --theta 120,40,100,60,90,50` | a render of any vertex (`renders/custom.png`) |
| | `blender -P scripts/generalized_kawasaki.py -- --case C --no-render` | opens the scene for orbiting in Blender |
| Tests | `npm test` (`src/tests/vertexWinding.test.ts`) | 26 checks of all values below |

**Why both:** the browser is the right tool for what this question needs — dragging an angle and
seeing Σθ, S, the winding and the 3D shape update at once, and playing the walk step by step.
Blender is used for clean static renders of the five cases. Both use the same mathematics
(`src/core/analysis/vertexWinding.ts`, mirrored in the Python script).

## 1. Σθ — how much paper surrounds the vertex

T = Σθi is the total of the sector angles: the amount of paper you meet walking once around the vertex.
Ordinary flat paper has exactly 360° around every point. T is **intrinsic**: folding cannot change it.

## 2. Angular deficit and surplus

δ = 360° − T is the angular defect (the Gaussian curvature concentrated at the vertex).

| T | δ | intrinsic shape |
|---|---|---|
| = 360° | 0 | flat paper (Euclidean) |
| < 360° | > 0 | deficit → cone |
| > 360° | < 0 | surplus → saddle (the paper must ripple up and down) |

The sector diagram (centre panel) lays the sectors edge to edge with their true angles; whatever
passes 360° overlaps (surplus, red arc) or falls short (deficit, blue arc).

## 3. The alternating sum S

Fold the vertex flat. Every crease is folded by ±180°, so consecutive sectors are laid on the plane
with **alternating orientation**: sector 1 turns the direction by +θ1, sector 2 turns it back by −θ2,
and so on. The direction of ray k in the flat-folded state is therefore

  φ0 = 0, φk = φ(k−1) + (−1)^(k+1) θk, so φ1 = θ1, φ2 = θ1 − θ2, …, φn = S.

S = O − E with O = θ1 + θ3 + … (odd sectors, teal) and E = θ2 + θ4 + … (even sectors, amber).
The last sector must end on the first ray, so S must be a multiple of 360°.

## 4. S = 0 versus S = ±360°

Both bring the last ray back onto the first **direction**. The difference is the **path**:

* S = 0°: the walk goes out and comes back without going around the vertex.
* S = +360°: the walk goes once around the vertex counter-clockwise and arrives at the same direction.
* S = −360°: the same, clockwise.

The angular walk (right panel) draws φk as a spiral so the history stays visible; Play animates it
one step at a time (+θ1, −θ2, …).

## 5. Winding number

The winding number is S / 360°: how many times the flat-folded path turns around the vertex (0, +1 or −1).
In Case C the sequence is 0° → 130° → 120° → 250° → 240° → 370° → 360°: it ends where it started,
but one full turn later. The flat-folded paper wraps once around its own vertex (like a spiral staircase).

## 6. A saddle does not automatically give ±360°

T and S answer different questions. T > 360° says the paper cannot lie flat *unfolded*;
S says how the *folded* path closes. Case B (T = 420°, S = 0°) and Case E (T = 420°, S = 180°)
are both saddles: B is flat-foldable without winding, E is not flat-foldable at all.

## 7. The predefined cases

| case | θ (°) | T | O | E | S | winding | generalized Kawasaki |
|---|---|---|---|---|---|---|---|
| A | 90, 90, 90, 90 | 360 | 180 | 180 | 0 | 0 | PASS (ordinary Kawasaki) |
| B | 100, 70, 60, 80, 50, 60 | 420 | 210 | 210 | 0 | 0 | PASS — a saddle with S = 0 |
| C | 130, 10, 130, 10, 130, 10 | 420 | 390 | 30 | +360 | +1 | PASS |
| D | 10, 130, 10, 130, 10, 130 | 420 | 30 | 390 | −360 | −1 | PASS |
| E | 100, 40, 100, 40, 100, 40 | 420 | 300 | 120 | +180 | — | FAIL — a saddle that does not close |

These values are checked automatically (Vitest and the Blender script's validation table);
indexing is 1-based (θ1 is odd), angles are degrees throughout, positive turns are counter-clockwise.

### A finding: Cases C and D cannot open into a 3D shape

A vertex made of rigid triangular panels is a closed spherical polygon with side lengths θi. It can
close in 3D only if, for every subset I of sectors with an odd number of elements,

  Σ(i∈I) θi − Σ(i∉I) θi ≤ (|I| − 1)·180°  (Kapovich–Millson),

and when equality holds it closes **only on one great circle** — i.e. flat.

For six creases, take I = {θ1, θ3, θ5}: this gives **S ≤ 360°**. So S = +360° is the largest value S can have,
and at that value the six rigid panels are flat-locked: the only closed configuration is the flat-folded,
once-wound state. Case C (390 − 30 = 360 = 2·180) and Case D (with I = {θ2, θ4, θ6}) sit exactly there.
The lab therefore does **not** draw an invented 3D saddle for them. It says so, and lets you open a
*nearby* vertex (the tight sectors reduced by ε, labelled with its own angles): as ε → 0 the saddle flattens
into the winding. Winding once does not forbid 3D shapes in general: a 12-crease vertex with S = +360°
(odd sectors 100, 100, 100, 100, 10, 10) opens normally (tested).

## 8. Simulation versus mathematical visualization

| view | status |
|---|---|
| 3D vertex | **exact geometry**: unit crease vectors with ri·ri+1 = cos θi solved by minimum-norm Gauss–Newton (residual shown, ~1e-15). Shapes are moved along the exact constraint set to be as clearly non-flat as possible, rejecting steps that make panels pass through each other. |
| sector diagram | exact angles; a drawing of the intrinsic total, not a physical state |
| angular walk | exact flat-folded ray directions φk |
| flat-fold angular map | the exact flat-folded configuration (each panel keeps θi, orientation alternates), layers drawn apart for visibility. *Angular closure visualization. This view illustrates the generalized Kawasaki winding condition; it does not independently verify global layer ordering or collision.* |
| folding motion | **not provided.** A path from the 3D shape to the flat state was attempted (interpolation projected onto the constraints, then constrained descent toward the flat state); it did not give a continuous path reliably, so no folding animation is shown rather than a fake one. |
