# Additional Moon/Mars targets — source audit, 15 November 2026

**Subsequent integration:** the owner later approved all four candidates. They are
now bundled targets in the application; see DATA.md and the latest HANDOFF.md
entry. The audit below is the preserved pre-implementation record. Its research
grids and original source bytes remain unchanged.

Four candidate windows have complete **research-only** terrain grids extracted
from original public NASA PDS products. They are technically feasible additions
for coarse terrain comparison, subject to the integration gates below. They are
not yet selectable application targets, validated Earth analogs, certified landing
sites or permanent-base recommendations. No application code or production data
was changed, and nothing was deployed as part of this audit.

The source requests, exact labels, retrieved byte strips, SHA-256 values,
geographic/projection definitions and derived grids are retained in
[research/planetary-target-audit-2026-11-15/probes.json](research/planetary-target-audit-2026-11-15/probes.json).
All four grids have 4,225 finite samples: 65 × 65 nodes over a projected
32 × 32 km window at 500 m spacing, with slopes over a 1 km baseline. This
sampling does not establish effective measurement resolution or field accuracy.

## Shortlist and observed terrain

Coordinates are north/east positive; negative longitude is west. These are
explicit study-window centers, not interchangeable crater or mission coordinates.

| Candidate | Center | Numeric source | Window relief | Mean coarse slope | Audit decision |
| --- | --- | --- | ---: | ---: | --- |
| Cabeus crater center | 85.33° S, 42.13° W | LOLA `LDEM_75S_240M`, V2.0 | 1,841.16 m | 6.43° | Feasible polar-terrain reference; no local ice or landing claim |
| Nobile crater center | 85.28° S, 53.27° E | Same LOLA product | 3,274.80 m | 8.58° | Feasible polar-terrain reference; not the historical VIPER western-rim site |
| Gale / Bradbury Landing | 4.5895° S, 137.4417° E | MOLA `MEGT00N090HB`, V2.0 | 4,526.86 m | 5.20° | Strong initial Mars addition for broad basin/slope context; disclose interpolation |
| Eberswalde delta area | 23.8° S, 33.7° W (326.3° E) | MOLA `MEGT00N270HB`, V2.0 | 1,456.60 m | 3.74° | Useful distinct sedimentary-landform context; fine delta channels unresolved |

Statistics above are calculated from the extracted grids. They are not source
accuracy estimates, native-product global extrema or measured robot traversability.
The audit did not calculate new Earth analog rankings or select a best match.

## Why these windows, and what an Earth analog could support

