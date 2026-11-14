# Planetary surface-temperature context

Both planetary thermal records contain actual values retrieved from NASA's Planetary Data System. They are deliberately presented as **surface thermal context**, with no thermal similarity score: their statistics and observation supports differ from the Earth daily-mean skin-temperature reanalysis used elsewhere in TerraMatch.

| Target | Source quantity | Spatial support | Time/statistic | Values included |
|---|---|---|---|---|
| Shackleton region | Diviner PRP `temp_max` | Actual source facets sampled onto the existing 65 × 65, 32 km terrain window | Historical modeled annual maximum surface temperature | 4,225 values, 45.332–347.495 K; center 85.199 K |
| Jezero region | MEDA TIRS calibrated `GROUND_TEMP` | Rover-local radiometric footprint; no crater-wide raster | Selected observations during Perseverance sol 29, 19–21 March 2021 UTC | 50,954 retained observations, 187.53–278.85 K; 37 nonempty half-hour bins |

Kelvin is the stored canonical unit. Celsius display is `K − 273.15`.

## Moon: surface annual maxima from Diviner

Source archive: https://pds-geosciences.wustl.edu/missions/lro/diviner.htm

Exact source table:

https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab

Metadata label: same URL ending `.xml`.

The Polar Resource Product is based on thermal-model fits to Diviner polar observations, using a Kaguya-derived triangular mesh. It is a real archived derived product, **not a direct instantaneous temperature image**. Product DOI: `10.17189/1520650`. Model-method reference: Paige et al. (2010), `10.1126/science.1187726`.

The table has a 210-byte header followed by 2,880,000 fixed-length, 210-byte records. The `temp_max` field occupies bytes 188–195 within each record and is the annual maximum calculated at the surface. The `temp_avg` field describes a modeled annual average at **2 cm depth** and is not used. No surface-temperature estimate is taken from air-temperature data or from the ice-depth field.

The ingestion script downloads 71 exact source-table strips around the Shackleton window. Each range has its own byte count and SHA-256. For each of the existing terrain grid's 4,225 geolocations, it searches a local 7 × 7 mesh-cell neighborhood and selects the nearest actual facet centroid. Every chosen centroid is within 450 m; individual distances and source record numbers are retained. The source mesh is approximately 500 m, and its datum/model differs from the LOLA terrain DEM. The derived thermal display does not imply finer effective resolution.

The bundled record contains:

- All actual selected `temp_max` values, with no invented gaps or fitted values.
- The existing terrain window's exact south-polar stereographic projection.
- Source centroid coordinates, record numbers and distance-to-grid-point arrays.
- The 71 source byte ranges and hashes, plus metadata-label hash.
- Spatial minimum, maximum and mean of the annual maxima. That spatial mean is **not** an annual or instantaneous time mean.

The PDS4 product marks start/stop dates as inapplicable. The record therefore does not invent an exact calendar observation period or imply that the measurements were taken in 2025. There is no per-facet temperature quality flag in this PRP table; the model-fit origin and that limitation are explicit.

The raster is suitable for a clearly labelled modeled annual-maximum surface thermal layer. `samplePlanetaryThermal` returns the nearest sampled facet value and source metadata, or null outside the available window. It does not compute real-time shadows, illumination changes, ice occurrence, landing safety or habitat suitability.

## Mars: calibrated surface brightness observations from MEDA

Instrument/data documentation:

https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html

Exact source product:

https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_calibrated_env/sol_0000_0089/sol_0029/WE__0029___________CAL_TIRS________________P04.CSV

Metadata label: same URL ending `.xml`. MEDA dataset DOI: `10.17189/1522849`.

The source is calibrated version P04, and its actual field is **`GROUND_TEMP`**, described by its PDS label as ground brightness temperature in kelvin. The separate `AIR_TEMP` field is not used. The derived TIRS product was inspected; it provides irradiances rather than a directly corresponding derived `GROUND_TEMP` column, so this calibrated ground-brightness field is retained as its own documented quantity.

The initial full-file transfer timed out. The successful ingestion retrieved all 5,850,763 CSV bytes through 23 exact HTTP ranges, then verified the complete file against the MD5 supplied in its PDS label. Full-file SHA-256, range hashes, label hash, product version and field are recorded.

