---
name: SARscape
description: A map-first workstation for exploring genuine dated Earth observations.
colors:
  accent: "#79dce8"
  accent-soft: "rgba(121,220,232,.13)"
  ink: "#e8edf2"
  muted: "#97a3b0"
  line: "rgba(255,255,255,.09)"
  paper: "#0e1218"
  soft: "#161b22"
  raise: "#212833"
  glass: "rgba(10,13,18,.82)"
  space: "#020611"
  button-ink: "#071227"
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
    backgroundColor: "glossy white gradient"
    textColor: "{colors.button-ink}"
    rounded: "999px"
    padding: "8px 13px"
  button-outline:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "999px"
    padding: "8px 13px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "999px"
    padding: "8px 13px"
  floating-panel:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "20px"
---

# Design System: SARscape

## Overview

**Creative North Star: "The Geospatial Workstation"**

SARscape places the landscape at the center of the interface. Black and gray glass instruments float over a starfield, with white text, a sparing cyan accent, and glossy white pill actions framing genuine imagery. Familiar geospatial and shadcn-like controls keep choosing, comparing, and tracing captures understandable.

This is a code-led system recorded from the implemented frontend, without a separate visual comp. The visual finish review covered the desktop detail view and desktop/mobile change lens and returned a ship disposition. That review establishes interface finish only. No authentic GOFF granule has yet been processed in this project, and independent science validation remains outstanding.

**Key Characteristics:**

- A full-width map with a floating tool rail; each tool opens one collapsible panel.
- Genuine dated imagery, fixed terrain, and visible provenance.
- Roughly 80:20: black and gray surfaces dominate; cyan marks only selected states and small accents.
- Comparison through a movable lens, swipe, or actual capture blink.

## Colors

The palette is the landing page's space palette carried into the workstation; the frontmatter owns exact primitive values.

### Accent

- **Cyan:** selected navigation, active rail tool, switches, timeline selection, focus outlines, and source links.
- **Glossy white pill:** primary actions (play, Start exploring, primary sheet buttons) with dark button ink.

### Neutral

- **Ink:** near-white headings and control text.
- **Muted gray:** explanatory text and metadata.
- **Hairline:** translucent white dividers and panel boundaries.
- **Glass:** blurred near-black surfaces for the rail, panels, timeline, inspector, badges, and map controls.
- **Soft / Raise:** inputs, segmented tracks, and hover or selected fills.
- **Space:** the starfield behind the landing, the map workspace, and the globe view.

**The Instrument Accent Rule.** Use cyan to identify an action or state, roughly one part in five; black and gray carry the rest, and genuine imagery supplies the map's visual richness.

## Typography

**Body and heading font:** Manrope, with a sans-serif fallback. Inside the workstation there is no separate display face or oversized editorial type role; Prata appears only on the landing hero (see below).

The hierarchy is compact and utilitarian. Map headings are larger than panel titles, while control labels and metadata remain subordinate. Reading panels enlarge explanatory copy so scientific caveats can be read comfortably.

### Hierarchy

- **Headline:** map location heading; the base role scales to 34px on wide screens, 25px below 1200px, and 24px on mobile.
- **Title:** tool panel heading (16px); sheet headings use a larger related treatment, 23px on desktop and 21px on mobile.
- **Body:** inherited application text.
- **Reading:** explanatory sheet copy; science inputs use 16px on mobile.
- **Label:** compact control titles; supporting metadata uses smaller sizes in dense instruments.

**The Numeric Alignment Rule.** Keep dates, coordinates, and measured values in tabular numerals where implemented, so changes remain easy to compare.

## Layout

The shell occupies the viewport (100dvh). A 72px black topbar sits above the workspace, and the map takes the full width. A vertical rail of pill buttons (Glaciers, Imagery, Map layers, About the data) floats at the upper left; each opens one 300px glass panel beside it, closed by its X, the same rail button, or Escape. Look closer sits in the map control stack. Tools float inside the map rather than splitting it into a dashboard grid.

The timeline anchors near the map's bottom edge; map actions occupy the upper right, and details open in a compact inspector. Supporting information uses a 450px right sheet capped at the viewport width. The spacing vocabulary centers on compact gaps, modest control insets, and larger sheet padding rather than large decorative whitespace.

At 760px and below, the topbar is 61px tall, the rail shows icons only, and the open panel fills the width beside it. Timeline tools wrap, intermediate year ticks are hidden, capture labels stack, and the lens shrinks with the viewport. Short mobile heights further condense supporting tools. Preserve imagery attribution even when secondary map footnotes are hidden.

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