**Cabeus:** the [IAU/USGS Gazetteer](https://planetarynames.wr.usgs.gov/Feature/953)
provides the rounded crater-center coordinate. NASA's
[LCROSS mission record](https://science.nasa.gov/mission/lcross/) establishes the
crater's relevance to polar volatile research. The extracted center window is
not centered on the impact location, and does not establish that LCROSS evidence
applies at every grid point. An Earth field exercise could practice crater-scale
terrain documentation and survey planning. It would not reproduce vacuum,
lunar cold traps or measured local ice abundance.

**Nobile:** the [Gazetteer](https://planetarynames.wr.usgs.gov/Feature/4321) supplies
the rounded crater center. The
[20 September 2021 NASA announcement](https://www.nasa.gov/news-release/nasas-artemis-rover-to-land-near-nobile-region-of-moons-south-pole/)
concerns a region near the western rim. It is historical context, not confirmation
of current mission plans, and that location is not the center used here. This
window supports comparison of coarse polar-crater slopes and relief. A DEM alone
does not determine illumination, communication, ice, safe routes or base suitability.

**Gale:** the coordinate is the historical landing location published by
[Vasavada et al. (2014)](https://doi.org/10.1002/2014JE004622), not the crater center
or Curiosity's current position. NASA's
[Gale overview](https://science.nasa.gov/resource/a-guide-to-gale-crater/)
provides the basin and layered-sediment context. Potential Earth training includes
terrain survey, documenting sedimentary exposures and planning scientific stops.
Only slope/relief could enter the existing terrain index; lithology, biosignatures
and sedimentary equivalence require separate evidence.

**Eberswalde:** the project center follows the approximate coordinate on the
[HiRISE delta DTM page](https://www.uahirise.org/dtm/dtm.php?ID=PSP_001336_1560):
23.8° S, 326.3° E. This is deliberately a delta-area window, rather than one of
the alternative crater-center/control-network values in the Gazetteer. NASA's
[delta description](https://science.nasa.gov/resource/eberswalde-delta-3-d/)
supports landform context. An Earth sedimentary field exercise could practice
fan/delta mapping and sampling workflows, after independently checking geology.
No mineral classification, biological conclusion or modern water detection was
derived from MOLA. The HiRISE DTM page advertises 1 m pixels; **its DEM was not
ingested**, its footprint was not established as covering the full 32 km window,
and it is not substituted into a ranking with different native detail.

These field uses are project recommendations inferred from the cited context,
not field-validated analog relationships.

## Verified source access, registration and quality

### Moon

[LOLA archive](https://pds-geosciences.wustl.edu/missions/lro/lola.htm), exact
[label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.lbl)
and matching `.img`:

- Native grid: 3,812 × 3,812 signed little-endian 16-bit samples; nominal 240 m
  posting, true at the pole. Product V2.0, created 15 June 2017; label observation
  period 13 July 2009–2 February 2017.
- Height = DN × 0.5 m relative to a 1,737,400 m sphere. The radius offset is not
  added to elevation. Source frame: mean Earth/polar axis of DE421.
- South-polar stereographic projection, longitude origin 0°. The zero-based pole
  lies between four central pixels at index 1905.5, consistent with
  [ODE's polar-grid description](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/Lunar%20Reconnaissance%20Orbiter%20(LRO)/LOLA/GDR/GDRDEM.htm).
- Each window fetched one exact 1,029,240-byte strip, HTTP 206 with matching
  Content-Range. Every bilinear-support cell is inside the raster and valid polar
  latitude extent. Geographic bounds are computed for the actual study window;
  neither window is assigned the entire south pole's bounds.
- The 500 m interval is projected distance. Polar stereographic scale varies away
  from the pole, so a projected 32 km square is not an exact geodesic 32 km square.
  The existing application uses this projection convention; retain the distinction.
- The provider interpolates ground tracks. No separate lunar per-cell observation
  count or uncertainty layer was acquired. Finite values are not proof of direct
  measurements in every cell. No ice, permanent-shadow or current-temperature
  raster is produced by this audit.

### Mars

[MOLA MEGDR archive](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html):

- Each source tile covers 90° longitude × 44° latitude at 128 pixels/degree:
  11,520 × 5,632 signed big-endian 16-bit elevation samples. These two tiles cover
  0° to 44° S, with longitude ranges 90°–180° E and 270°–360° E.
- Native north–south posting is about 463 m; longitude spacing decreases with
  latitude. The output remains a 500 m sample, not a new high-resolution DEM.
- Positive-east, planetocentric IAU2000 coordinates. Heights are relative to the
  Mars areoid. Pixel centers retain the half-cell offset. Each topographic strip
  is 1,635,840 bytes; all interpolation supports stay within the selected tile.
- Labels report V2.0 and observations from 15 September 1997 to 30 June 2001.
  These are historical gridded data, not contemporary surface measurements.
- Corresponding `MEGC00N090HB` and `MEGC00N270HB` **8-bit unsigned** observation-count
  products were also fetched: 817,920 bytes per strip, with labels and hashes.
  Counts are inspected at the unique native cells used to interpolate the output.

| Window | Unique native support cells | Cells with count 0 | Output samples whose four support corners all have count 0 |
| --- | ---: | ---: | ---: |
| Gale / Bradbury | 5,041 | 3,579 | 2,157 / 4,225 |
| Eberswalde delta area | 5,467 | 3,469 | 1,625 / 4,225 |

Zero counts concern original source bins; the PDS topographic grid still contains
interpolated heights. Those heights are retained as supplied, not replaced or
described as direct observations. These counts are not percentages of positional
accuracy, confidence or analog suitability. The sparse track support is a material
limitation on fine topography, so the recommendation is **coarse regional terrain
context only**. Do not infer rover-scale hazards or that native posting equals
independent measured detail.

The local projection uses a spherical radius of 3,396 km and a cosine evaluated
at the center, matching the existing study-window method. Projection and source
interpolation effects remain; no new survey-grade geodetic accuracy is claimed.

## Deferred candidate and integration gates

Mawrth Vallis remains a reserve candidate. Search listings and the
[Gazetteer feature page](https://planetarynames.wr.usgs.gov/Feature/3763) expose
different center/control-network representations. A named valley hundreds of
kilometres long also needs an explicit local scientific target; its nominal
center is not automatically the historic landing ellipse or a clay outcrop.
No Mawrth numerical window was fetched. Do not silently choose a search snippet
as the authoritative coordinate.

Recommended implementation order: add **Gale/Bradbury and Eberswalde delta-area**
as the first Mars pair, and **Cabeus-center and Nobile-center** as additional
polar-terrain references. This recommendation is for a terrain-only expansion.
If the intended goal is a particular mission landing area or an ice study, choose
and re-audit that exact center before using the same names for a different window.

Before release:

1. Generalize `scripts/fetch-terrain.mjs`: its Mars path is hardcoded to Jezero's
   `MEGT44N000HB` tile. Select the source by latitude/positive-east longitude and
   verify full interpolation support and seam handling. Do not reuse Jezero bytes.
2. Use the actual polar-window bounds instead of its current broad south-pole
   bounds. Preserve pixel registration, source frame and projection round trips.
3. Add source-specific catalogue entries and descriptions. Correct the current
   destination-image caption fallback, which labels every non-Jezero target
   as LOLA; additional Mars hillshades must identify MOLA.
4. Propagate source-count/interpolation limits to source inspection and exports.
   No ground-truth or engineering suitability claim accompanies the index.
5. Keep new-target temperature explicitly unavailable until separately sourced.
   Existing planetary thermal records are restricted to Jezero/Shackleton; do not
   reuse MEDA rover measurements or Shackleton's thermal raster elsewhere.
   Historical pressure data must retain their actual rover-local footprint.
6. Exercise target switching, all existing task presets and characteristics,
   comparisons, both exports, projections, 3D terrain, arrival and missing thermal
   states. Repeat browser/GPU QA when supported. Existing tests that explicitly
   assert six bundled windows will require deliberate updates.

No stack change, global 1° geometry substitution, ice score or new environmental
dataset is necessary to make this bounded terrain expansion.

## Reproduction and checks actually performed

```sh
node --check scripts/audit-planetary-targets.mjs
node scripts/audit-planetary-targets.mjs
node scripts/verify-planetary-target-audit.mjs
git diff --check
```

The fetcher requests only bounded labels/byte strips (maximum 4 MiB per response)
and writes exclusively to the dated research directory. The offline verifier
checks saved source/label/grid hashes, reconstructs **all 16,900 heights** from
raw bytes using label-derived addressing, repeats statistics and observation-count
summaries, and exercises geographic/polar registration. All passed.

The evidence bundle contains 16 files totalling 7,161,621 bytes at audit completion.
HTTP-range hashes identify the retrieved source strips; full upstream IMG-file
checksums were not verified because the full products were not downloaded.
This establishes successful extraction and internal numerical consistency,
not external scientific validation. Full application tests were not rerun because
no application code/data changed. Browser/GPU QA remains unverified after the
Computer Use Windows URL-policy stop recorded in the preceding session.

Retain NASA/PDS, MOLA and LOLA team citations; the source label identities are
included in every derived grid. Context sources and the HiRISE page remain
separate from the products actually decoded. Agency data use does not imply
NASA, USGS or other-agency endorsement of TerraMatch or Wh0Knows.
