# Coarse land mask

File: `dist/data/land-mask.geojson`

Natural Earth **1:110 million land polygons**, downloaded unchanged from the
Natural Earth maintainer repository on 2026-11-14:

<https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson>

Dataset project: <https://www.naturalearthdata.com/>

Credit: **Made with Natural Earth**. Primary authors Tom Patterson and Nathaniel
Vaughn Kelso and contributors. The dataset is public domain. The publisher permits
personal, educational and commercial use and modifications without permission.
Terms: <https://www.naturalearthdata.com/about/terms-of-use/>.

SHA-256 of the bundled bytes:

`9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`

## Intended use and limits

This is a coarse first-pass land mask for manual and automatic Earth candidate
sampling. It is not a high-precision coastline or inland-water classifier. Small
islands and coastal detail may be absent or generalized. A point inside a land
polygon does not establish that a surrounding 32 km sampling window is wholly
land. Terrain coverage and validity still require separate checks.

GeoJSON coordinates use longitude, latitude order in geographic degrees. A
point-in-polygon implementation must respect polygon holes. Coastline boundary
points are intrinsically uncertain at this scale.

New runtime screening records retain all 25 coordinates and mapped-land results.
Coverage-review windows stay selectable in Compare, with no score or rank. The
full DEM statistics can include water/bathymetry. Historical cached summaries
remain summaries until re-analysis; missing point records are not reconstructed.

## Validation

- Parsed successfully as a GeoJSON FeatureCollection: 127 Polygon features,
  128 closed rings, and 5,143 coordinate vertices.
- All coordinate pairs are finite and within geographic longitude/latitude
  bounds. All rings contain at least four coordinates and close correctly.
- Hole-aware ray-crossing point tests returned land for Wadi Rum
  (29.575 N, 35.419 E) and London (51.5 N, 0.12 W).
- Tests returned ocean for equatorial Atlantic (0 N, 30 W) and equatorial
  Pacific (0 N, 150 W).

The source is a mutable upstream `master` URL; this byte hash records the exact
snapshot included in TerraMatch.

## Detailed runtime coastal screen — 15 November 2026

`dist/data/land-mask-10m.geojson` contains the unchanged source bytes from the
Natural Earth maintainer repository:

<https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson>

SHA-256:
`1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416`

10,157,965 uncompressed bytes, 11 FeatureCollection features. This exact source
was obtained during the Longyearbreen audit and is archived there as gzip without
altering its bytes. The source hash is enforced at runtime and by `npm run check`.
The asset is fetched lazily from the same Site for searches or cache rechecking.
It is held in memory, not repeated in every saved localStorage window.

This is **1:10 million cartographic scale**, not 10-metre resolution. It is more
detailed than the existing 1:110 million asset but still generalized mapping.
[Product documentation](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/)
describes land derived from the 10m coastline and continental polygons split into
contiguous pieces. Credit: **Made with Natural Earth**; public domain under the
same Natural Earth terms linked above. No high-resolution water inventory,
current shoreline survey, access permission or physical-traversability evidence
is supplied by either mask.

The original 5 × 5 coarse screen remains. A second screen checks all 65 × 65
terrain coordinates and tests detailed polygon edges touching/crossing the
window. Edges shared by adjacent land pieces are ignored when probes on both
sides remain mapped land. The one-metre computational probes identify shared
edges; they are not a claim of one-metre shoreline precision or a safety buffer.
Holes and narrow coastlines between sample positions can trigger review.
Latitude edge indexing accelerates the same boundary/parity test; it does not
simplify the source geometry.

A non-land point, intersecting coast or unavailable/hash-invalid detailed mask
withholds runtime scores while retaining the terrain for inspection. Passing
both screens remains a shortlist rule, not proof of a wholly dry window. Counts
of samples or segment intersections are not area fractions or counts of distinct
physical coastlines. Small inland waters may not be represented.

Every restored search starts pending and is rechecked against current local masks
using its saved bounds. Old booleans cannot authorize scoring. Current assessment
version, detailed-source hash and bounds are checked; no elevation reload is
required. Original coarse evidence is retained alongside the new check. Failure
leaves the window unranked. Bundled reference terrain datasets are unchanged.

The real Longyearbreen window is the regression example: 25/25 coarse land
points, 2,975/4,225 detailed land points, and coastline segments crossing/touching
the window. It now requires coverage review without a terrain score. The
historical findings describe the preceding release.
