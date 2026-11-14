# Data and functional audit — 14 November 2026

This audit distinguishes source authenticity, numerical correctness, scientific
validity, implemented features and actual browser verification.

## Source rechecks

The exact archived source bytes were retrieved again, without changing the
application datasets:

| Dataset | Verification |
| --- | --- |
| Jezero / NASA MOLA | Original 1,635,840-byte archive range has the recorded SHA-256. Five spatially separated grid samples independently resampled from the retrieved bytes agree with the bundled heights to their stored 0.01 m rounding. |
| Shackleton / NASA LOLA | Original 1,029,240-byte archive range has the recorded SHA-256. Five spatially separated samples decoded as little-endian signed integers × 0.5 and resampled agree with the bundle. |
| Wadi Rum / Skadi HGT | Re-fetched compressed source tile has the recorded SHA-256. Five spatially separated samples independently decoded from the 3,601 × 3,601 HGT tile agree with the bundle. |

The original MOLA and LOLA PDS labels were inspected again for pixel dimensions,
data type, elevation scale, coordinate frame and interpolation caveats. This audit
did not independently re-fetch the other three Earth subsets; their original
retrieval records and numerical consistency checks remain available.

These checks establish faithful source retrieval and resampling at the checked
points. They do **not** establish real-world positional/elevation accuracy, absence
of source interpolation error, or validated mission relevance. Two decimal places
in a resampled height are not centimetre accuracy.

## Numerical and functional checks

The 14 automated tests cover analytic planar slopes, interpolation, polar
coordinates, source-grid validity, matched-window comparison, coastal exclusion,
six-leg geometry, folded deployment stance, arrival/deployment state progression,
keyboard movement and inspection logic, pause, DOM navigation and scientific
exports. All passed during this audit.

The user additionally confirmed the published application renders and that the
robot moves through keyboard control. A complete visual/device/browser matrix
has not been performed. Automated expedition tests use a renderer test double;
they do not verify GPU pixels, frame rate, WebGL driver behavior or every UI state
on the deployed private site.

## Finding corrected

The terrain comparison calculation honored the selected weights, but its returned
`method` string always described the default 65/35 weights. The export now records
the active normalized weights in the formula. Regression assertions cover
slope-only and relief-only explanations. The scientific dataset values and score
formula are unchanged.

## Implemented boundaries

- Candidate ranking evaluates three curated inland Earth regions. It does not
  run a new global search. Six terrain windows are bundled; coastal Lanzarote is
  excluded from ranking.
- The terrain index uses slopes and relative relief only. Surface thermal context
  is now documented separately in THERMAL.md. Mineralogy, ice, biology, dust
  and subsurface conditions remain unassessed.
- The resemblance index is a project-defined, uncalibrated terrain heuristic. It
  is not a NASA-approved score, probability or proof of analog suitability.
- Window size, sampling and weights affect rankings. No multi-scale sensitivity
  study or external expert validation has yet been completed.
- Rocket and robot objects, rocks, colors, lighting and movement are presentation
  and interaction features. The coarse source DEM does not map the decorative
  rocks. Robot walking does not prove physical traversability.
- Navigation is bounded to each 32 km study window. Robot/lander size is enlarged
  for navigation, and the arrival sequence is not a validated flight simulation.

See DATA.md and ASSETS.md for exact provenance, algorithms and visual credits.

## Subsequent manual/automatic search release

The earlier curated-only search boundary above records the audited first release.
The subsequent release adds on-demand manual and automatic terrain retrieval,
bounded survey coverage, tile decoding/hashes, land screening, cancellation and
browser-local caching. See SEARCH-DATA.md for the new implementation and real
network verification. Global surveys remain finite samples, not exhaustive Earth
searches, and terrain-only scientific interpretation limits remain in effect.
