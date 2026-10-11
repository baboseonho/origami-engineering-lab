---
name: Origami Engineering Lab
description: A live engineering drawing set on a drafting table for KAIST AE53006 Origami Engineering.
colors:
  board: "#d2dad2"
  board-2: "#bcc7bd"
  paper: "#fbfcf9"
  paper-2: "#f1f4ef"
  paper-3: "#e5eae3"
  rule: "#d3d9d1"
  rule-2: "#a8b2a9"
  ink: "#17202a"
  ink-2: "#36404c"
  ink-3: "#58626e"
  nonphoto: "#8cc0de"
  mark: "#ffe04a"
  mark-ink: "#5c4a00"
  mountain: "#c8352b"
  valley: "#2463c9"
  facet: "#9aa5a0"
  boundary: "#36404c"
  unassigned: "#b7860b"
  locked: "#6d28d9"
  ok: "#1d7448"
  ok-soft: "#e1f0e6"
  warn: "#9a5a00"
  warn-soft: "#faefd7"
  bad: "#b3241b"
  bad-soft: "#fae4e1"
  info: "#1d5ca6"
  info-soft: "#e2ecf7"
  collide: "#d6336c"
typography:
  readout:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, Segoe UI, Malgun Gothic, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, Segoe UI, Malgun Gothic, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.375
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, Segoe UI, Malgun Gothic, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, Segoe UI, Malgun Gothic, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
    fontFeature: "\"tnum\" 1"
  body-ui:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, Segoe UI, Malgun Gothic, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Barlow Semi Condensed, Pretendard Variable, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  data:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, Segoe UI, Malgun Gothic, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  symbol:
    fontFamily: "Cambria Math, Cambria, Times New Roman, serif"
    fontSize: "1em"
    fontWeight: 400
rounded:
  hair: "2px"
  sheet: "3px"
  control: "4px"
spacing:
  frame-inset: "7px"
  gutter: "8px"
  section-y: "12px"
  section-x: "16px"
  overlay-offset: "15px"
  grid-minor: "8px"
  grid-major: "40px"
components:
  button-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
    typography: "{typography.body-ui}"
  button-default-hover:
    backgroundColor: "{colors.paper-2}"
  button-default-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  segmented-track:
    backgroundColor: "{colors.paper-2}"
    rounded: "{rounded.control}"
    padding: "2px"
  segmented-option:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sheet}"
    padding: "0 10px"
    height: "28px"
  segmented-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  stamp-ok:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ok}"
    rounded: "{rounded.hair}"
    padding: "1px 6px"
  stamp-bad:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.bad}"
    rounded: "{rounded.hair}"
    padding: "1px 6px"
  stamp-warn:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.warn}"
    rounded: "{rounded.hair}"
    padding: "1px 6px"
  input-number:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
    typography: "{typography.body-ui}"
  tab:
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  tab-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.sheet}"
  index-item-active:
    backgroundColor: "{colors.mark}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hair}"
  selection-callout:
    backgroundColor: "{colors.mark}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hair}"
    padding: "2px 6px"
---

# Design System: Origami Engineering Lab

## Overview

**Creative North Star: "The Live Drawing Set"**

The lab is a set of engineering drawings pinned to a drafting table. A sage-grey vinyl board fills the window; every panel is a bright drawing sheet lying on it; every model is a live drawing whose one free dimension, the driving crease, can be grabbed and re-drawn while the rest of the drawing re-solves. The materials are the drafting room's own: India ink and graphite for text, a non-photo-blue grid on the sheet, technical line weights, ruled title-block cells with small condensed lettering, the checker's yellow highlighter for what is selected, and small ink stamps for the checker's verdicts.

Density is calm and focus-first: a working tool used for 30 to 90 minutes before an exam, so sheets carry thin rules and dashed section creases instead of boxes, colour is reserved for meaning (mountain, valley, selection, verdict), and the chrome stays ink-on-paper. The one motion signature is physical: a sheet section folds away along its top crease like a folded drawing print. The system refuses the category default of a dark dashboard with neon-bordered panels.

