---
name: SARscape
description: A map-first workstation for exploring genuine dated Earth observations.
colors:
  teal: "#176e75"
  teal-hover: "#10565d"
  ink: "#22363d"
  muted: "#637780"
  line: "#e0e7ea"
  paper: "#fff"
  soft: "#f2f6f7"
  canvas: "#f5f7f8"
  focus: "#469ca6"
typography:
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "29px"
    fontWeight: 750
    letterSpacing: "-.035em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "20px"
    fontWeight: 750
    letterSpacing: "-.025em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
  reading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
    lineHeight: 1.8
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11px"
    fontWeight: 650
rounded:
  control: "7px"
  inset: "5px"
  floating: "8px"
  panel: "12px"
spacing:
  tight: "6px"
  control-gap: "8px"
  compact: "10px"
  inset: "12px"
  regular: "14px"
  panel: "16px"
  generous: "25px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-primary-hover:
    backgroundColor: "{colors.teal-hover}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  floating-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
---

# Design System: SARscape

## Overview

**Creative North Star: "The Geospatial Workstation"**

SARscape places the landscape at the center of the interface. Frost-white instruments, restrained deep teal actions, and compact ink labels frame genuine natural-color imagery. Familiar geospatial and shadcn-like controls keep choosing, comparing, and tracing captures understandable.

This is a code-led system recorded from the implemented frontend, without a separate visual comp. The visual finish review covered the desktop detail view and desktop/mobile change lens and returned a ship disposition. That review establishes interface finish only. No authentic GOFF granule has yet been processed in this project, and independent science validation remains outstanding.

**Key Characteristics:**

- A full-height map with a compact instrument sidebar and floating tools.
- Genuine dated imagery, fixed terrain, and visible provenance.
- Quiet neutral surfaces with teal reserved for actions and selected states.
- Comparison through a movable lens, swipe, or actual capture blink.

## Colors

The palette is cool, restrained, and readable against varied satellite imagery; the frontmatter owns exact primitive values.

### Primary

- **Deep Teal:** primary actions, selected navigation, switches, timeline selection, and source links.
- **Deep Teal Hover:** primary button hover feedback.
- **Clear Teal Focus:** keyboard outlines across buttons, links, inputs, and selects.

### Neutral

- **Ink:** headings and control text.
- **Slate:** explanatory text and metadata.
- **Frost Line:** dividers and panel boundaries.
- **White Paper:** navigation, sidebar, sheets, timeline, and inspectors.
- **Cool Soft:** subdued supporting surfaces.
- **Frost Canvas:** application background.

**The Instrument Accent Rule.** Use teal to identify an action or state; genuine imagery supplies the map's visual richness.

## Typography

**Body and heading font:** Manrope, with a sans-serif fallback. There is no separate display face or oversized editorial type role.

The hierarchy is compact and utilitarian. Map headings are larger than sidebar titles, while control labels and metadata remain subordinate. Reading panels enlarge explanatory copy so scientific caveats can be read comfortably.

### Hierarchy

- **Headline:** map location heading; the base role scales to 34px on wide screens, 25px below 1200px, and 24px on mobile.
- **Title:** sidebar heading; sheet headings use a larger related treatment, 23px on desktop and 21px on mobile.
- **Body:** inherited application text.
- **Reading:** explanatory sheet copy; science inputs use 16px on mobile.
- **Label:** compact control titles; supporting metadata uses smaller sizes in dense instruments.

**The Numeric Alignment Rule.** Keep dates, coordinates, and measured values in tabular numerals where implemented, so changes remain easy to compare.

## Layout

The shell occupies the viewport (100dvh). A 72px topbar sits above the workspace. The desktop sidebar is 290px wide, grows to 310px at 1500px, and narrows to 270px below 1200px. The remaining area belongs to the map. Tools float inside that map rather than splitting it into a dashboard grid.

The timeline anchors near the map's bottom edge; map actions occupy the upper right, and details open in a compact inspector. Supporting information uses a 450px right sheet capped at the viewport width. The spacing vocabulary centers on compact gaps, modest control insets, and larger sheet padding rather than large decorative whitespace.

At 760px and below, the topbar is 61px tall and the sidebar becomes a user-opened drawer capped at 320px or 88vw. Timeline tools wrap, intermediate year ticks are hidden, capture labels stack, and the lens shrinks with the viewport. Short mobile heights further condense supporting tools. Preserve imagery attribution even when secondary map footnotes are hidden.

## Elevation & Depth

