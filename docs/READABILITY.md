# Content and reading improvements — 15 November 2026

All main tabs use the bundled official Inter variable font under the SIL Open
Font License, retained in `dist/assets/fonts/Inter-LICENSE.txt`. Typography uses
16 px body copy, readable controls, and a 12 px minimum for secondary CSS labels.
Shared layout adjustments allow larger text to wrap in cards, tables, source
records, and Expedition overlays. Chart panels retain horizontal scrolling when
their axis labels need more space.

The Explore footer distinguishes loaded study areas from candidate pairs and
shows the automatic comparison's 2 km grid. Switching modes updates that status.
Terrain inspection reads grid spacing and slope baseline from the selected
area's telemetry, retaining 500 m / 1 km reference and 2 km / 4 km automatic
scales. Missing scale metadata remains unavailable instead of being guessed.

Copy uses plain descriptions such as elevation range and slope patterns.
Explorer and vehicle descriptions do not depend on leg counts or a particular
model design. Sources distinguish analysis, references, discovery resources,
and challenge resources unused in this release. Visual credits link the
surface-illustration generation records and the font license.

Historical imagery dates, provenance, missing-data conditions, and scientific
limitations remain visible in their respective records. Calculation methods,
source heights, search coverage, scoring and ranking are unchanged.

The initial Explore layout uses the automatic-search structure, avoiding an
initial flash of the manual mission controls while source data load.

Validation covers application flows, dynamic inspection labels, source usage,
dataset integrity, and the production snapshot. Automated DOM checks are not
native-browser or GPU visual QA.
