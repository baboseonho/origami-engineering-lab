# Surface brief — app shell (all lessons)

Scope: the whole single-page app (top bar, lesson index, lesson sheet, 3D/2D views, inspector, analysis panel, labs). Visitor mode: Operate (Read for lesson text).
Audience/job: see PRODUCT.md. Constraints: Three.js viewport stays interactive at 60 fps; M red / V blue convention; Korean copy with English terms.

## Direction contract
THESIS: The lab is a drawing set on a drafting table: every panel is a drawing sheet, every model a live engineering drawing that can be re-drawn by moving one dimension (the driving crease). Refuses the category default of a dark dashboard of neon-bordered panels.

OWN-WORLD: Sage-grey vinyl drafting-board ground (#d5ddd6) with bright drawing-paper sheets (#fbfcfa) carrying a non-photo-blue grid; India-ink text (#18202b) and graphite secondary (#56606d); technical line weights (0.35 / 0.7 mm feel); title blocks with ruled cells and small condensed technical lettering; the checker's yellow highlighter (#ffe14d) marks the current selection; red pencil (#d23c32) for mountain/errors, ink blue (#2f6fd1) for valley; status as small ink stamps. Icons: one line-icon library.

STORY: The student opens a sheet, reads one short concept, grabs the dimension (driving crease), watches the whole drawing re-solve, and reads the checker's stamps (feasible / infeasible and why).

FIRST VIEWPORT: Drawing-set header (title block: course, lesson sheet name, sheet number, Rigid/Energy switch, view switch). Left: drawing index + lesson sheet. Center: framed drawing views (2D pattern | 3D model) with zone ticks on the frame edges. Right: inspector as a title-block style sheet with the selected crease's dimension (ρ) as the primary control. Bottom: analysis sheet folded to a strip, unfolds on demand.

FORM: Drafting-table drawing set (user-selected direction, 1 of 3 offered); no concept-seed key (engine not run; user pinned the world).

Signature move: panels fold and unfold along a crease (rotateX hinge, ~220 ms) like a folded drawing print; the selected crease is marked with highlighter yellow and labelled with a dimension-line callout.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
