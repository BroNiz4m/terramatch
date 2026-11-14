# Environmental evidence

This layer keeps original agency products, their dates and their physical definitions. It does not manufacture a global current-weather feed for Mars or the Moon. No environmental similarity score is added.

## Earth meteorology

`loadEarthEnvironment(site, options)` returns daily skin temperature (K), 2 m air temperature (K), corrected precipitation (mm/day), 10 m wind speed (m/s), and surface pressure (Pa). The default period is **1 January–31 December 2025**. Four exact-coordinate reference bundles cover Wadi Rum, Al Wahbah, Amboy and Lanzarote; each has 365 valid daily values for all five parameters. Other Earth coordinates request the original keyless NASA POWER API.

These are historical model/reanalysis values. Their meteorological grid is approximately 0.5° latitude × 0.625° longitude. They do not resolve a rover route, a particular rock or local shade. Daily wind is not a gust or storm diagnosis; precipitation is not a water mask. `TS` and `T2M` are physically different. C→K uses +273.15; pressure in kPa→Pa uses ×1000. Missing values remain null. An incomplete precipitation period has an available-day sum and no full-period total. [NASA Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/), [meteorological source methodology](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

Every bundle retains the original response, request URL, retrieval timestamp, source model identifiers, native units and SHA256. The bundled loader requires the exact reference coordinate and period; a moved coordinate cannot reuse the old site's values.

## Earth events

`fetchEarthEvents()` requests NASA EONET v3 with `status=open`, `category=severeStorms`, `days=30`, `limit=100`. Each geometry retains its reported date and magnitude units. `latestGeometry` means the latest **reported** geometry, not the storm's present position. NASA describes these metadata as approximate, intended for visualization/general information. Original reporting links are retained. A marker is not a hazard footprint. [EONET API](https://eonet.gsfc.nasa.gov/docs/v3), [scope and disclaimer](https://eonet.gsfc.nasa.gov/what-is-eonet).

`ready`, `empty`, `error` and `cancelled` are distinct. Empty results cannot establish absence of storms. `possiblyTruncated` is true when the response reaches the requested limit. `loadEarthEventsReference()` explicitly loads the separate **14 November 2026** snapshot; it never silently replaces a failed current request. It preserves its own retrieval timestamp, different from the 2025 meteorological period.

## Mars pressure

`loadMarsEnvironmentReference()` supplies historical Perseverance MEDA sol 29 pressure, covering **19–21 March 2021 UTC**. The full original CSV's MD5 matches the PDS4 label. All 50,926 samples are retained separately for BAROCAP1/2/3. Their available-sample means are approximately 751.261, 742.094 and 742.026 Pa. There is no combined or calibration-selected pressure. The 48 half-hour LMST bins include 11 missing bins; these remain null.

Uncertainty columns are blank. Positive finite-value screening is not full mission quality validation, so the record is labelled partial. Thermocap instrument temperatures are not used as air temperature. This product does not measure present weather, global conditions, wind or storm absence. [Original NASA PDS product directory](https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_calibrated_env/sol_0000_0089/sol_0029/).

## Body reference facts

`loadPlanetEnvironmentContext(body)` separates general agency references from observations. NASA documents Martian dust storms and polar/subsurface water ice, but these facts do not classify the chosen coordinate today. The Moon's exosphere cannot support Earth-style wind or precipitation storms; space weather is a separate, unimplemented layer. Lunar polar ice evidence is not a local abundance/accessibility map. No local land/water/ice mask is claimed. [NASA Mars facts](https://science.nasa.gov/mars/facts/), [lunar weather](https://science.nasa.gov/moon/weather-on-the-moon/), [lunar water](https://science.nasa.gov/moon/moon-water-and-ices/).

## Reproduce

Run `node scripts/fetch-environment-reference.mjs` to refresh original Earth records and the separately dated event snapshot. Run `node scripts/fetch-mars-pressure-reference.mjs --refresh` to download the original pressure CSV/label again; omit `--refresh` to derive from their existing verified bytes. No keys are required. Public POWER and EONET endpoints returned HTTP 200 and `Access-Control-Allow-Origin: *` during verification. Bundles provide stable initial access without an external request.

Run `node --test tests/environment-data.test.mjs`. Tests cover units, zero/missing distinctions, coverage, coordinate-specific caching, original hashes and reproduction, transport errors/cancellation, event timestamps, separate pressure channels, and missing uncertainty/intervals. No existing temperature or ranking modules are changed.