The UI speaks Korean; lecture terms and symbols stay in English and in the slide notation (Kawasaki, Maekawa, DoF, rank J, ρ, θ) so the screen matches the lecture and the exam. Desktop-first, tuned for 1280 to 1600px wide.

**Key Characteristics:**
- Sage board ground, bright paper sheets, India-ink text; colour carries meaning, never decoration.
- Mountain red and valley blue are a domain convention, fixed everywhere a crease is drawn.
- Selection is a highlighter underlay that never replaces a crease's own colour.
- Title-block structure: ruled cells, condensed uppercase lettering captions, zone ticks on drawing frames.
- Verdicts are outlined ink stamps that always carry a word.
- Panels fold along a crease (rotateX hinge, 220ms) rather than slide or fade.

## Colors

An ink-on-paper neutral world on a sage board, with a small, fixed vocabulary of domain colours (red pencil, ink blue, highlighter) and quiet state tints.

### Primary
- **India Ink** (ink): All primary text, the selected state of segmented controls and the lecture switch, primary buttons, focus outline, drawing-frame lines, dimension lines and leader lines. The darkest value on screen; it is the "accent" of an ink drawing.

### Secondary
- **Red Pencil** (mountain): Mountain folds (M) in every view, legend and table; also the text caret in inputs and the selected-vertex dot in 3D.
- **Ink Blue** (valley): Valley folds (V) in every view, legend and table; first series in charts.

### Tertiary
- **Checker's Highlighter** (mark): Current selection only: the underlay beneath the selected crease (2D and 3D), the active drawing-index row, the dimension-line callout text background, the driving-ρ readout tint (at 40%), and `::selection`. The 3D view uses a more saturated lit pair (strong #ffd21f for selected, soft #ffe680 for hover) to survive scene lighting; the 2D selected face fill is a pale wash (#fff6c4).
- **Highlighter Ink** (mark-ink): Text that must sit on a solid highlighter field.
- **Non-Photo Blue** (nonphoto): The drafting grid on sheets (major 40px at 32% opacity, minor 8px at 13%) and the 3D ground grid. Never used for text or controls.

### Neutral
- **Vinyl Board** (board) and **Board Shade** (board-2): The window ground between sheets; also the 3D hemisphere ground-light colour.
- **Drawing Paper** (paper): Every sheet surface, stamp fill, input and default button fill.
- **Paper Shade** (paper-2): Hover fill, segmented-control track, recessed readout and question boxes, bottom-sheet tab rail.
- **Paper Fold** (paper-3): Active ghost button; the folded corner in the mark.
- **Light Rule** (rule) and **Rule** (rule-2): Title-block cell dividers and table row rules (rule); control borders, section-crease dashes, panel dividers and the scrollbar thumb (rule-2).
- **Graphite** (ink-2) and **Soft Graphite** (ink-3): Secondary text and boundary lines (ink-2); captions, lettering, tick labels, units and placeholders (ink-3).
- **Facet** (facet), **Boundary** (boundary), **Unassigned Ochre** (unassigned), **Lock Violet** (locked): the remaining crease assignments (F, B, U) and creases locked by the user.

### State
- **ok / ok-soft, warn / warn-soft, bad / bad-soft, info / info-soft**: Stamp outlines and text use the strong value; result boxes and solver status cells use the soft value with a strong-value border at 30 to 40%. **collide** marks detected self-intersections.

### Data series
Charts draw series in this fixed order: valley blue, mountain red, ok green, warn amber, then #6d28d9, #b5307a, #0e7490, #a3541c, #4d7c0f, #86198f. Plot fields are paper with a light grid; the current driving value is a dashed ink marker line.

### Named Rules
**The Red Pencil, Blue Ink Rule.** Mountain is always mountain red and valley is always valley blue, with their folding-diagram dash patterns: mountain dash-dot (6 2.5 1.5 2.5), valley dash (5 3), scaled to line weight in the pattern view. No theme, state or chart may reassign either colour.