Borders separate fixed application regions. Soft shadows lift floating instruments above imagery, and a restrained top gradient supports white map heading text. The terrain's geographic relief is data context, not UI decoration; it stays fixed through time.

### Shadow Vocabulary

- **Floating instrument** (`0 6px 24px #20303a20`): timeline and inspector.
- **Map tool** (`0 3px 15px #12273320`): stacked map controls.
- **Selected segment** (`0 1px 3px #233b4312`): selected white segment in a muted track.
- **Comparison lens** (`0 5px 22px #132f3540`): movable lens edge over imagery.

**The Data Depth Rule.** UI shadows express tool layering; terrain relief never implies a measured elevation change.

## Shapes

Controls use modest rounded corners, with smaller inset segments and larger floating panels. Thin borders articulate controls without heavy outlines. Circular forms belong to play controls, switch thumbs, status dots, and the comparison lens. The lens has a white 3px rim and a diameter capped at 300px, shrinking to 54vw. Icons are consistent outline SVGs from the existing Lucide vocabulary.

## Components

### Buttons

Compact and familiar. Primary, outline, and ghost variants share an inline icon/text arrangement, 36px minimum height, and moderate rounding. Small controls use 32px minimum height; icon controls are 34px square. Primary hover darkens teal; outline and ghost hover gently tint their backgrounds. Disabled controls lower opacity. Keyboard focus uses a 3px outline with a 3px offset.

### Inputs / Fields

Search uses a pale inset surface and thin border. Science fields use white surfaces, visible labels, and a two-column settings grid. Native selects and ranges preserve familiar interaction. Disabled, loading, and failure states must remain visible; failed requests expose a retry action.

### Navigation

The persistent header uses text with small outline icons. Teal text and a thin bottom rule identify the active Explore destination. Mobile removes supplementary icons/counts while preserving destination labels. Saved views retain the same instrument language.

### Chips

The real-imagery badge is a light green-tinted rectangle with a small status dot. Date labels sit on white surfaces above the map. Use these for concise source or capture context, not ornamental headlines.

### Cards / Containers

The sidebar, timeline, capture inspector, and source sheet share white surfaces and restrained borders or shadows. Notes use soft tinted insets. Sheet copy carries source explanations and caveats; the map remains the dominant surface.

### Observation Comparison

Explore uses smaller previews; Inspect detail requests finer tiles on demand. Comparison starts with oldest/latest captures at a synchronized camera. A pointer-draggable, arrow-key-operable lens reveals the newer capture; swipe provides an alternate range-controlled divider. Blink alternates actual oldest/latest images, waiting for readiness. These are inspection modes, not generated motion or interpolated measurements.

### Science Processing

GOFF import settings, job states, screening counts, radar-component controls, and downloads use the same ordinary control system. Preserve original measurements alongside the optional 16-bit display preview; show its scale, rounding, aggregation, and provenance. Radar components are signed components, not horizontal speed. An adjustable correlation threshold must remain explicitly unvalidated as a glacier-motion cutoff.

## Do's and Don'ts

### Do:

- **Do** give the map the largest continuous region and keep its controls familiar.
- **Do** keep source dates, real-image identity, loading state, and provenance visible.
- **Do** maintain keyboard focus and keyboard operation for comparison controls.
- **Do** preserve original scientific measurements and label display previews as derived products.
- **Do** state that terrain is fixed and independent science validation is outstanding.

### Don't:

- **Don't** add synthetic motion cells, generated in-between captures, or animated terrain change.
- **Don't** present optical appearance comparisons as measured velocity or elevation change.
- **Don't** treat successful interface review or fixture tests as validation of glacier science.
- **Don't** replace the established workstation controls with ornamental or unfamiliar interaction patterns.

Not canonized: legacy demo velocity ramps and sample-chart styles remain in the stylesheet but are not current observation UI; their invented quantitative appearance must not become a reusable science pattern. Very small legacy metadata styles are recorded as existing density, not a preferred type scale for new reading content.

### Imagery controls and globe

Keep Image source as an ordinary labelled select. Aletsch offers Swiss aerial mosaics and dated Sentinel-2 images. Describe mosaic years separately from acquisition dates; do not invent annual flights or cloud percentages. Image adjustments uses a collapsed disclosure with labelled highlights, contrast and color sliders, live percentages, and reset. Adjustments are display-only and shared by comparison views. Globe overview uses the existing control stack; remove timeline and observation actions during globe exploration and provide an explicit Return to glacier action.
