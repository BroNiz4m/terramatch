# TerraMatch terrain data and comparison method

The application ships **real geolocated elevation subsets**, not procedural scientific terrain. The rocket, hexapod, terrain colours, atmosphere, surface decoration and deployment sequence are an interactive presentation layer. They do not constitute a reconstruction of a particular flight or a validated robot mobility model.

## Included windows

Each window contains 65 × 65 finite elevation samples on a 32 km × 32 km projected grid. Sample spacing is 500 m. Values are stored in metres, rounded to two decimal places after bilinear resampling; the extra decimal places do not imply additional source accuracy.

| Location | Center | Source | Use in ranking |
|---|---|---|---|
| Jezero Crater, Mars | 18.38° N, 77.58° E | NASA MGS MOLA MEGDR, 128 pixels/degree | Planetary target |
| Shackleton region, Moon | 89.67° S, 129.78° E | NASA LRO LOLA south-polar DEM, 240 m | Planetary target |
| Wadi Rum, Jordan | 29.575° N, 35.419° E | Skadi HGT mixed-source terrain distribution | Earth candidate |
| Al Wahbah, Saudi Arabia | 22.900° N, 41.138° E | Skadi HGT mixed-source terrain distribution | Earth candidate |
| Amboy Crater, United States | 34.557° N, 115.780° W | Skadi HGT; US tiles can use USGS 3DEP/NED | Earth candidate |
| Lanzarote, Spain | 28.995° N, 13.740° W | Skadi mixed land/bathymetric elevation | **Excluded**: the 32 km island window intersects the sea |

These are curated candidate/reference sites. The application does not claim they are newly discovered analogs or that they are approved sites for fieldwork, landing or base construction.

## On-demand search extension

In addition to the bundled reference windows, the application now retrieves new
Earth windows from Mapzen / Tilezen Terrarium tiles. Manual inputs can be place
names, coordinates or globe-selected points. Automatic surveys sample new grid
centers in an explicitly bounded region. They do not simply reorder the three
reference candidates. Candidate origin, source tile hashes and survey coverage
are retained; these are candidate discoveries by the application, not claims of
previously unknown scientific analogs.

The runtime uses the same 32 km extent, 65 × 65 samples and 1 km slope baseline.
PNG channel values are decoded directly as elevation, with correct pixel-center
interpolation across tile seams. Natural Earth 1:110 million land polygons supply
a coarse 25-point screening rule. Negative terrain elevations are preserved;
height below sea level is not itself treated as ocean. Source-pixel spacing can
vary with latitude and zoom and is not a guarantee of native DEM accuracy.

New searches need internet; the latest 24 valid results are cached in the browser.
Cancelled surveys preserve completed results and label partial coverage. Failed
or coastal/non-land windows are counted and are not assigned an invented score.
See SEARCH-DATA.md and LANDMASK.md for methods, validation and provenance.

## NASA planetary sources

### Mars

- Archive: https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- Product: `MEGT44N000HB.IMG`, topography tile, 128 pixels/degree.
- Data: https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg128/megt44n000hb.img
- Label: same URL ending `.lbl`.
- Read as signed big-endian 16-bit integers, 11,520 columns × 5,632 rows.
- Longitude increases eastward from 0°. Row-center latitude = `44 − (row + 0.5)/128`; column-center longitude = `(column + 0.5)/128`.
- Elevation is topography relative to the Mars areoid in the IAU2000 planetocentric frame. Approximate native north–south grid spacing is 463 m.
- Only the required contiguous source-row byte range is downloaded; the exact range and SHA-256 are retained in the JSON provenance.
- MOLA source cells may be interpolated between altimeter tracks. The source label notes that gaps between profiles can reach 12 km. A raster posting is not a statement of effective measurement resolution everywhere.

### Moon

- Archive: https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- Product: `LDEM_75S_240M.IMG`, version 2.0.
- Data: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img
- Label: same URL ending `.lbl`.
- Read as signed little-endian 16-bit integers, 3,812 × 3,812 pixels. Convert digital numbers to elevation with **DN × 0.5 m**. Do not add the 1,737,400 m reference radius to obtain elevation.
- Spherical south-polar stereographic projection, central meridian 0°, scale 240 m/pixel, zero-based polar origin index 1905.5.
- For a point at latitude φ and longitude λ: `ρ = 2R tan((π/2 + φ)/2)`, `x = ρ sin λ`, `y = ρ cos λ`; source column = `1905.5 + x/240`, row = `1905.5 − y/240`.
- Inverse projection is implemented by `terrainCoordinates`; grid axes near the pole must not be treated as ordinary geographic north/east.
- Source heights are relative to the 1,737.4 km reference sphere in the DE421 mean Earth/polar-axis frame. The source grid interpolates altimeter tracks using GMT tools.
- Crater center reference: IAU/USGS Gazetteer, https://planetarynames.wr.usgs.gov/Feature/5450.
- This terrain subset does not calculate solar illumination, permanent shadows, cold traps, water ice, radiation or communication availability.

## Earth source and attribution

Earth heights are read from public **Skadi** `.hgt.gz` tiles distributed by Mapzen/Tilezen on AWS. This is a mixed-source derivative distribution. It is not described as an unmodified NASA Earthdata product.

