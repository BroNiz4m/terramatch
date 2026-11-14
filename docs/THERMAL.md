# Surface thermal context

The thermal objective adds a separate evidence track to TerraMatch. Terrain
search and its resemblance index still measure slope distribution and relief.
Thermal evidence is not silently mixed into that index or used to rank a
planetary analog when the physical statistics are incompatible.

## Using the feature

1. Choose **Thermal environment study** under Exploration task, or open Compare.
2. Read the planetary and Earth records, including their dates, statistic and
   spatial footprint. Expand each source record for provenance and limitations.
3. Enter a terrain expedition and choose **Temperature**. Shackleton displays
   the source-derived spatial thermal field. Earth displays clearly labelled
   uniform coarse location context with a date slider for daily averages.
4. Rover point observations appear in Compare; they are not painted over an
   entire crater. Missing spatial coverage remains grey.
5. Inspect a terrain point to save its available thermal context alongside
   the elevation observation. Evidence JSON includes loaded thermal records;
   the Markdown report includes summaries, definitions and provenance.

## What the quantities mean

- Earth: NASA POWER TS, skin temperature from model/reanalysis products,
  daily averages during 2025, at a native 0.5° latitude × 0.625° longitude
  meteorological grid. Highest/lowest daily averages are not subdaily extremes.
  See [THERMAL-EARTH.md](THERMAL-EARTH.md).
- Moon: the Diviner South Polar Resource Product `temp_max`, annual maximum
  **surface** temperature calculated from thermal-model fits to observations.
  The product's `temp_avg` describes 2 cm depth and is deliberately unused.
- Mars: MEDA TIRS derived local ground brightness-temperature observations;
  only the retained source time span and footprint are represented.
  See [THERMAL-PLANETARY.md](THERMAL-PLANETARY.md).

The lunar spatial range describes **annual maxima across different places**,
not a daily or seasonal temperature range at one place. Rover brightness
temperature and Earth model skin temperature also have different measurement
definitions and temporal sampling. A shared Kelvin unit does not make these
records directly comparable. No cross-body thermal similarity score, thermal
survival simulation, ice detection or base-suitability conclusion is produced.

## Display and verification

The 3D thermal palette uses one fixed 40–400 K scale, with clipped endpoints
labelled. Missing values are grey. The thermal material is unlit and has no
decorative surface texture, so terrain lighting does not change the legend's
colour encoding. Numerical inspection retains the source value even if it
lies outside the display scale. Native data resolution is never implied by
the 500 m terrain sample interval.

Unit/data tests cover source decoding and provenance, missing values, units,
dates, asynchronous selection changes, exports, the Earth context date slider,
and the separation of rover point records from spatial maps. Expedition tests
exercise source sampling and material switching using a renderer test double;
they are not GPU or visual browser verification. Firefox computer-use testing
was previously stopped by the tool's Windows browser URL-policy limitation.

Final automated validation: **61 tests passed**, `npm run check` passed and
`git diff --check` passed on 14 November 2026. This does not establish
physical ground truth, thermal engineering suitability or browser GPU validation.
