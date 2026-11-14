# Runtime Earth terrain search

TerraMatch can retrieve and compare a **new Earth location selected by the user**, or sample new locations within a selected search region. The search module does not substitute the three bundled Earth reference candidates for a runtime search.

## Data path

1. The user supplies coordinates, selects a returned place name, or launches a bounded regional scan.
2. A 32 km × 32 km local-equirectangular window is constructed around each center.
3. A 5 × 5 screening grid is tested against the bundled Natural Earth 1:110m land polygons.
4. Public Mapzen / Tilezen Terrarium elevation PNG tiles are fetched directly from AWS.
5. PNG samples are decoded without canvas, image colour correction, or screenshot interpretation.
6. Elevations are bilinearly sampled into the existing 65 × 65 terrain schema, with 500 m sample spacing.
7. The existing `analyzeTerrain` and `compareTerrains` functions calculate the same 1,000 m-baseline terrain comparison used for the bundled targets.

The Earth data path uses this public source:

`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`

Reference documentation:

- Registry: https://registry.opendata.aws/terrain-tiles/
- Format: https://github.com/tilezen/joerd/blob/master/docs/formats.md
- Attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md

These are **mixed-source elevation and bathymetry tiles**, potentially including SRTM, USGS 3DEP/GMTED2010, Copernicus EU-DEM, NOAA bathymetry and other regional sources. They are not described as pure NASA data or as the unmodified NASA Earthdata product. Attribution and limitations of the original providers remain applicable.

## RGB and spatial decoding

Terrarium elevation in metres is:

```text
height = red × 256 + green + blue / 256 − 32768
```

Tiles are 256 × 256 pixels in Web Mercator (EPSG:3857). The zoom is selected so the nominal tile-pixel spacing is at most approximately 200 m at the window center. That posting is **not** a guarantee of source accuracy or effective terrain resolution.

Pixel-center registration is preserved by subtracting 0.5 from the global pixel coordinates before bilinear interpolation. Interpolation reads neighboring pixels across tile seams, wrapping tile X at the antimeridian. This prevents half-pixel shifts and artificial tile-edge discontinuities.

The PNG decoder accepts non-interlaced 8-bit RGB and RGBA images, reconstructs PNG filters 0–4, checks chunk CRCs and rejects unsupported image encodings or transparent/no-data terrain pixels. It uses the standard `DecompressionStream('deflate')` API in current browsers and Node 22. There is no graphics colour-management step.

Each result records the actual source tile URLs, tile coordinates, PNG SHA-256 hashes, byte counts, retrieval timestamps, source format, resampling method, zoom and nominal pixel spacing. The resulting grid is rounded to two decimal places; this does not imply centimetre-scale accuracy.

## Land and water screening

The bundled Natural Earth mask is public domain:

https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/

The land screen uses **25 sample positions** across the window. A window with any sample outside the approximate land polygons remains inspectable but is excluded from terrestrial ranking. Polygon holes and antimeridian-crossing rings are handled explicitly.

This is coarse coastal screening. It does not resolve every small island, coastline, inland lake or other water body. Passing the screen is not proof that an entire window is dry land, accessible or suitable for field operations. Detailed land-cover/water masks would be needed to make those claims.

**Negative elevations are retained.** Below-sea-level terrestrial sites such as Death Valley are not classified as ocean merely because their heights are negative.

## Manual location lookup

`parseCoordinates(text)` supports decimal latitude/longitude, optional degree symbols and N/S/E/W suffixes. Coordinate-shaped invalid numerical entries are rejected instead of being sent to geocoding. Geographic parsing supports ±90° latitude; runtime Web Mercator terrain retrieval is limited to **84° S–84° N**.

`findPlaces(query, {signal})` first recognizes entered coordinates. Place-name queries combine matching local reference-site names with the user-triggered Open-Meteo Geocoding API:

`https://geocoding-api.open-meteo.com/v1/search?name=...&count=5&language=en&format=json`

Reference: https://open-meteo.com/en/docs/geocoding-api

Geocoding is used only to locate a place and is not evidence of scientific similarity. Results identify Open-Meteo / GeoNames as their source. The non-commercial public API conditions apply to this hackathon use; commercial usage would require reviewing the provider's current plan and terms. Automatic region scans do not call geocoding.

## Automatic search coverage

`generateSearchCenters` builds a latitude/longitude sampling grid within the supplied bounds, screens candidate centers against the coarse land mask, and deterministically selects a spatially distributed subset. A scan is capped at **48 windows**, with a default of 24. Extremely dense requested grids are probed at no more than 40,000 distributed grid cells before selecting the bounded subset.

Each selected window is fetched and analyzed independently. Results are ranked by the existing transparent terrain-only index. Coverage records the bounds, requested grid step, actual grid spacing, grid-cell/probe counts, selected centers, attempted windows, completed windows, exclusions, failures and cancellation state.

