# Earth thermal context: actual NASA POWER TS

TerraMatch retrieves **Earth Skin Temperature (`TS`)** from the public NASA POWER
Daily Point API. This is **daily-mean model/reanalysis surface skin temperature**,
not a direct satellite land-surface-temperature retrieval and not the `T2M`
2-metre air-temperature parameter. No image colors are sampled to create numbers.

The four bundled reference records report `header.sources: ["MERRA2"]`. NASA
POWER's meteorological record derives from NASA GMAO's MERRA-2 assimilation model;
recent low-latency periods may use GEOS-IT. Live records retain the exact source
product names and API version returned by POWER rather than assuming MERRA-2.

## Physical and temporal definition

- Native meteorological grid: **0.5° latitude × 0.625° longitude**, representing
  coarse model-grid conditions rather than the particular terrain point or a
  32 km DEM window. Coastal cells can include marine influences; in particular,
  Lanzarote's context is not a pure inland land-surface measurement.
- Requested reference period: **2025-01-01 through 2025-12-31**, inclusive.
- Each daily `TS` value is a **daily mean** in the provider's Celsius units.
  Canonical app units are Kelvin: `K = °C + 273.15`.
- The request explicitly specifies `time-standard=LST`. Here **LST means Local
  Solar Time**. It is not an abbreviation for land surface temperature.
- Monthly values are the arithmetic mean of the available daily means within the
  requested part of each month. Missing values are not imputed.
- Summary minima/maxima are **minimum/maximum daily means**, not instantaneous,
  daytime, nighttime, daily-minimum, or daily-maximum surface temperatures.
- One year is period-specific context, not a multi-decade climate normal.

Temperature is intentionally separate from terrain ranking. Earth daily model
means and lunar/Martian products may have different sampling times, physical
definitions and resolutions. No cross-body thermal similarity score is claimed.
A uniform scene tint can illustrate a chosen point-series value; it must be
identified as uniform context, not a pixel-resolved thermal map.

## Browser API and records

`dist/js/earth-thermal.js` exports:

```js
loadEarthThermal(site, { signal, start, end, timeoutMs, preferBundled, refresh })
fetchEarthThermal({ lat, lon, start, end, signal, timeoutMs })
parsePowerThermalResponse(payload, options)
buildEarthThermalURL(options)
DEFAULT_EARTH_THERMAL_PERIOD
EARTH_THERMAL_SOURCE
clearEarthThermalCache()
```

Dates may be `YYYYMMDD` or `YYYY-MM-DD`. An unchanged reference site and the default
period use the local 2025 bundle. Newly selected coordinates or other periods
request numeric data from POWER. Completed successful records are session-cached.
`refresh: true` bypasses both reference bundles and cache. Live requests default
to a 15-second timeout and accept an AbortSignal.

Records distinguish `ready`, `partial`, `no-data`, `error` and `cancelled` states.
Series points have `{time: "YYYY-MM-DD", valueK: number | null}`. The API's `-999`
fill value, absent days, and invalid numeric values become null, never zero.
Summaries retain valid/missing counts and coverage. Actual time bounds describe
the first and last valid daily mean, distinct from the requested period.

Provenance includes the exact request URL, retrieval timestamp, API version,
returned source model names, source-native units, fill value, model resolution,
and SHA-256 of the unchanged API response bytes. Browser hashes use WebCrypto;
if unavailable, the live hash is explicitly null rather than fabricated.

## Bundled data and reproducibility

`dist/data/earth-thermal-{wadi-rum,al-wahbah,lanzarote,amboy}.json` contain normalized
records. Corresponding `*-raw.json` files retain the original NASA responses.
All four 2025 records have **365 valid daily means** and 12 monthly aggregates.

| Reference | Minimum daily mean (K) | Maximum daily mean (K) |
| --- | ---: | ---: |
| Wadi Rum | 276.98 | 310.26 |
| Al Wahbah | 283.78 | 313.66 |
| Lanzarote | 292.21 | 298.23 |
| Amboy Crater | 277.88 | 313.61 |

Each normalized record carries its raw SHA-256 and exact coordinates. To fetch
the references again from NASA:

```sh
node scripts/fetch-earth-thermal.mjs
node scripts/fetch-earth-thermal.mjs wadi-rum
node --test tests/earth-thermal.test.mjs
```

Tests cover Celsius/Kelvin conversion, valid zero Celsius, fill/null handling,
missing days, leap dates, monthly aggregation, request coordinates, HTTP/network
errors, timeout/cancellation, and SHA-256 correspondence to the retained raw files.

## Primary documentation and acknowledgement

- NASA POWER Daily API:
  <https://power.larc.nasa.gov/docs/services/api/temporal/daily/>
- NASA POWER meteorological sources and model resolution:
  <https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/>
- NASA Earthdata's POWER service identifies `TS` as Earth Skin Temperature:
  <https://gis.earthdata.nasa.gov/portal/rest/services/POWER/POWER_MONTHLY_METEOROLOGY_LST/ImageServer/multiDimensionalInfo>
- Example exact numeric request:
  <https://power.larc.nasa.gov/api/temporal/daily/point?parameters=TS&community=RE&longitude=35.419&latitude=29.575&start=20250101&end=20251231&format=JSON&time-standard=LST>

Acknowledgement: **NASA POWER Project, NASA Langley Research Center; NASA GMAO
MERRA-2 source model products.** The data are publicly accessible without an API
key. No endorsement of TerraMatch by NASA is implied.
