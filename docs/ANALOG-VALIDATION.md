# Analog ranking validation — 15 November 2026

**Subsequent application update:** the owner approved displaying these findings.
Compare now explains shared ranks at displayed precision, point gaps, relief
saturation and the loaded-candidate scope. The original calculations and review
below are preserved; these UI explanations do not calibrate the method or perform
the external/spatial validation still recommended here.

**Follow-up case study:** [Jezero–Amboy](JEZERO-AMBOY-CASE-STUDY.md) now verifies
both existing height grids against their original sources, inspects Jezero MOLA
counts and tests local extent/center sensitivity. The 32 km score reproduces,
but the centered 16 km subset scores 55.3 rather than 86.7. This narrows the
supported interpretation to a limited regional-terrain desktop exercise; it
does not certify a geological match or a rover field-test site.

The existing terrain calculations reproduce independently, and the first-place
candidate is unchanged across the current terrain/navigation/fieldwork presets
for all six targets. **This is not scientific validation of whole-site analog
suitability.** The catalogue is small, geological processes differ, and two
targets lose all relief discrimination because of the formula's distance cap.

This review evaluates the **three eligible bundled Earth reference windows**
(Wadi Rum, Al Wahbah, Amboy) against the six bundled planetary targets at source
commit `b127b406c6ac374cf6e66fa43071e05f7eece5eb`. Lanzarote remains excluded.
Browser-local manual/automatic search windows, including the owner's earlier
Kuching result, were not available as input and were not evaluated here. This
is not a new regional/global search or identification of Earth's best analogs.

## Reproducible results

Every index below is on the project's 0–100 scale, **not a probability or percent
scientific match**. Gaps are index points against the second candidate at default
weights. The thermal preset uses the same 0.65/0.35 terrain weights and has the
same results as the default; it adds no thermal comparison.

| Target | Default first | Default index | Default second | Gap | Navigation first/index | Fieldwork first/index |
| --- | --- | ---: | --- | ---: | --- | --- |
| Jezero | Amboy | 86.7 | Wadi Rum | 22.6 | Amboy / 85.8 | Amboy / 87.3 |
| Shackleton | Wadi Rum | 35.2 | Amboy | 20.6 | Wadi Rum / 46.0 | Wadi Rum / 27.1 |
| Cabeus center | Wadi Rum | 69.4 | Amboy | 16.9 | Wadi Rum / 75.6 | Wadi Rum / 64.8 |
| Nobile center | Wadi Rum | 47.7 | Amboy | 18.6 | Wadi Rum / 59.9 | Wadi Rum / 38.5 |
| Gale / Bradbury | Wadi Rum | 51.7 | Amboy | 1.2 | Wadi Rum / 67.6 | Wadi Rum / 39.8 |
| Eberswalde delta area | Wadi Rum | 77.2 | Amboy | 4.1 | Wadi Rum / 80.5 | Wadi Rum / 74.7 |

All candidate scores and component distances, including Al Wahbah, are retained
in [the generated summary](research/analog-validation-2026-11-15/summary.md).
The [full results JSON](research/analog-validation-2026-11-15/results.json) contains
input SHA-256 values, source provenance, independently recomputed statistics,
all six preset/single-measure cases, a 101-scenario sweep, analytic intersections,
unrounded margins and rounded-score tie sets.

## Weight sensitivity

Let `w` be the normalized slope weight, with relief weight `1−w`. This review
evaluates w = 0, 0.01, …, 1 and solves pairwise score intersections analytically.
The full continuum is a research sensitivity exercise, not a new app slider.
Scenario frequencies or interval widths are not probabilities of being correct.

| Target | Unrounded first-place behavior across the complete weight range |
| --- | --- |
| Jezero | Amboy is first from relief-only to slope-only; it has smaller distances on both measures than the other two candidates. |
| Shackleton | Wadi Rum is first whenever slope has positive weight. Relief-only produces a three-way tie at index 0. |
| Cabeus | Amboy is first below w ≈ 0.160458; Wadi Rum is first above it. Both tie at the intersection. |
| Nobile | Amboy is first below w ≈ 0.149171; Wadi Rum is first above it. Both tie at the intersection. |
| Gale / Bradbury | Wadi Rum is first whenever slope has positive weight. Relief-only produces a three-way tie at index 0. |
| Eberswalde | Amboy is first below w ≈ 0.375381; Wadi Rum is first above it. Both tie at the intersection. |