**The Highlighter Underlay Rule.** Selection is drawn as a wide translucent highlighter stroke beneath the element (5.5x line weight in 2D, a translucent cylinder in 3D). It never recolours the crease itself; a selected mountain is still red on yellow.

**The Ink Is The Accent Rule.** Interactive chrome selects with India ink (ink fill, paper text), not with a brand hue. Saturated colour on screen means crease assignment, selection or a verdict.

## Typography

**Body Font:** Pretendard Variable (with Pretendard, Segoe UI, Malgun Gothic, sans-serif)
**Label Font:** Barlow Semi Condensed 600 (with Pretendard Variable)
**Symbol Font:** Cambria Math (with Cambria, Times New Roman)

**Character:** A neutral Korean grotesque does all reading and data work with tabular figures on by default; a condensed technical face appears only as title-block lettering; Greek symbols are set in a math serif so ρ and θ read as the slides print them.

### Hierarchy
- **Readout** (600, 22px, 1.25, tabular): The primary numbers a student is driving: current ρ and target ρ in the inspector. Element ids (e12, v4) use the same scale at 20px bold.
- **Headline** (700, 17px, 1.375, -0.025em): Lesson sheet title at the top of the lesson column. The app name in the title block is 15px semibold.
- **Title** (600, 13.5px): Current sheet name in the title block, note headings, question headings.
- **Body** (400, 14px, 1.7): Lesson concept text and notes; reading columns stay within the 256 to 300px sidebar.
- **Body UI** (400, 13px, 1.5): Controls, list rows, key-value rows, inspector prose (12.5px for secondary hints).
- **Label** (600, 10 to 11.5px, 0.06em, uppercase): Title-block captions, section heads, drawing-frame zone letters and view title-block captions.
- **Data** (400, 12 to 12.5px, tabular): Tables, units, tick values (10px on the angle ruler, 9px on chart axes).
- **Symbol** (Cambria Math, inherits size): Every ρ, θ and crease label such as α or β, inline and in callouts.

### Named Rules
**The Tabular Figures Rule.** Numbers are set in the body face with tabular figures (`tnum`), never in a monospace, so columns align without changing voice.

**The Lettering Is For Title Blocks Rule.** The condensed uppercase lettering labels ruled cells, section heads and frame zones, the way a drawing's title block does. It is not a decorative eyebrow above prose headlines.

**The Slide Notation Rule.** Korean for explanation, English for lecture terms and symbols: "산접기 M", "골접기 V", "자유도 DoF", "ρ". Never translate Kawasaki, Maekawa, ρ or θ.

## Layout

The window is the board: an 8px gutter (`p-2`, `gap-2`) separates every sheet. A 58px title-block header spans the top. Below it, three columns: drawing index and lesson sheet (256px), drawing views (fluid), inspector sheet (318px); at 1500px and wider these become 300px / fluid / 350px and title-block cells gain padding and icon captions. The centre column stacks the framed drawing views above an analysis sheet that folds to a 41px strip and unfolds to a drag-resizable height.

Inside sheets, sections are 12px by 16px with dashed rule creases between them (10px vertical when dense). Drawing views sit on the non-photo-blue grid (8px minor, 40px major) inside a drawing frame inset 7px from the sheet edge, with zone letters A to F across and 1 to 4 down. Floating overlays (legend, view toolbar, hints) sit 15px inside the view. The 2D pattern and 3D model share the centre column either singly or split 50/50 with a rule between.

Desktop-first: tuned for 1280 to 1600px. Breakpoints at 1400px (view-switch labels appear) and 1500px (wider columns, title-block captions on icon actions). There is no mobile layout.

## Elevation & Depth

Depth is physical and shallow: sheets lie on the board, nothing floats far above it. One soft paper shadow lifts every sheet; everything inside a sheet is flat and separated by rules, tints and dashed creases. Selection and focus never use shadows.

