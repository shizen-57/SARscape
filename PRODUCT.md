# Dancing with the SARs
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Delegated by the request to reuse established modules. React, TypeScript, Vite, MapLibre GL, Radix primitives, shadcn-style controls, TanStack Query, Hono, and local SQLite. Separate frontend, backend, and database folders are explicitly requested.

## Product Purpose
An interactive NASA Space Apps challenge solution that helps visitors explore surface change on a 3D map and understand how NISAR observations support that exploration.

The presentation starts with visible glacier change: real 2018/2026 Aletsch images side by side, with nine registered annual captures available for smooth playback. A separate radar mode makes the user's supplied 12-day GOFF pair, signed displacement, screening and source evidence inspectable. Only one clock is active, and each option has one home. Annual image blends and intermediate radar interpolation remain clearly distinguished from acquired observations, while the broader exploration workspace retains its existing features.

## Users
Assumption for the initial build: challenge judges, students, and curious non-specialists exploring changes at a selected location.

## Capabilities and Constraints
The user requests a finished application, with 3D geospatial visualization as the main experience and UX inspiration from the internet. Real dated glacier images must drive the timeline; synthetic colored cells and prototype/MVP scope were explicitly rejected. Use genuine terrain and basemap services. GOFF processing accepts authentic science files and preserves acquisition dates, masks, units, uncertainty, and provenance. Real granule processing and independent scientific validation remain completion gates; never imply schema fixtures establish glacier motion. Heavy work belongs in the backend, and missing credentials/data must remain visible without fabricated observations.

## Brand Commitments
Map-first geospatial UI with shadcn or similarly capable UI components. Product working name: SARscape.

## Evidence on Hand
User-provided NASA Space Apps challenge screenshot. ASF NISAR product guide, MapLibre terrain examples, kepler.gl, and shadcn component documentation.

## Open Decisions
Confirmed: finish existing glacier and radar features and include wetlands and forest change in this pass. All five registered locations have real annual imagery; water/vegetation indices and GCOV workflows preserve measured signals and interpretation limits. Reuse established modules instead of building Earth modeling from scratch. See FEATURE_AUDIT.md for current verification evidence.