All three unique task presets put w between 0.50 and 0.85. They lie on the same
side of each first-place crossover, explaining the unchanged leaders. This
does not calibrate the presets or establish that one chosen weight is best.

Jezero's *second* place changes between Wadi Rum and Al Wahbah at approximately
w = 0.671769. The leader remains Amboy. Rank stability must therefore distinguish
first place from the full ordering.

Scores are rounded to one decimal **before** the app sorts them. The validation
replicates that stable sort and also retains unrounded values. Top scores tie in
the 1%-step sweep at w = 0.16 for Cabeus, w = 0.15 for Nobile, w = 0 for
Shackleton, and w = 0, 0.01, 0.02 for Gale. In a tie, displayed row order can
reflect catalogue order; it is not evidence that one candidate is better.

## Relief saturation is a material limitation

The existing relief distance is capped at 1 once
`(larger relief + 1) / (smaller relief + 1) >= 4`. Both **Shackleton and Gale**
exceed that ratio against every eligible bundled Earth candidate:

| Window | Within-window relief |
| --- | ---: |
| Shackleton | 4,567.94 m |
| Gale / Bradbury | 4,526.86 m |
| Wadi Rum | 913.69 m |
| Amboy | 986.94 m |
| Al Wahbah | 448.45 m |

For those two targets, all three relief distances equal 1. At fixed positive w,
the index therefore simplifies to `100 × w × (1 − slope distance)`.
Changing the weight rescales the scores, but relief cannot distinguish any of
the three candidates. Wadi Rum's lead for Gale is only 1.2 displayed points at
default weights; this review provides no uncertainty model capable of treating
that gap as statistically significant. The larger gap at Shackleton does not
make its relief comparable: all three Earth windows still saturate the cap.

This is a disclosed property of the current heuristic, not a floating-point or
source-decoding error. The formula and weights were preserved; no alternative
calibration is justified by this small catalogue alone.

## Geological evidence and purpose-specific interpretation

The following separates primary-source context from project inference. None of
these sources validates the numerical TerraMatch index or independently certifies
the displayed target/candidate pair.

