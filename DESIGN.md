---
name: Origami BaBolaB
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

# Design System: Origami BaBolaB

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
Six sizes, nothing below 12px on screen (including chart axes, SVG labels and the drawing frame): **12 / 13 / 14 / 15 / 18 / 22 px**. The cover title alone is 26/34px.
- **Readout** (600, 22px, tabular): The numbers a student drives or reads first: current ρ, fold progress, S and T in the GK lab, the selected element's name (ρ1, v4).
- **Headline** (700, 18px): Lesson sheet title at the top of the lesson column.
- **Title** (600, 15px): Current sheet name in the title block, the fold card's heading, the app name.
- **Body** (400, 14px, 1.7): Lesson text, the fold card's explanation, verdict labels.
- **Body UI** (400, 13px, 1.5): Controls, list rows, key-value rows, secondary hints.
- **Label** (600, 12px, 0.06em, uppercase): Title-block captions, section heads, drawing-frame zone letters (at 55% ink-3).
- **Data** (400, 12 to 13px, tabular): Tables, units, chart ticks and legends.
- **Symbol** (Cambria Math, inherits size): Every ρ, θ and crease label, inline and in callouts.

**The Real Pixels Rule.** Text inside an SVG is sized in screen pixels, not viewBox units: charts are drawn at their measured width, and the crease pattern, sector diagram and angular walk convert 12–15px into drawing units from the element's measured size, so zooming never shrinks a label below 12px. Less important numbers (solver iterations, κ, sector tables) sit behind a disclosure rather than in smaller type.

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
Quiet, ink-on-paper, square-cornered. **Solid ink means "do this"; an inked outline means "this is chosen".** The two are never the same mark.
- **Shape:** gently squared (4px), 32px tall (28px small).
- **Default:** paper fill, rule-2 border, ink text, 14px medium; hover darkens the border to ink-3 and fills paper-2; pressed/chosen is paper with an ink border and a 1px inset ink ring, semibold.
- **Primary:** solid ink, paper text; hover graphite (ink-2).
- **Ghost:** no fill, graphite text; hover paper-2 with ink text; active paper-3.
- **Danger:** solid bad red, paper text.
- **Focus / Disabled:** 2px ink outline at 2px offset; disabled at 45% opacity with not-allowed cursor. Colour transitions 150ms.

### Segmented Control
- **Style:** a paper-2 track with a 4px rule-2 border and 2px padding; options 28px tall, 13px medium, 3px corners.
- **State:** the selected option is paper with a 1.5px inset ink ring and semibold ink text (`bg-paper text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--color-ink)]`); others graphite, hovering to paper fill. Used for the Rigid/Energy solver, 3D / 전개도 / 분할, the lesson mode tabs (설명 · 탐구 · 과제), speed and size pickers.

### Stamps (Badge)
The checker's verdict, inked onto the sheet.
- **Style:** paper fill, 1.5px outline in the state colour, 2px corners, 12px semibold, a 12px line icon (check, triangle, x, minus, info) plus a word.
- **State:** ok, warn, bad, na (ink-3 at 60%), info. A stamp always carries a word, and **the word answers its own question**: 평탄 접힘 조건 성립/위반, 현재 강체 해 있음/없음, 1차(무한소) 가동성 있음 (n)/없음 (0), 자기 교차 없음/있음 (n쌍), 면 변형 작음/보통/큼. "가능" is not used as a generic yes.

### Verdict Strip
The top of the inspector, sticky while the panel scrolls: five rows (label left, stamp right), two columns from 1500px. "근거 보기" unfolds the measured value and a one-line explanation of each row. A lesson can add one sentence under it (`verdictNote`), e.g. the shopping bag says that infinitesimal mobility is not a folding motion. The five properties are never merged into one "valid" label.

### Inspector Order
1. Verdict strip. 2. One fold card: the single primary way to fold this sheet (progress slider, one ink action, the only speed control, and plain-language readouts such as "닫힘 오차 ≈ 0 (정확한 강체 해)" with the raw ‖C‖ in a tooltip, or "면 늘어남 지금 / 경로 중 최대"). 3. The selection: name (one name per crease everywhere, `creaseName`: ρ1 when the lesson labels it, otherwise e12), assignment chip, current ρ; a rigid failure explains itself right there. Single-crease angle controls, M/V reassignment, linked creases and solver numbers are disclosures. 4. Model info and solver options, folded.