- Registry: https://registry.opendata.aws/terrain-tiles/
- Source and attribution documentation: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
- Tile pattern: `https://s3.amazonaws.com/elevation-tiles-prod/skadi/{Nxx|Sxx}/{NxxEyyy|NxxWyyy}.hgt.gz`.
- HGT values are read as signed big-endian 16-bit elevations, north-to-south rows. Selected tiles contain 3,601 × 3,601 samples, approximately 1 arc-second spacing.
- Data origins may include SRTM, GMTED2010, USGS 3DEP/NED, Copernicus EU-DEM and NOAA ETOPO1. Exact composition can differ by region. A tile's archive resolution must not be confused with independently measured native terrain accuracy.
- **SRTM data courtesy of the U.S. Geological Survey.**
- **3DEP data courtesy of the U.S. Geological Survey.**
- Global ETOPO1 terrain: NOAA / National Centers for Environmental Information.
- European terrain may use Copernicus data and information funded by the European Union, EU-DEM layers.
- Distribution: Mapzen / Tilezen. Follow the linked attribution documentation when reusing or redistributing these derivatives.
- NASA SRTM reference DOI: https://doi.org/10.5067/MEaSUREs/SRTM/SRTMGL1.003.

Each sampled grid retains the source tile URLs and SHA-256 hashes of the downloaded gzip files. Missing HGT values (`−32768`) cause retrieval to fail; the script does not invent replacement terrain.

Lanzarote is intentionally excluded from ranking. Its common-size window includes sea-floor bathymetry (down to approximately −1,610 m), which would distort a terrestrial field-mobility comparison. Retaining the file and documenting this exclusion demonstrates a dataset-selection limit rather than silently treating sea-floor relief as accessible land.

## What the terrain score means

1. All included ranking windows use a common physical extent and 500 m sample spacing.
2. Calculate interior gradients with central differences over **1,000 m** in both grid directions.
3. Slope angle = `atan(hypot(dh/dx, dh/dz))` in degrees.
4. Build normalized slope histograms with boundaries `[0, 2, 5, 10, 20, 35, 90]` degrees.
5. Slope distance = half the sum of absolute differences between histogram fractions (total-variation distance).
6. Relief = maximum minus minimum elevation **within each window**. Absolute elevations from different planetary datums are not compared.
7. Relief distance = `min(1, abs(log((reliefA+1)/(reliefB+1))) / log(4))`.
8. Default index = `100 × [1 − (0.65 × slope distance + 0.35 × relief distance)]`.

The index is a transparent, adjustable **terrain-only heuristic**. It is not a probability, confidence interval, trained prediction, proof of mineral equivalence, or validated measure of mission suitability. Results depend on window center, extent, source quality, interpolation and chosen weights. Shared broad relief does not imply the same geological process.

For example, a volcanic maar, cinder cone and impact crater can have interesting terrain similarities while having different origins. Wadi Rum's sandstone does not become Martian delta sediment or lunar regolith because a terrain score is high.

**Thermal context is assessed separately:** see [THERMAL.md](THERMAL.md). It does not enter this terrain index.

**Not assessed:** mineralogy, water/ice, dust or wind, biology, subsurface caves, gravity effects on robot performance, radiation, accessibility, permits, environmental protection and operational safety.

Profiles show elevations along the middle grid row; any normalization should be explicitly labelled. Slope overlays derive from these same coarse elevation grids. Decorative rocks or dust and robot foot-contact detail are visual additions, not resolved measurements of the actual site.

## Exploration-task presets

`TASK_PROFILES` in `dist/js/science.js` defines four presets for the same index. They only
change the two weights in step 8 above:

| Task | Slope | Relief | Reason given to the user |
| --- | ---: | ---: | --- |
| `terrain` | 0.65 | 0.35 | Balanced default. |
| `navigation` | 0.85 | 0.15 | Route planning at this scale depends mostly on the slope mix. |
| `fieldwork` | 0.50 | 0.50 | Local steepness and the elevation range both affect logistics. |
| `thermal` | 0.65 | 0.35 | Temperature is separate evidence and never enters the index. |

These numbers are project-defined judgements, chosen to be simple and visible. No field,
mission or expert data were used to calibrate them, and no sensitivity study supports one
preset over another. The active normalized weights are recorded in every comparison and
export, together with `calibrated: false`.

`taskMeasures(stats)` adds no new measurement. It sums existing slope-histogram bins:
under 5° = bins 0–2° and 2–5°; under 10° = those plus 5–10°; at least 20° = bins 20–35°
and 35–90°. Shares are fractions of interior samples over the 1 km gradient baseline.

## Geological and mission context

- Jezero mission context: https://science.nasa.gov/mars/mars-2020/jezero-crater/
- Wadi Rum sandstone landforms: https://whc.unesco.org/en/list/1377/
- Al Wahbah volcanic-crater context: https://saudipedia.com/en/what-is-the-deepest-volcanic-crater-in-saudi-arabia
- Amboy field-photo archive: https://pds-geosciences.wustl.edu/missions/amboycrater/index.htm

These contextual sources support descriptions, not a measured materials score. The full challenge-supplied resource catalogue remains linked in `science.js`; sources that have not been used for numerical analysis are identified accordingly.

## Reproduction and validation

Run from the `terramatch` directory using Node 22 or newer:

```sh
node scripts/fetch-terrain.mjs
```

An optional list of site IDs retrieves only those windows, for example:

```sh
node scripts/fetch-terrain.mjs jezero shackleton
```

Network access is required only to regenerate datasets. The web application uses the bundled JSON files and does not require a NASA account or runtime Earthdata credentials. `dist/data/retrieval-manifest.json` records provenance for all bundled terrain products.

Validation performed: 87 assertions covering analytic planar slope, bilinear sampling, histogram normalization, invalid-input rejection, weight validation, finite real grids, physical extents, coordinate transforms including the Moon's polar projection, symmetric comparisons, valid score ranges and exclusion of the coastal bathymetric window.

NASA and other source agencies do not endorse this project. Their source policies and the challenge's non-endorsement statement remain applicable.