- [BLM's Amboy description](https://www.blm.gov/visit/amboy-crater-national-natural-landmark)
  identifies an ash/cinder volcanic cone, roughly 250 ft high and 1,500 ft across.
  The [PDS archive](https://pds-geosciences.wustl.edu/missions/amboycrater/index.htm)
  preserves photographs from field research in February 1976. This supports a
  documented field-study setting, not a newly discovered Jezero analog.
- [NASA's Wadi Rum account](https://science.nasa.gov/earth/earth-observatory/wadi-rum-jordan-49945/)
  describes granite and sandstone mountains with sandy valleys.
  [UNESCO](https://whc.unesco.org/en/list/1377/) documents sandstone landforms,
  erosion/weathering and protected cultural heritage. These are relevant Earth
  landscape facts, not measurements of matching lunar regolith or Martian lakebeds.
- [The IUGS geological description](https://iugs-geoheritage.org/geoheritage_sites/the-pleistocene-al-wahbah-dry-maar-crater/)
  identifies Al Wahbah as a volcanic maar produced by magma–groundwater interaction,
  about 2.3 km wide and 250 m deep, cutting older basement and volcanic units.
  An impact-like outline does not make its origin equivalent to a lunar crater.

| Target / default first | Potential exercise — project inference | Where the analogy fails / evidence still needed |
| --- | --- | --- |
| Jezero / Amboy | Practise regional terrain mapping, locating scientific stops and documenting surface materials in a known field setting. | NASA documents a [river/lake delta in Jezero](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/); Amboy's volcanic cone does not reproduce that depositional system. No mineral or sedimentary equivalence follows from 86.7. |
| Shackleton / Wadi Rum | Rehearse map reading and slope-aware survey planning at an Earth location, after separate field/site review. | [NASA describes Shackleton as a deep polar crater](https://svs.gsfc.nasa.gov/4716). The Earth window does not reproduce its relief, vacuum, illumination, polar thermal environment or lunar gravity. This is an operations-component suggestion, not a permanent-base analog validation. |
| Cabeus center / Wadi Rum | Compare broad slope distributions and practise documenting scientific questions with geolocated notes. | The crater-center window is not the LCROSS impact location. [LCROSS's polar water evidence](https://science.nasa.gov/mission/lcross/) is not evidence for ice at every point or at Wadi Rum. No cold-trap or ice-extraction analogy is established. |
| Nobile center / Wadi Rum | Practise terrain reconnaissance and organizing a prospective traverse at kilometre scale. | The [2021 Nobile announcement](https://www.nasa.gov/news-release/nasas-artemis-rover-to-land-near-nobile-region-of-moons-south-pole/) concerns a western-rim region, not this crater-center window. No equivalence in illumination, resources, communications or landing conditions is established. |
| Gale / Wadi Rum | Practise recording sedimentary outcrops and route-planning questions, after identifying appropriate local exposures independently. | NASA's [Gale overview](https://science.nasa.gov/resource/a-guide-to-gale-crater/) describes impact, lake deposition and later modification. Wadi Rum's landscape does not automatically reproduce that sequence or mineral assemblage. The small ranking margin and MOLA interpolation prevent a strong comparative claim. |
| Eberswalde / Wadi Rum | Practise geomorphic mapping and planning sampling/documentation workflows. | NASA's [Eberswalde account](https://science.nasa.gov/resource/eberswalde-delta-3-d/) concerns sediment deposited in a former water body. No comparable delta deposit in the specific Wadi Rum window was established. Fine delta channels are unresolved in this MOLA index. |

Al Wahbah is never uniquely first in the evaluated weight scenarios, but that does not
make it scientifically useless. It offers a different volcanic/maar field context.
The current index mainly asks about *window-scale* slopes and relief, not which
small feature best supports a particular geological lesson. That distinction
also prevents removing a candidate merely because it ranks third here.

The scale mismatch matters at Amboy: 1,500 ft is about 457 m, smaller than one
500 m sample interval. Its full 32 km window has 986.94 m relief, far exceeding
the cone's roughly 76 m height. Therefore the window score cannot be interpreted
as a resolved comparison of the Amboy cone itself against Jezero. Exact mapped
geological footprints and independent finer terrain would be needed for that
claim. Similar caution applies to the much smaller Al Wahbah maar inside its
32 km regional window.

No permits, accessibility, safety, contemporary weather or field itinerary was
validated. Suggested exercises are research directions, not travel instructions.
Earth operating conditions and living ecosystems are not lunar or Martian ones.

## Decisions and follow-up

1. Retain the existing terrain-only calculation as a transparent shortlist tool.
   The calculations reproduce, but there is no evidence to call these scientifically
   validated overall analog matches or calibrated mission recommendations.
2. Treat pure-relief zero-score ties and relief saturation explicitly when
   explaining Gale/Shackleton. A numbered row or an increased navigation score
   cannot establish improved geological similarity.
3. Preserve the catalogue limitation in every interpretation. Five targets sharing
   Wadi Rum as first place reflects the three available bundled candidates and
   chosen measures; it does not establish a global scientific preference.
4. Before claiming feature/process equivalence, acquire and map the relevant
   geological footprint and compatible material evidence. A volcanic cone,
   phreatomagmatic maar, impact crater and delta are not interchangeable.
5. Future validation should test window-center/extent sensitivity, independent DEM
   errors/interpolation, source effective resolution and expert/field judgement.
   Those remain untested by this weight exercise. Retain actual MOLA count limits
   from the planetary audit; weight stability does not remove source uncertainty.
6. A useful subsequent app change would expose close/rounded ties and saturated
   relief components next to the result. This report recommends that change but
   does not implement it or choose a new score threshold.

Thermal, ice, mineral, biology and physical-traversability equivalence remain
separate. No new ice module, combined similarity percentage or fabricated ground
truth was introduced.

## Verification and reproduction

```sh
node --check scripts/validate-analog-rankings.mjs
node scripts/validate-analog-rankings.mjs
git diff --check
```

The script recomputes relief and slope statistics directly from every bundled
height grid, independently of `analyzeTerrain`, and independently evaluates the
distance/score formula. It checks all preset and sweep results against production
functions, solves analytic intersections, preserves rounded and unrounded ties,
verifies Lanzarote exclusion and rejects an empty characteristic selection.
**6,078 numerical comparisons passed.** All ten production terrain-file SHA-256
values were checked before and after and remained unchanged.

The baseline was clean at `b127b40`. Only this report, a research script/results
and the handoff documentation were added/updated. No application file, source
dataset, score, weight, dependency, audience or deployment changed. The full app
suite was not rerun because this work adds no app behavior; its preceding release
passed 111 tests. Browser/GPU QA and external scientific validation are separate
and remain unverified. Context sources were read on 15 November 2026; their
geological descriptions were not converted into numerical equivalence scores.