### Shadow Vocabulary
- **Sheet on board** (`box-shadow: 0 1px 1px rgb(23 32 42 / 0.06), 0 2px 8px -2px rgb(23 32 42 / 0.14)`): Every drawing sheet (header, sidebar, views, inspector, analysis, popovers).
- **Sheet on top** (`box-shadow: inset 0 2px 0 var(--color-ink)`): The selected tab, read as the top sheet of a set with an ink edge.
- **Overlay lift** (`shadow-sm`): Floating view-toolbar groups and the selected segmented option.

### Named Rules
**The Paper On Board Rule.** There is exactly one elevation: a sheet on the board. Inside a sheet, separate with rules and tints, never with nested shadows.

## Shapes

Drafting geometry: nearly square corners and fine lines. Sheets and callouts are 3px, controls (buttons, inputs, tabs, segmented tracks) 4px, stamps, highlighter fills and leader-note callouts 2px. Lines follow technical weights: frame lines 1px ink at 70%, rules 1px, section creases 1px dashed, crease lines at a base weight that thickens 1.7x for the driving crease and 2.2x when selected or hovered. Leader notes are an ink dot terminator, a leader line and a 14px horizontal shoulder; dimension lines carry extension lines, filled arrowheads and the value on a highlighter chip. The only round forms are the numbered-step circles in lesson notes and vertex dots.

## Components

### Buttons
Quiet, ink-on-paper, square-cornered; selection is solid ink.
- **Shape:** gently squared (4px), 32px tall (28px small).
- **Default:** paper fill, rule-2 border, ink text, 13px medium; hover darkens the border to ink-3 and fills paper-2; active/pressed is solid ink with paper text.
- **Primary:** solid ink, paper text; hover graphite (ink-2).
- **Ghost:** no fill, graphite text; hover paper-2 with ink text; active paper-3.
- **Danger:** solid bad red, paper text.
- **Focus / Disabled:** 2px ink outline at 2px offset; disabled at 45% opacity with not-allowed cursor. Colour transitions 150ms.

### Segmented Control
- **Style:** a paper-2 track with a 4px rule-2 border and 2px padding; options 28px tall, 13px medium, 3px corners.
- **State:** the selected option is solid ink with paper text and a small shadow; others graphite, hovering to paper fill. Used for 학습 방식, Rigid/Energy solver and 3D / 전개도 / 분할 view.

### Stamps (Badge)
The checker's verdict, inked onto the sheet.
- **Style:** paper fill, 1.5px outline in the state colour, 2px corners, 12px semibold, a 12px line icon (check, triangle, x, minus, info) plus a word.
- **State:** ok 가능, warn 주의, bad 불가, na 해당 없음 (ink-3 at 60%), info 참고. A stamp always carries a word, so it never reads as a checkbox.

### Cards / Containers (Sheets and Sections)
- **Corner Style:** 3px.
- **Background:** paper, on the board.
- **Shadow Strategy:** sheet-on-board only (see Elevation & Depth).
- **Border:** none on the sheet; sections inside are divided by 1px dashed rule-2 creases.
- **Internal Padding:** 12px by 16px per section. Section heads are label lettering in ink-3; foldable sections add a 14px chevron and fold their body away.
- **Result boxes:** 3px, soft state fill with a state border at 30 to 40% (rigid-solve result, revealed answers).

### Inputs / Fields
- **Style:** paper fill, 1px rule-2 border, 4px corners, 4px by 8px padding, 13px tabular text, red-pencil caret; units sit outside in ink-3.
- **Focus:** border shifts to ink, no glow.
- **Range and checkbox:** native controls with ink accent colour. The angle slider adds a ruler scale beneath (ticks every 45°, major ticks and labels every 90°, from −180 to +180).

### Navigation
- **Title block (header):** a 58px sheet split into ruled cells, each with a lettering caption over its content (강의, 도면 n/N, 학습 방식, 솔버, 보기); the lecture switch L1 to L5 selects in solid ink. Icon actions on the right are 36px, graphite, with captions revealed at 1500px.
- **Drawing index:** collapsible lecture rows with a chevron; sheets listed on a dashed left rule with tabular numbers (1.3); the active sheet sits on a highlighter swatch at 70% in semibold ink.
- **Tabs:** drawing-set tabs on a paper-2 rail; the active tab is the top sheet (paper fill, rule-2 border, inset ink top edge).

