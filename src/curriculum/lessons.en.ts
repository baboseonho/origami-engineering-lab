import type { LessonText } from './lessons';

/** English text of every lesson, keyed by lesson id (see LessonText). */
export const LESSONS_EN: Record<string, LessonText> = {
  // ───────────────────────────── Part 1
  'l1-concept': {
    title: 'Concept lab: shape → function',
    content: {
      concept: 'Origami engineering studies the mapping between the shape (configuration) of a folded structure and its mechanical behavior: footprint, stiffness, motion and load paths. Folding is not decoration. It is a design variable.',
      observe: 'A single Miura-ori sheet, driven by one fold angle, moves continuously from the flat sheet (as made), through intermediate states, to a compact stowed state. The facets (the flat panels between creases) never stretch, yet the footprint and the thickness change several times over.',
      experiment: 'Drag the shape slider from "Deployed" to "Stowed". Watch the footprint ratio and the residual of the rigid solver. The residual stays near 1e-12: every frame is an exact rigid configuration, not an animation.',
      meaning: 'Compact stowage, deployable structures (solar arrays, membranes), morphing mechanisms and metamaterials all use the same idea: a low-dimensional configuration space (here, one degree of freedom, DoF 1) controls a large change in geometry.',
    },
    challenges: {
      c1: { text: 'Find the drive angle at which the footprint is halved.', hint: 'Read areaRatio in the stats panel.' },
      c2: { text: 'Explain why a single slider can describe the whole motion.', answer: 'The Miura-ori is a rigid mechanism with 1 DoF: one generalized coordinate sets every fold angle (Parts 3–4).' },
    },
    links: ['Terminology (Part 2)', 'Miura-ori (Part 4)'],
  },
  // ───────────────────────────── Part 2
  'l2-terms': {
    title: 'Terminology & flat ≠ rigid',
    content: {
      concept: 'Facet = a rigid panel. Crease = a hinge (a fold line). A mountain fold (M, $\\rho<0$, red) folds away from the viewer; a valley fold (V, $\\rho>0$, blue) folds toward the viewer. An M/V assignment is a labeling of the creases. Flat-foldable: there is a folded state in which every $\\rho = \\pm 180^\\circ$ and the paper does not pass through itself. Rigid-foldable: there is a CONTINUOUS motion from the flat sheet during which every facet stays rigid. A tessellation is a periodic crease pattern; kirigami also allows cuts.',
      observe: 'The square twist folds flat: the "Flat-folded state" closes with a residual of about 1e-15, and every vertex passes the Kawasaki–Justin theorem and the crimp test. Yet with the given M/V assignment, driving any crease from the flat sheet is infeasible.',
      experiment: 'Select a crease and set $\\rho = +20^\\circ$. Read why it is infeasible. Then use "Show flat-folded state" to compare. Switch to Energy mode and drive it again: now the facets have no choice but to bend.',
      meaning: 'Flat-foldability is a statement about the two end states. Rigid-foldability is a statement about the PATH between them. The two properties are logically independent.',
      question: 'When you drive a crease, which property does the solver actually check?',
      answer: 'Not flat-foldability. It checks whether a rigid motion exists along a continuous path (continuation).',
    },
    challenges: {
      c1: { text: 'Turn off "Respect M/V" and drive again. What changes, and why?', answer: 'With a different M/V assignment, a rigid motion exists. The given assignment is what blocks it.' },
    },
    links: ['1D simple folding', 'Kawasaki explorer'],
  },
  'l2-strip': {
    title: '1D simple folding lab',
    content: {
      concept: 'A 1D crease pattern (a strip with M/V points) is flat-foldable if and only if (iff) it can be folded by a sequence of END FOLDs and CRIMPs (Arkin et al. 2004). An end fold folds the last segment over at its crease. A crimp folds two neighboring creases of opposite direction together, like a Z.',
      observe: 'The operations you can apply are highlighted. Two adjacent creases on either side of a strictly shorter segment that fold in the same direction are marked as a COLLISION. Such a pattern can never fold flat.',
      experiment: 'Click a crease to toggle M/V, drag creases along the strip to move them, then press "Auto-solve" to step through the folding order.',
      meaning: 'Each local operation keeps the strip foldable while shrinking the problem by one or two creases. That is why a greedy algorithm (apply any available move, never look back) is enough in 1D.',
    },
    challenges: {
      c1: { text: 'Make a pattern with a collision, then resolve it by changing a single assignment.' },
      c2: { text: 'Find a flat-foldable pattern on which no end fold can be applied at first.', hint: 'Make each end segment longer than its neighbor.' },
    },
  },
  'l2-kawasaki': {
    title: 'Kawasaki explorer',
    content: {
      concept: 'A flat single vertex of even degree (an even number of creases) folds flat if and only if $\\sum_{\\text{odd}} \\theta_i = \\sum_{\\text{even}} \\theta_i = 180^\\circ$ (Kawasaki–Justin theorem). The $\\theta_i$ are the sector angles: the angles between neighboring creases.',
      observe: 'Drag a crease ray and the residual $\\sum_{\\text{odd}} - \\sum_{\\text{even}}$ updates. Green means $\\approx 0$.',
      experiment: 'Drag the rays. Press "Make flat-foldable" to move one ray by the smallest amount, and load "Break the theorem" to perturb the vertex.',
      meaning: 'The Kawasaki condition is about the SECTOR ANGLES $\\theta$ alone (geometry). It does not depend on M/V.',
    },
    challenges: {
      c1: { text: 'Change one sector angle until flat-foldability breaks, then restore it by moving only one ray.' },
      c2: { text: 'Why is a vertex of odd degree never flat-foldable?', answer: 'The layers must alternate direction, and that takes an even number of creases. This also follows from the Maekawa–Justin theorem.' },
    },
    links: ['Maekawa explorer'],
  },
  'l2-maekawa': {
    title: 'Maekawa–Justin explorer',
    content: {
      concept: 'At a flat-folded vertex, $|M - V| = 2$ (Maekawa–Justin theorem): the numbers of mountain and valley creases differ by exactly two. The condition is necessary, but not sufficient.',
      observe: 'Click a crease to toggle M/V. The count condition and the full validity check (the crimp / big–little–big lemma: if a sector is strictly smaller than both its neighbors, its two creases must have opposite M/V) are shown separately.',
      experiment: 'Find an assignment that has $|M - V| = 2$ but is still INVALID.',
      meaning: 'Counting cannot tell which creases border a small sector. The crimp test can.',
    },
    challenges: {
      c1: { text: 'Find an M/V assignment with $|M - V| = 2$.' },
      c2: { text: 'Find an assignment with $|M - V| = 2$ that violates the big–little–big lemma.' },
    },
  },
  'l2-mv': {
    title: 'M/V assignment: the recursive crimp proof',
    content: {
      concept: 'For a vertex that satisfies the Kawasaki condition: pick a (non-strict) local minimum sector. If it is a strict minimum, its two creases must differ (one M, one V). Remove that pair with a crimp, and repeat until two collinear creases are left.',
      observe: 'Each step removes two creases and merges three sectors into one: $\\theta_{i-1} - \\theta_i + \\theta_{i+1}$.',
      experiment: 'Open "Show the recursive proof" and step through it. Then change one assignment and see at which step the proof fails.',
      meaning: 'A constructive way to decide a single vertex: reduce, then check the base case.',
    },
    challenges: {
      c1: { text: 'For the sectors 60,40,70,80,50,60, find a valid assignment and confirm that it reduces in two crimps.' },
    },
  },
  'l2-single': {
    title: 'Single-vertex playground (3D)',
    presets: [
      { label: 'General degree-4 vertex (70,100,110,80)' },
      { label: 'Miura vertex $\\alpha=60^\\circ$' },
      { label: 'Symmetric 80/100 (collinear pair)', note: 'Flat-foldable, but this assignment does not lie on a rigid branch' },
      { label: 'Degree-6 vertex (60,40,70,80,50,60)' },
    ],
    content: {
      concept: 'A flat-foldable degree-4 vertex is a spherical linkage with one degree of freedom (DoF): $N - 3M = 4 - 3 = 1$ ($N$ creases, $M$ interior vertices).',
      observe: 'Drive the fold angle $\\rho_1$: then $\\rho_3 = \\rho_1$ and $\\rho_4 = -\\rho_2$, and $\\tan(\\rho_2/2)/\\tan(\\rho_1/2)$ stays constant throughout the motion.',
      experiment: 'Drive $\\rho_1$ up to $120^\\circ$. Then lock $\\rho_1$ and try to drive $\\rho_2$ on its own.',
      meaning: 'The fold angles at a vertex are coupled by the closure condition $\\prod R(\\rho_i) = I$: going once around the vertex, the rotations must bring you back to where you started.',
    },
    challenges: {
      c1: { text: 'Lock $\\rho_1$ and drive $\\rho_2$. Explain the result.', answer: 'With $\\rho_1$ fixed, the linkage has zero DoF left, so the drive is infeasible.' },
    },
  },
  // ───────────────────────────── Part 3
  'l3-generalized': {
    title: 'Non-flat vertices: the generalized condition',
    content: {
      concept: 'A vertex with $\\sum\\theta \\ne 360^\\circ$ (a cone or a saddle) can fold flat only if the alternating sum $A = \\sum (-1)^{i+1} \\theta_i \\in \\{0^\\circ, \\pm 360^\\circ\\}$.',
      observe: 'The winding diagram shows where each ray lands in the folded state. The path must close; $A = \\pm 360^\\circ$ means it winds once around.',
      experiment: 'Load the three presets ($\\sum\\theta = 360^\\circ$, $< 360^\\circ$, $> 360^\\circ$) and adjust the sectors.',
      meaning: 'Generalized Maekawa theorem: $A = 0 \\Rightarrow |M - V| = 2$; $A = \\pm 360^\\circ \\Rightarrow M = V$.',
    },
    challenges: {
      c1: { text: 'Build a vertex with $\\sum\\theta > 360^\\circ$ and $A = +360^\\circ$, and give a valid M/V count.' },
    },
  },
  'l3-gkawasaki': {
    title: 'Generalized Kawasaki lab: ±360° and winding',
    content: {
      concept: 'Keep two quantities apart. $T = \\sum\\theta_i$ is the amount of paper around the vertex (its intrinsic curvature). $S = \\theta_1 - \\theta_2 + \\theta_3 - \\dots$ adds up the directions the rays take when the vertex is folded flat: it is the signed closure of the folded path. The generalized Kawasaki condition is $S \\in \\{0^\\circ, \\pm 360^\\circ\\}$.',
      observe: 'In Case C ($130^\\circ$ and $10^\\circ$ alternating), play the angle steps: $0 \\to 130 \\to 120 \\to 250 \\to 240 \\to 370 \\to 360$. The final direction equals the starting one, but the path goes once counterclockwise around the vertex (winding number $+1$). Case B is a saddle with $T = 420^\\circ$, yet $S = 0$. Case E is also a saddle, but $S = 180^\\circ$, so it fails.',
      experiment: 'Change the sector angles and watch $T$ and $S$ move independently. Rotate the vertex in the 3D view and compare the angle map with the rigid folding path. In Case C, shrink the $\\varepsilon$ of "Open a nearby vertex" down to 0.',
      meaning: 'A saddle ($T > 360^\\circ$) does not by itself give $S = \\pm 360^\\circ$. $S = \\pm 360^\\circ$ means the folded paper wraps once around the vertex. For a six-sector vertex this is the largest possible $S$, so the rigid panels cannot open into 3D: the vertex exists only as a flat, wrapped state (the equality case of the closure condition).',
      question: '$S = 0^\\circ$ and $S = 360^\\circ$ end in the same direction. What is different?',
      answer: 'The final direction is the same, but the path is not. With $S = 0$ the path turns back; with $S = 360^\\circ$ it goes once around the vertex (winding number 1). So the flat-folded paper wraps once around the vertex.',
    },
    challenges: {
      c1: { text: 'Make a 6-crease vertex with $T = 480^\\circ$ and $S = 0$.', hint: 'Make the odd sum and the even sum both $240^\\circ$.' },
      c2: { text: 'Make a 12-crease vertex with $S = +360^\\circ$, and check in the 3D view that it is not locked flat.', answer: 'For example: $100, 10$ four times, then $10$ four times. With six odd sectors the closure limit is a roomy $(6-1)\\cdot 180^\\circ$, so the vertex opens into 3D.' },
    },
    links: ['Non-flat vertices: the generalized condition (Maekawa)'],
  },
  'l3-bag': {
    title: 'The shopping bag theorem',
    verdictNote: 'Theorem: an open shopping bag cannot be folded rigidly. The first-order mobility above is only a tiny wobble; it does not extend to a motion that folds all the way. The bag goes flat only when the paper bends (Energy).',
    content: {
      concept: 'Balkcom–Demaine–Demaine: a TALL paper shopping bag ($H > D/2$) with the traditional creases cannot be folded rigidly. The open state and the flat state are isolated points of the rigid configuration space (the set of all shapes reachable with rigid facets).',
      observe: 'Flat-foldable: YES (every vertex is locally flat-foldable, and the flat state closes exactly). Rigid folding path: NO. Even with M/V ignored, driving any crease from the open state fails.',
      experiment: '1) Drive any gusset crease (the creases on the side panels that tuck in). 2) Show both states. 3) On the right, use the fold-progress slider of "Fold the shopping bag" (or "Fold flat") to fold every crease together: as the bag goes flat, the numbers show that the facets must strain and bend. "Fold flat" in the Energy tab records the same path as a graph.',
      meaning: 'The first-order (linearized) DoF can be nonzero, yet no finite motion exists: the open shopping bag allows an infinitesimal motion but is rigid. A real paper bag folds only because the paper bends.',
    },
    challenges: {
      c1: { text: 'Set $H < D/2$ (a short bag). Does the theorem still apply?', answer: 'No. A short bag can be folded flat rigidly (Theorem 2 of the paper). In that case the model needs the diagonals not to meet (when $H \\le D/2$, $S$ coincides with the top face), so the generator is valid only for tall bags.' },
    },
  },
  'l3-dof': {
    title: 'DoF explorer: N − 3M vs rank J',
    presets: [
      { label: 'Degree-4 vertex: $N - 3M = 1$, full rank' },
      { label: 'Degree-6 vertex: $N - 3M = 3$' },
      { label: 'Kresling with end plates: closed, DoF 0' },
      { label: 'Miura 3×3: $N - 3M = 0$ but $\\text{DoF} = 1$' },
      { label: 'Miura 4×4: $N - 3M < 0$' },
      { label: 'Miura 3×4 panels ($M = 6$)' },
    ],
    content: {
      concept: 'The common estimate is $\\text{DoF} \\ge N - 3M$ ($N$: number of creases, $M$: number of interior vertices, 3 rotation constraints per vertex). Equality holds if and only if the $3M$ constraints are independent (the Jacobian $J$ has full row rank). Locally, the true value is $\\text{DoF} = N - \\operatorname{rank} J$.',
      observe: 'For the Miura-ori, $N - 3M$ is zero or negative, yet the mechanism moves: the vertex constraints are redundant ($\\operatorname{rank} J < 3M$). In the flat state every crease axis lies in one plane, and the rank drops further. This is a singular configuration.',
      experiment: 'Compare $N - 3M$, $\\operatorname{rank} J$ and $\\text{DoF}_{\\text{local}}$ at $\\rho = 0^\\circ$ and at $\\rho = 60^\\circ$. Look at the singular-value plot.',
      meaning: 'A negative $N - 3M$ means redundancy, not negative mobility. With symmetric or special geometry, the estimate breaks down.',
    },
    challenges: {
      c1: { text: 'Find a configuration where simple counting is misleading.', answer: 'Any Miura-ori ($N - 3M \\le 0$, $\\text{DoF} = 1$), or any flat state (the rank drops).' },
    },
  },
  'l3-stepwise': {
    title: 'Stepwise kinematics (Miura vertex)',
    content: {
      concept: 'A geometry-specific analysis: fix a reference facet, attach the neighboring facets one by one, and derive the dependent fold angles from projection, symmetry, orthogonality and the spherical law of cosines.',
      observe: 'The live derivation agrees with the general numerical solver to within ~1e-10.',
      experiment: 'Change $\\rho_1$ and $\\alpha$, follow each step, and compare it with the solver column.',
      meaning: 'Closed-form solutions exist only for special geometry (here, the symmetric Miura vertex). The general solver handles every other case.',
    },
    challenges: {
      c1: { text: 'Show that $\\tan(|\\rho_1|/2) = \\cos\\alpha \\cdot \\tan(|\\rho_2|/2)$ holds for every $\\rho_1$.' },
    },
  },
  'l3-solver': {
    title: 'General constraint solver',
    content: {
      concept: '$q$ = fold angles; $C(q)$ = closure residual; $J = \\partial C/\\partial q$ (the Jacobian). The driving crease fixes one coordinate. The rest are found by solving $\\min \\|C(q)\\|^2$ with Levenberg–Marquardt, and continuation tracks the branch from one step to the next.',
      observe: 'The degree-6 vertex has $N - 3M = 3$: after one drive, 2 DoF remain, so the solver picks the smallest change. Lock creases to remove DoF.',
      experiment: 'Drive $\\rho_1$. Then lock $\\rho_2$ and $\\rho_3$ and drive again: the motion becomes unique. Lock one more and it becomes infeasible.',
      meaning: 'In an $n$-DoF mechanism, prescribing $k$ angles leaves $n - k$ DoF. Over-prescribing is not "solved approximately". It is infeasible.',
    },
    challenges: {
      c1: { text: 'Lock creases until the drive becomes infeasible. How many did you have to lock?', answer: 'With $N - 3M = 3$: drive + 2 locks = 3 prescribed ⇒ unique; a third lock ⇒ over-constrained.' },
    },
  },
  'l3-energy': {
    title: 'The energy method',
    content: {
      concept: 'The bar-and-hinge model treats the sheet as bars that resist stretching, joined by hinges that resist folding (at creases) and bending (across facets): $V = \\sum \\tfrac12 k_{\\text{axial}}/L_0\\,(l - L_0)^2 + \\sum \\tfrac12 k_{\\text{crease}} L_0 (\\rho - \\rho_t)^2 + \\sum \\tfrac12 k_{\\text{facet}} L_0 (\\alpha - \\alpha_0)^2$, $F = -\\nabla V$. Damped dynamics relax it to a minimum.',
      observe: 'In Energy mode, driving the square twist succeeds, but the facets bend (along the diagonal hinges) and the bars strain. The stiffness ratio $k_{\\text{facet}}/k_{\\text{crease}}$ decides how "rigid" the result looks.',
      experiment: 'Press "Run dynamics" and drive a crease. Then switch the preset from "Near-rigid" → "Paper" → "Very flexible" and compare the strain and the facet bending.',
      meaning: 'The energy method answers "which deformation costs the least?", not "is it kinematically possible?". With "Near-rigid" stiffness, an infeasible rigid motion shows up as a large energy.',
    },
    challenges: {
      c1: { text: 'Increase $k_{\\text{facet}}$ tenfold. How does the maximum facet bending change?' },
    },
  },
  // ───────────────────────────── Part 4
  'l4-miura': {
    title: 'Miura-ori',
    presets: [
      { label: '2×2' },
      { label: '3×3' },
      { label: '3×4 (interior vertices $M = 6$)' },
      { label: '6×6' },
    ],
    content: {
      concept: 'The Miura-ori behaves as a 1-DoF auxetic mechanism: one fold angle sets the whole shape, and the sheet contracts in BOTH in-plane directions at once (a negative Poisson ratio).',
      observe: 'On the zigzag creases $\\rho_2 = \\rho_4$; on the straight creases $\\rho_3 = -\\rho_1$. As $\\rho_1$ grows, $W$ and $L$ both decrease.',
      experiment: 'Move $\\rho_1$ from $0^\\circ$ to $100^\\circ$. Then lock $\\rho_1$, select $\\rho_2$ and try to change it.',
      meaning: 'One generalized coordinate parameterizes the rigid folding motion. The auxetic behavior is a geometric consequence, and here it is measured from the actual vertex positions.',
      question: 'Can $\\rho_2$ move independently without breaking compatibility?',
      answer: 'No. Once $\\rho_1$ is locked, the mechanism has no DoF left.',
    },
    challenges: {
      c1: { text: 'Confirm that one crease determines all the others (drive any crease and watch the rest).' },
      c2: { text: 'Compare the measured Poisson ratio with $-\\cos^2\\theta \\tan^2\\alpha$.' },
    },
  },
  'l4-waterbomb': {
    title: 'Waterbomb tessellation',
    content: {
      concept: 'The waterbomb tessellation is auxetic and can form domes and spheres. The paper itself stays developable (it could be unfolded flat without stretching), but the EFFECTIVE surface gains positive Gaussian curvature.',
      observe: 'On the paper, the angle defect stays $\\approx 0$ (developable). On the coarse surface through the centers of the bases, $K = 2\\pi - \\sum \\text{angles}$ depends on HOW you fold the pattern. Fold it uniformly and it rolls into nearly a cylinder ($K \\approx 0$). Fold the outer bases more than the center (radial grading $g > 0$) and it becomes a dome ($K > 0$). With $g < 0$ it becomes a saddle ($K < 0$).',
      experiment: 'Energy tab → run "Fold all" with radial grading $g$. Start at $g = 1.2$ (dome), then set $g = 0$ and $g = -1$. After each relaxation, read the coarse $K$ in the Geometry tab.',
      meaning: 'Positive angle defect ⇒ locally dome-shaped (synclastic). This is a DISCRETE curvature estimate of the coarse-grained surface, not of the paper.',
    },
    challenges: {
      c1: { text: 'Compare the coarse angle defect at the center with the values near the boundary.' },
    },
  },
  'l4-wbbase': {
    title: 'Waterbomb base (degree 8)',
    content: {
      concept: 'A degree-8 vertex has $N - 3M = 5$ DoF. Imposing four-fold symmetry (all diagonals equal, all midlines equal) reduces this to a 1-DoF motion.',
      observe: 'With "Symmetry links" on, driving one diagonal moves all eight creases consistently.',
      experiment: 'Turn "Symmetry links" off and drive again: the solver picks the least-change motion of the 5-DoF linkage.',
      meaning: '4M/4V violates the Maekawa theorem, so this is a 3D (bistable) state, not a flat fold.',
    },
    challenges: {
      c1: { text: 'Why does the solver need extra constraints to make the motion unique?' },
    },
  },
  // ───────────────────────────── Part 5
  'l5-resch': {
    title: 'Ron Resch pattern',
    content: {
      concept: 'The Resch tessellation is made of downward-facing surface triangles and three-armed, star-shaped tucks (pockets of paper folded under the surface). It is auxetic, and it folds into a sandwich surface that looks smooth.',
      observe: 'Click a tuck center or a grid vertex: at both, the Kawasaki condition holds but the Maekawa condition fails (3M/3V and 5M/1V) ⇒ not flat-foldable, yet rigid-foldable with many DoF.',
      experiment: 'Compare the valid variant with the "perturbed" variant (tuck centers displaced): the perturbed variant does not satisfy the Kawasaki condition.',
      meaning: 'Checking flat-foldability is a local, vertex-by-vertex test. A pattern can be fully rigid-foldable and still not be flat-foldable.',
    },
    challenges: {
      c1: { text: 'Find $N$, $M$ and $N - 3M$ for the 3×2 patch, and compare them with $\\text{DoF}_{\\text{local}}$.' },
    },
  },
  'l5-boxpleat': {
    title: 'Box pleating',
    presets: [
      { label: 'Tray' },
      { label: 'Pleat' },
      { label: 'Bare framework' },
    ],
    content: {
      concept: 'A fixed grid of $0^\\circ/45^\\circ/90^\\circ$ lines is the FRAMEWORK. A design is a subset of those lines plus an M/V assignment. One framework can realize a wide family of target shapes.',
      observe: 'Switching presets changes only which lines fold. The grid stays the same.',
      experiment: 'Fold the tray (Play in Energy mode), then switch to Pleat. In the Inspector, toggle individual grid lines between F (flat, unfolded), M and V.',
      meaning: 'Box pleating is a design methodology (Lang). Optimizing for arbitrary shapes is not covered here.',
    },
    challenges: {
      c1: { text: 'Change one F line of the tray to M and watch how the shape changes.' },
    },
  },
  'l5-kresling': {
    title: 'Kresling cylinder',
    content: {
      concept: 'A Kresling cylinder is a stack of twisted polygonal rings joined by triangles. Under axial load it shortens AND twists (twist buckling). If the rings are taken as flat and rigid, it is not a rigid mechanism: moving between states requires the panels to deform.',
      observe: 'Rigid mode: with end polygons, $\\text{DoF}_{\\text{local}} = 0$, so every drive is infeasible. The analytic compatibility plot shows the strain needed to keep every triangle edge at its length. Energy mode: energy minimization reveals a path that twists as it compresses, and a second energy well sits where the second stable state is predicted.',
      experiment: '1) Drive a crease in Rigid mode. 2) Run the axial compression test (twist free). 3) Compare $\\operatorname{twist}(u)$ with the predicted $\\varphi_1 - \\varphi_0$.',
      meaning: 'An ideal Kresling is a bistable structure (it has two stable states), not a free rigid mechanism. A physically plausible motion = a low-strain path through the energy landscape.',
    },
    challenges: {
      c1: { text: 'Turn off "Rigid end polygons". How does $\\text{DoF}_{\\text{local}}$ change, and why?', answer: 'The tube becomes a floppy triangulated band: what locked it was the coplanarity / rigid-ring constraint.' },
    },
  },
  'l5-yoshimura': {
    title: 'Yoshimura buckling',
    presets: [
      { label: 'Smooth cylinder (uniform bending)' },
      { label: 'Pre-creased Yoshimura' },
    ],
    content: {
      concept: 'A thin cylinder under axial compression buckles into a diamond (Yoshimura) pattern: once uniform compression costs more energy than bending, the system follows a lower-energy mode of deformation.',
      observe: 'Before buckling, the axial energy grows as $\\sim u^2$. At the onset of buckling, the axial energy drops, the bending energy shoots up, and the reaction force drops (a snap).',
      experiment: 'Run the compression test and sweep along $u$. Find the onset in the reaction-force plot.',
      meaning: 'The shape you see is the energetically favorable mode. Caution: the mesh is aligned with the Yoshimura grid, so the mode shape is influenced by the discretization. The physical point is the competition between energies.',
    },
    challenges: {
      c1: { text: 'Increase the compression and find the buckling onset ($u$ and the reaction force).' },
    },
  },
  'l5-compare': {
    title: 'Kresling vs Yoshimura',
    content: {
      concept: 'Kresling: twist buckling (compression is coupled to twist). Yoshimura: compression buckling (no coupling to twist).',
      observe: 'Let the top plate rotate freely and apply the same compression to both structures: only the Kresling rotates.',
      experiment: 'Use the shared compression and twist sliders to compare the energy and the induced twist.',
      meaning: 'The chirality (handedness) of the crease pattern decides which loading mode is soft.',
    },
    challenges: {
      c1: { text: 'Prescribe a twist in the wrong direction on the Kresling. What happens to the energy?' },
    },
  },
  // ───────────────────────────── new sheets (parts 0 and 7)
  'l0-welcome': { title: 'Welcome to Origami Engineering', content: { concept: 'Learn how paper moves along its creases by moving it yourself. Start with how to read the screen and a learning path that fits your goal.' } },
  'l0-atlas': { title: 'Choose a structure', content: { concept: 'Pick a structure by field of interest or by name and open it. Each one leads on to how it folds, where it is used and the theory behind it.' } },
  'l0-pleat': {
    title: 'Reading a crease pattern: the accordion pleat',
    content: {
      concept: 'The simplest crease pattern. Parallel lines alternately assigned mountain (M, red dash-dot) and valley (V, blue dashed) fold like a fan or an accordion. How far a crease is folded is its fold angle $\\rho$: $0^\\circ$ flat, $\\pm 180^\\circ$ fully folded, valley positive, mountain negative.',
      observe: 'Move the "fold the whole structure" slider on the right: every crease folds by the same amount, mountains and valleys with opposite signs. Compare the colours in the pattern with the fold directions in 3D.',
      experiment: 'Turn off "Symmetry links" and drag a single crease. This pattern has no vertex where creases meet, so each crease moves on its own (DoF = number of creases). Turn the links back on and one slider folds everything.',
      meaning: 'Creases tie each other\'s motion together only where they meet at a vertex. Patterns like Miura-ori, where folding one place moves everything, owe that to their vertex conditions.',
    },
    challenges: {
      c1: { text: 'Go to 12 creases and fold all the way. How thick is the folded stack?', answer: 'Every layer stacks into one column; there are as many layers as creases plus one.' },
      c2: { text: 'Print it and fold it by hand. What happens if you swap one mountain and valley?', hint: 'Two neighbours in the same direction make one cover the other.' },
    },
    presets: [{ label: '2 creases' }, { label: '6 creases' }, { label: '12 creases (narrow)' }],
    links: ['1D folding lab', 'Miura-ori'],
  },
  'l6-twist': {
    title: 'Polygon twist folds (triangle, square, hexagon)',
    content: {
      concept: 'Two pleats leave each corner of a central polygon. The sector angles at a corner are $90^\\circ+\\varphi$, $360^\\circ/n$, $90^\\circ-\\varphi$ and $180^\\circ-360^\\circ/n$, so alternate pairs both sum to $180^\\circ$: Kawasaki holds for any $n$ and $\\varphi$.',
      observe: 'Fold the whole structure all the way and it reaches the exact flat state. Yet the Rigid solver cannot take one step from flat: it is flat-foldable but not rigid-foldable.',
      experiment: 'Switch between triangle, square and hexagon with the presets. Change the twist angle $\\varphi$ and the size of the centre polygon under Dimensions, then print the pattern and fold it.',
      meaning: 'Twist folds are the building blocks of tessellations. Once more: flat folding (the end state) and rigid folding (the path) are different questions.',
    },
    challenges: { c1: { text: 'Explain with big–little–big why a triangle twist cannot have $\\varphi$ below $30^\\circ$.', hint: 'Look where the smallest sector appears.' } },
    presets: [{ label: 'Triangle twist ($\\varphi = 40^\\circ$)' }, { label: 'Square twist ($\\varphi = 25^\\circ$)' }, { label: 'Hexagon twist ($\\varphi = 15^\\circ$)' }],
    links: ['Square twist and flat ≠ rigid'],
  },
  'l6-hypar': {
    title: 'Hypar: a saddle from straight lines',
    content: {
      concept: 'Concentric squares alternately mountain and valley, plus the diagonals. Only straight lines are folded, yet the whole sheet bends into a saddle (a hyperbolic paraboloid). Demaine et al. (2011) proved that this classic hypar cannot fold using exactly these creases: the faces must bend.',
      observe: 'Fold the whole structure with Energy: the trapezoid faces bend and the two diagonals curve in opposite directions, with face strain of a few per cent. The "triangulated" preset adds one line per trapezoid and becomes a rigid mechanism with one DoF.',
      experiment: 'Switch the classic hypar to Rigid and drive it (it locks at once). Then fold the triangulated preset as a whole and check the saddle in the Projections view.',
      meaning: 'Fold lines and face bending shape the form together. This leads on to curved creases and thin shell structures.',
    },
    challenges: { c1: { text: 'Going from 3 to 10 rings, compare the bending near the centre and near the edge.' } },
    presets: [{ label: '3 rings' }, { label: '10 rings' }, { label: 'Triangulated hypar (rigid, 1 DoF)' }],
  },
  'l6-wbtube': {
    title: 'Waterbomb tube: repeat count and radius',
    content: {
      concept: 'Waterbomb bases repeated $n$ times around and $m$ times along, rolled into a tube. As first rolled, the radius is $R_0 = d / (4\\sin(\\pi/2n))$ and the length $L_0 = m\\,d$ ($d$: unit size). It is not $d/(2\\sin(\\pi/n))$, because one unit spans two sides of the polygon.',
      observe: 'Folding the whole structure shrinks both radius and length (about 30% for 6×4). "Tube dimensions" in the lesson column shows the formula values next to the current measurements. Folded values are measured; no closed form is claimed for them.',
      experiment: 'Change $n$ and $m$ under Dimensions and compare $R_0$, $L_0$ with the folded $R$, $L$. Fold too far and the base centres collide on the axis.',
      meaning: 'The repeat counts set the overall size: the design variables of tubes whose diameter must change a lot, such as stents.',
    },
    challenges: { c1: { text: 'Predict the ratio of $R_0$ for $n = 6$ and $n = 12$ from the formula and compare with the measurement.' } },
    presets: [{ label: '6 around × 4 along' }, { label: '8 around × 2 along' }, { label: '12 around × 6 along' }],
    links: ['Waterbomb tessellation'],
  },
  'l0-first': { title: 'Your first folds', content: { concept: 'Learn the basic hand moves and bases, then print a crease pattern from this app and fold it yourself.' } },
  'l0-glossary': { title: 'Glossary', content: { concept: 'Every term used in this app in one place. Each term links to the sheet where it is used.' } },
  'l7-beyond': { title: 'Beyond flat folding: a map of origami theory', content: { concept: 'The main threads of origami research at a glance: layer order, rigid folding, design algorithms, curved creases, thick materials, kirigami, mechanics, self-folding, computation and applications.' } },
  'l7-tools': { title: 'Design and simulation tools', content: { concept: 'Real tools for drawing, designing, folding in 3D and computing the mechanics of crease patterns.' } },
  'l7-hobby': { title: 'Making origami a hobby', content: { concept: 'Choosing paper, a path to get better, tips for clean folds, books and communities: a guide to enjoying origami for a long time.' } },
};
