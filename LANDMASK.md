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