### Notice
When the app changes something on its own (switching the solver for a pattern fold or an experiment) a paper note with an info icon rises at the bottom centre for five seconds (`aria-live="polite"`, closable), saying what changed and why.

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
- **Title block (header):** a 58px sheet split into ruled cells, each with a lettering caption over its content: identity (opens the cover), 강의 L1–L5 (≥1280px), where you are ("도면 4.1 · 테셀레이션" over the sheet title, with previous/next sheet arrows), and on model sheets only 솔버 and 보기. Lab sheets show neither. Play appears only in Energy. Icon actions on the right are 36px, graphite, with captions revealed at 1500px. Below 768px it becomes two rows: index, where you are, actions; then solver and view without captions.
- **Lesson mode:** 설명 / 탐구 / 과제 tabs sit at the top of the lesson column, next to the text they change.
- **Below 1280px** the right sheet carries "레슨 | 검사" (or "레슨 | 이론" on labs) tabs, so the lesson text is reachable without the drawer.
- **Sheet numbers** are "lecture.index" (4.1) everywhere: index, cover, title block. Lecture titles come from one table (`LECTURE_TITLES`).
- **Drawing index:** collapsible lecture rows with a chevron; sheets listed on a dashed left rule with tabular numbers (1.3); the active sheet sits on a highlighter swatch at 70% in semibold ink.
- **Tabs:** drawing-set tabs on a paper-2 rail; the active tab is the top sheet (paper fill, rule-2 border, inset ink top edge).

### Drawing Frame (signature)
Every drawing view is framed like an engineering sheet: a 1px ink frame inset 7px, zone letters on the margins with ticks at zone boundaries, and a ruled title block in the lower-right corner naming the solver status (tinted ok or info), the view and the model. Pointer events pass through to the drawing.

### Crease Legend
An always-visible paper card (3px, ink border at 50%) showing each assignment's line style beside its Korean and English name, and the sign convention: ρ = 0 평면 · ρ > 0 골접기 · ρ < 0 산접기.

### Fold Body (signature motion)
A section folds along its top crease: rotateX to −88° in 900px perspective with transform-origin at the top, 220ms on cubic-bezier(0.16, 1, 0.3, 1), opacity out in 180ms, and the row height collapses over 200ms ease-out. Reduced motion removes the transition. The analysis sheet folds to its 41px strip the same way.

### Cover Sheet (drawing index)
The set's cover: a ruled title block (name, course, sheet count) above one band per lecture. Each lesson is a plate with its crease pattern thumbnail, sheet number "4.1", a line of theorem tags (Kawasaki · Maekawa, N − 3M …) and a "현재 도면" highlighter chip on the open lesson. While it is open the board behind is inert and focus starts on its close button and returns on close. Plates unfold in sequence (rotateX −88° → 0 about the top edge, 45 ms stagger) and a pen draws each pattern with `pathLength=1` dash offset, boundary lines first.

### Motion Vocabulary
- **Sheet unfold** (lesson change): View Transition, the new sheet rotates in from −78° about its top edge, 560 ms on cubic-bezier(0.16, 1, 0.3, 1).
- **Plotter**: the crease pattern is revealed left → right by a clip-path, with an ink carriage line, 900 ms.
- **Stamp**: a verdict badge lands from scale 1.35 / −7°, 360 ms with a slight overshoot.
- **Fold drive**: angle changes ease out over 650 ms; each frame is a solver result, never an interpolation.
- Reduced motion removes all of them.

### Selection Callout
The selected crease in 3D carries a drafting leader note: ink dot on the crease, ink leader, 14px shoulder, and a highlighter chip reading "ρ1 −70.0°" (crease name, one decimal) in 14px semibold. In 2D the driving crease gets a dimension line with the same text on a highlighter chip.

## Do's and Don'ts

### Do:
- **Do** draw mountain folds in mountain red with the dash-dot pattern and valley folds in valley blue with the dash pattern in every view, legend, table and chart.
- **Do** mark selection with the highlighter underlay (mark) beneath the element, keeping the element's own colour on top.
- **Do** put every panel on a paper sheet with the sheet-on-board shadow and 3px corners, separated from its neighbours by the 8px board gutter.
- **Do** mark a chosen option with an inked outline, and keep solid ink for the one primary action of a panel.
- **Do** report feasibility with outlined ink stamps whose word answers the row's question (성립, 있음, 없음, 작음 …).
- **Do** give each sheet one obvious way to fold it; extra controls go behind a disclosure.
- **Do** set numbers with tabular figures in Pretendard and Greek symbols in Cambria Math.
- **Do** caption title-block cells and section heads with the condensed uppercase lettering (12px, 0.06em).
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
- **Don't** set any text below 12px, and don't scale SVG text with the viewBox.
- **Don't** change a mode silently; announce it with a notice.