### Drawing Frame (signature)
Every drawing view is framed like an engineering sheet: a 1px ink frame inset 7px, zone letters on the margins with ticks at zone boundaries, and a ruled title block in the lower-right corner naming the solver status (tinted ok or info), the view and the model. Pointer events pass through to the drawing.

### Crease Legend
An always-visible paper card (3px, ink border at 50%) showing each assignment's line style beside its Korean and English name, and the sign convention: ρ = 0 평면 · ρ > 0 골접기 · ρ < 0 산접기.

### Fold Body (signature motion)
A section folds along its top crease: rotateX to −88° in 900px perspective with transform-origin at the top, 220ms on cubic-bezier(0.16, 1, 0.3, 1), opacity out in 180ms, and the row height collapses over 200ms ease-out. Reduced motion removes the transition. The analysis sheet folds to its 41px strip the same way.

### Cover Sheet (drawing index)
The set's cover: a ruled title block (name, course, sheet count) above one band per lecture. Each lesson is a plate with its crease pattern thumbnail, plate number "L-NN" and a "현재 도면" highlighter chip on the open lesson. Plates unfold in sequence (rotateX −88° → 0 about the top edge, 45 ms stagger) and a pen draws each pattern with `pathLength=1` dash offset, boundary lines first.

### Motion Vocabulary
- **Sheet unfold** (lesson change): View Transition, the new sheet rotates in from −78° about its top edge, 560 ms on cubic-bezier(0.16, 1, 0.3, 1).
- **Plotter**: the crease pattern is revealed left → right by a clip-path, with an ink carriage line, 900 ms.
- **Stamp**: a verdict badge lands from scale 1.35 / −7°, 360 ms with a slight overshoot.
- **Fold drive**: angle changes ease out over 650 ms; each frame is a solver result, never an interpolation.
- Reduced motion removes all of them.

### Selection Callout
The selected crease in 3D carries a drafting leader note: ink dot on the crease, ink leader, 14px shoulder, and a highlighter chip reading "label · e12 M  ρ = −63.25°" in 13px semibold. In 2D the driving crease gets a dimension line with the value on a highlighter chip.

## Do's and Don'ts

### Do:
- **Do** draw mountain folds in mountain red with the dash-dot pattern and valley folds in valley blue with the dash pattern in every view, legend, table and chart.
- **Do** mark selection with the highlighter underlay (mark) beneath the element, keeping the element's own colour on top.
- **Do** put every panel on a paper sheet with the sheet-on-board shadow and 3px corners, separated from its neighbours by the 8px board gutter.
- **Do** select interactive chrome with solid India ink and paper text.
- **Do** report feasibility with outlined ink stamps that carry a word (가능, 주의, 불가, 해당 없음, 참고).
- **Do** set numbers with tabular figures in Pretendard and Greek symbols in Cambria Math.
- **Do** caption title-block cells and section heads with the condensed uppercase lettering (10 to 11.5px, 0.06em).
- **Do** fold sections open and closed along their top crease (220ms rotateX hinge), with no transition under reduced motion.
- **Do** write UI copy in Korean and keep lecture terms and symbols in English.

### Don't:
- **Don't** build a dark dashboard of neon-bordered panels; the ground is the sage board and the surfaces are paper.
- **Don't** reassign mountain red or valley blue to any other meaning, and don't recolour a crease to show selection.
- **Don't** use colour as decoration; saturated colour means assignment, selection or a verdict.
- **Don't** stack shadows inside a sheet or lift anything higher than a sheet on the board.
- **Don't** use a monospace face for numbers or labels; tabular figures in the body face do that job.
- **Don't** use unicode glyphs as icons or arrows; icons come from one line-icon library (lucide).
- **Don't** use the condensed lettering as an eyebrow above prose headlines.