Compact and familiar. Primary, outline, and ghost variants share an inline icon/text arrangement, 36px minimum height, and pill rounding. Small controls use 32px minimum height; icon controls are 34px square. Primary is a glossy white pill whose glow strengthens on hover; outline (glass) and ghost hover gently lift their backgrounds. Disabled controls lower opacity. Keyboard focus uses a 3px outline with a 3px offset.

### Inputs / Fields

Search uses a dark pill inset and hairline border. Science fields use dark inset surfaces, visible labels, and a two-column settings grid. Native selects and ranges preserve familiar interaction. Disabled, loading, and failure states must remain visible; failed requests expose a retry action.

### Navigation

The persistent header uses text with small outline icons. White text and a thin cyan bottom rule identify the active Explore destination. Mobile removes supplementary icons/counts while preserving destination labels. Saved views retain the same instrument language.

### Chips

The real-imagery badge is a glass pill with a glowing cyan status dot. Date labels sit on glass pills above the map. Use these for concise source or capture context, not ornamental headlines.

### Cards / Containers

The tool panels, timeline, capture inspector, and source sheet share near-black glass surfaces with hairline borders and deep shadows. Notes use soft tinted insets. Sheet copy carries source explanations and caveats; the map remains the dominant surface.

### Observation Comparison

Full-detail tiles load automatically for each zoom; no preview quality toggle is exposed. Comparison starts with oldest/latest captures at a synchronized camera. A pointer-draggable, arrow-key-operable lens reveals the newer capture; swipe provides an alternate range-controlled divider. Blink alternates actual oldest/latest images, waiting for readiness. These are inspection modes, not generated motion or interpolated measurements.

### Science Processing

GOFF import settings, job states, screening counts, radar-component controls, and downloads use the same ordinary control system. Preserve original measurements alongside the optional 16-bit display preview; show its scale, rounding, aggregation, and provenance. Radar components are signed components, not horizontal speed. An adjustable correlation threshold must remain explicitly unvalidated as a glacier-motion cutoff.

The glacier-motion preview layers a soft, outline-clipped heatmap, faint pair-long ribbons, and particles over the terrain, with raw samples available as neutral rings. Colour encodes value: a diverging orange–slate–cyan ramp for signed components, or slate to deep blue for resolved speed. The slate midpoint stays legible on both ice and rock. Size and opacity encode confidence. The panel always leads with a quality badge (“Quality · Low”, “Approximate · not validated”) and a sentence stating whether flow direction is resolved. Particle exaggeration is printed beside the legend. The replay labels only the two acquisitions as observed and every frame between them as interpolated.

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

Keep Image source as an ordinary labelled select. Aletsch opens on dated Sentinel-2 captures so optical playback starts with actual acquisition changes; SWISSIMAGE remains selectable for high-resolution aerial context. Describe mosaic years separately from acquisition dates; do not invent annual flights or cloud percentages. Image adjustments uses a collapsed disclosure with labelled highlights, contrast and color sliders, live percentages, and reset. Adjustments are display-only and shared by comparison views. Globe overview uses the existing control stack; remove timeline and observation actions during globe exploration and provide an explicit Return to glacier action.

### Landing hero

`/` opens a scrolling landing page (`components/Hero.tsx`) above the workstation; `/#explore` opens the workstation directly, and the header brand returns to the landing. The first screen has a Prata "SARscape" headline, a cyan rule, glossy white pill actions, and Earth cut-outs labelled Optical and Radar, all sized in one design-pixel unit (`--u`) scoped to `.hero`. Behind it, a real Esri World Imagery globe (`components/LandingGlobe.tsx`) spins by continuous longitude, so it never restarts. Below come the instruments (NISAR, SWISSIMAGE, World Imagery), the three glaciers with real image thumbnails (the globe turns to whichever card crosses mid-screen), how it works, and a closing call to action. Entering the explorer dives the globe into the chosen glacier, fades out, then sets `#explore`. Prata stays on the landing; the workstation uses Manrope. Reduced motion stops the spin, skips reveals, and enters immediately.

### Sharp-only viewing correction

Remove the Explore/Inspect detail quality toggle. Automatically request the source's best tile detail for each zoom and start at an inspection scale. Keep aerial mosaic years distinct from acquisition dates. Other glaciers display a single undated high-detail reference image, with playback and comparison disabled. Never imply dated high-resolution coverage where no such source has been connected.