This is a **bounded sampled regional search**, not an exhaustive global search or proof that the best possible Earth analog has been found. Terrain similarity alone does not establish geological, mineralogical, thermal, biological or operational equivalence.

Cancellation returns the results that completed before cancellation, marked with `coverage.cancelled: true`. Per-candidate data errors are counted and recorded; later candidates continue. There is no fallback to invented terrain or to silently ranking the bundled catalogue.

## Resource and cancellation behavior

- At most four elevation-tile fetches are active across callers.
- A least-recently-used cache retains up to 48 successfully decoded elevation tiles.
- In-flight requests are not shared across unrelated abort signals, preventing one cancelled request from poisoning another caller's data.
- Failed or aborted tile requests are not cached as valid tiles.
- Requests have a bounded timeout and preserve explicit network/decode errors.
- SHA-256 requires a secure context: HTTPS or localhost.
- The production elevation GET endpoint was independently checked with the hosted Site origin and returned `Access-Control-Allow-Origin: *`. HEAD responses can omit that header, so GET behavior is the relevant check.

## Module API

All functions are exported from `dist/js/terrain-search.js`:

```js
decodePNG(bytes)                       // Promise<{width,height,channels,pixels}>
decodeTerrarium(bytesOrDecodedPNG)      // Promise<{width,height,heights}>
parseCoordinates(text)                 // {lat,lon} | null; invalid numeric entries throw
findPlaces(query, {signal})            // Promise<place[]>
loadLandMask({signal,landmask})         // Promise<GeoJSON>
isLand(lon, lat, geojson)               // boolean
landWindowCoverage(bounds, geojson)    // sampled coverage record
generateSearchCenters(bounds, {stepDegrees,maxCandidates}, landmask)
loadEarthWindow({lat,lon,name,country,origin,signal,onProgress,landmask})
// Promise<{site,data,stats}>
scanEarthRegion({bounds,stepDegrees,maxCandidates,targetTerrain,weights,
                 signal,onProgress,onResult,landmask})
// Promise<{results,excluded,coverage}>
clearSearchCaches()
SEARCH_SOURCES                        // source catalogue entries
```

`site.id` is coordinate-stable with a `custom-` prefix. Runtime data are returned directly; `site.terrainFile` is null and `site.dataFile` is a runtime identifier. The application can persist the returned site, data and provenance in its own storage.

Longitude bounds remain continuous/unwrapped for windows that cross the antimeridian, for example 179.7°–180.1°. `bounds.crossesAntimeridian` and `projection.wrapLongitude` are set. Readouts should normalize longitude into −180°–180° while preserving continuous bounds for interpolation.

Optional `landmask` injection is intended for tests or explicit alternative masks. Results using the ordinary cached bundled mask retain its actual SHA-256 and source URL; caller-supplied masks are identified separately.

## Verification

The dedicated suite (`node --test tests/terrain-search.test.mjs`) passed **18 tests** covering PNG reconstruction/integrity, Terrarium values, coordinate parsing, polygon holes and dateline/polar boundaries, land-window screening, distributed center selection, half-pixel bilinear seam addressing, negative land elevations, bounded concurrency, cancellation isolation, place lookup, genuine automatic new-window retrieval, preservation of mask provenance, partial scan cancellation, per-candidate failures and coastal exclusions.

Two real public-data windows were loaded and analyzed using the same runtime module under Node 22:

| Center | Tiles | Coarse land samples | Relief | Mean 1 km-baseline slope |
|---|---:|---:|---:|---:|
| Wadi Rum, 29.575° N, 35.419° E | 4 | 25/25 | 920.48 m | 6.0500° |
| Independently selected Utah window, 37.300° N, 111.700° W | 6 | 25/25 | 887.61 m | 5.2874° |

All ten real elevation GETs returned HTTP 200 with CORS wildcard. All tile payloads decoded, all 4,225 heights per window were finite, and each tile's SHA-256 was recorded. These are validation examples rather than fixed runtime results. Their Terrarium resampling can differ slightly from the original bundled HGT-derived windows.

A real automatic regional scan was also completed against the bundled Jezero target. Bounds were 22°–24° N, 40°–42° E; requested grid step was 1°; the bounded sample selected two of four land-center grid cells. Both selected coordinates were newly fetched rather than catalogue sites:

| Automatically sampled center | Tiles | Relief | Mean slope | Terrain-only index vs Jezero |
|---|---:|---:|---:|---:|
| 22.500° N, 41.500° E | 4 | 72.68 m | 0.3059° | 48.3 |
| 23.500° N, 41.500° E | 4 | 133.44 m | 0.3986° | 48.6 |

Coverage was two planned, two attempted, two completed, zero excluded and zero failed. Eight actual PNG GETs returned valid CORS responses. The default terrain weights were used. The Natural Earth land-mask hash retained by both results was `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`. This audit did not add generated terrain windows to the production catalogue or claim either coordinate is a scientifically established analog.

Browser-host visual QA is separate from this source/decode/network verification.