The source contains 51,247 rows. The selected data retain 50,954 rows after rejecting 293 observations with a moving-rover flag. Each retained sample must have known-good low-tilt, unshadowed-ground-footprint and stationary-rover flags. Explicit bad wheel-obstruction, HGA and SkyCam flags are rejected when supplied.

**Quality is incomplete:** wheel, HGA and SkyCam advisory flags are blank in this source product and are recorded as UNKNOWN, never assumed good. Counts and the filtering rule are included in `quality`; `qualityComplete` is false. The per-sample `GROUND_TEMP_UNCERTAINTY` field is also retained through bin summaries. Its bin average is the mean reported measurement uncertainty, not a propagated uncertainty of the bin mean.

The reported 220.457 K mean is the arithmetic mean of retained observations. It is not a full-sol or Earth-day mean. Source measurements follow an irregular acquisition pattern, and quality filtering can further bias time coverage.

For plotting, observations are grouped into 48 possible half-hour **local mean solar time** bins:

- 37 bins contain available observations, represented by their arithmetic mean.
- 11 bins are explicitly `valueK: null`, with `count: 0`; they are not interpolated or connected as if observations exist.
- `summary.sampleCount`/`validCount` = 50,954 raw retained observations.
- `summary.binCount` = 37 nonempty means.
- `seriesStatistic` identifies these as 30-minute means.
- `lmstSeconds` gives the actual bin-midpoint offset (900, 2,700, … seconds), and labels use `00:15`, `00:45`, etc. The time axis therefore retains gaps and honest spacing.
- Source UTC start/stop are taken from the PDS label: `2021-03-19T23:33:20.096Z` to `2021-03-21T00:11:52.795Z`. Individual CSV rows use LMST/LTST and spacecraft clock; no unsupported UTC conversion is invented.

The representative sol 29 rover location is 18.44516437° N, 77.4518217° E, from NASA's actual end-of-drive waypoint record:

https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json

Its source hash, sol and rover-motion-counter identifier are retained. That coordinate is not claimed to be the exact instrument footprint for every observation. It differs from the center of TerraMatch's Jezero terrain window. Rover-local observations are **not painted across the entire crater**: this record has no spatial raster, and geographic thermal sampling returns null.

Brightness temperature depends on the radiometric band and retrieval assumptions; it is not automatically identical to thermodynamic skin temperature.

## Comparability with Earth

These records have the same broad surface-thermal subject, but differ in statistic, spatial support, season, time coverage and processing:

- Earth: daily-mean skin-temperature reanalysis, with its own coarse grid and calendar period.
- Moon: modeled annual maximum surface temperature on historical triangular facets.
- Mars: sampled-sol calibrated ground brightness observations near a rover, with incomplete advisory flags.

Both planetary records set `comparability.scoreEligible: false` and explain the mismatch. They support contextual inspection and source-aware visual explanation, not a fabricated combined thermal match percentage. A future thermal similarity method would require compatible metrics and appropriate treatment of emissivity, observation time, local seasons, spatial support, model/measurement differences and uncertainties.

## API and reproduction

Module: `dist/js/planetary-thermal.js`.

```js
await loadPlanetaryThermal(siteOrId, {signal});
validatePlanetaryThermal(record);
samplePlanetaryThermal(record, latitude, longitude);
planetaryThermalContext(record);
```

The sampler returns `{available, valueK, valueC, method, statistic, sourceDistanceMeters, sourceRecord, row, col}` for supported lunar coordinates, otherwise null. Unsupported targets return explicit unavailable records. Missing source files or invalid records raise an error; they are not replaced by generated thermal values.

Rebuild source-derived records with Node 22:

```sh
node scripts/fetch-planetary-thermal.mjs
```

An optional site ID limits the retrieval: `shackleton` or `jezero`. If ingestion cannot complete, the script writes an explicit unavailable record with the actual failure reason rather than fabricated numbers. Both committed records are currently available and passed source/schema validation.

## Verification

Thirteen dedicated tests passed: surface/depth field distinction, fixed-width parsing, actual raster completeness and projection, byte-range provenance, geographic sampling and bounds, calibrated ground-field selection, raw/bin count separation, null gaps and midpoint spacing, incomplete-flag disclosure, rover-only spatial support, record validation, CSV quoting and bundled-record loading/cancellation.

No endorsement by NASA or other source agencies is implied.
