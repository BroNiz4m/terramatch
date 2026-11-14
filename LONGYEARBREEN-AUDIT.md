# Longyearbreen candidate audit — 15 November 2026

**Decision: defer this 32 × 32 km window as a ranked Earth reference.** A real,
dated glacier polygon was acquired and verified, but independent, more detailed
land mapping contradicts the application's coarse all-land screen. This is a
completed candidate assessment with a negative release decision, not an ice
module or a validation of overall lunar analog suitability.

The application baseline is `ad39d656a834fa9cae3a342ab177e39dfdfdeddd`.
All work is research-only. Production files, formulas, source datasets and the
live Site are unchanged.

Subsequent implementation: the coastal-screen release documented in LANDMASK.md
adds the more detailed checks to runtime searches and rechecks saved windows.
The old coarse-only eligibility behavior described below is this audit's
historical baseline; it has now been corrected for runtime searches. This does
not add Longyearbreen as a bundled analog or implement an ice module.

## What was obtained

The selected window is centered at **78.17551° N, 15.47693° E**, the rounded
midpoint of the 2016 GLIMS bounds inspected in the preceding source audit. It is
an explicit, reproducible choice rather than an optimized center or an approved
field destination. The acquired 2020 polygon contains this center.

| Evidence | Verified result | Limit |
| --- | --- | --- |
| NPI glacier inventory | Longyearbreen, `IDENT=14204`, `OBJECTID=637`, `YEAR=2020` | Historical mapped extent; individual image acquisition day is not supplied |
| Complete outline | One polygon, 96 coordinates including closure, no inner rings in the returned feature | Not a bounding rectangle or an inferred mask; does not inventory other glaciers |
| Projected area | 2.294342 km² reported; 2,294,342.27476677 m² recomputed from the EPSG:25833 outline | Projected map area, not a new field measurement or an ice-volume estimate |
| Terrain | All 4,225 heights reconstructed from four original Terrarium PNG tiles | Mixed-source elevation, not a homogeneous locally validated DEM |
| Coarse application land screen | 25/25 points mapped as land at 1:110 million scale | Misses coastal detail in this window |
| Independent land screen | 17/25 points mapped as land at 1:10 million scale | Still generalized cartography, not a precise or contemporary shoreline survey |

The outline is from the Norwegian Polar Institute's [2020 inventory map
service](https://geodata.npolar.no/arcgis/rest/services/Temadata/I_Isbreer_Overflatetyper_og_utstrekning_Svalbard/MapServer/4).
The [inventory catalogue](https://data.npolar.no/dataset/1b8631bf-7710-449a-a56f-0da1a4fef608)
describes digitization using summer 2020 Sentinel-2 imagery. Its citation is:
Lith, A., G. Moholdt and J. Kohler (2021), *Svalbard glacier inventory based on
Sentinel-2 imagery from summer 2020*, Norwegian Polar Institute,
[DOI 10.21334/npolar.2021.1b8631bf](https://doi.org/10.21334/npolar.2021.1b8631bf).

The catalogue now also mentions a revised 2026 inventory. The live map layer
does not expose an explicit inventory release identifier. This audit identifies
the exact service, year, feature attributes and byte hashes; it does **not** claim
to have the latest release. Reconcile the release identifier and final citation
before any production bundling. © [Norwegian Polar Institute](https://www.npolar.no/),
based on Copernicus Sentinel-2 imagery. The institute's free map products use
[CC BY 4.0 terms](https://geodata.npolar.no/bruksvilkar/).

The GLIMS record `994985` remains a separate observation dated **2016-08-23**,
with a provider area of 1.59787 km². Its bounded KML export redirects to Earthdata
Login, so a full **2016 GLIMS polygon was not acquired**. No login was attempted.
The acquired geometry is NPI's 2020 outline. Different mapped areas from these
two sources do not establish a glacier growth/retreat trend or a consistent
time series; outline definition and processing may differ.

## Window coverage and eligibility

Bounds are approximately west **14.77473°**, east **16.17913°**, south
**78.03162°**, north **78.31940°**. The entire glacier polygon lies inside this
window. Every elevation sample was retrieved and checked, including the edges.

The independent coastline source is [Natural Earth 1:10 million land
polygons](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/),
obtained from its maintainer repository. **“10m” means map scale 1:10 million,
not 10-metre resolution.** Made with Natural Earth; public domain. The complete
source bytes are archived with a SHA-256 hash because the upstream `master`
URL is mutable. Complete intersecting polygon parts were selected without
simplification or replacement by bounding boxes.

Eight of the same 25 screening positions disagree with the bundled 1:110m
mask. On the full 65 × 65 sample grid, 2,975 points map to land and **1,250 map
outside land** in the more detailed source. These are point counts, not measured
land/water area percentages. Only ten grid points fall within the one acquired
Longyearbreen outline; that is not a total window glacier-cover estimate.

This evidence is sufficient to reject a claim that the complete window has
verified terrestrial coverage. It does not certify exact shorelines, all inland
waters, or present-day conditions. NPI's basemap query and identify operations
returned unsupported-operation errors, so they were not used as independent
land confirmation. No sea boundary was derived from map colors.

**Important application limitation:** the unchanged runtime loader currently
marks this window `comparisonEligible:true` from its coarse 25/25 screen. The
research decision explicitly overrides that interpretation for this candidate;
no runtime fix, mask replacement or source-code exception was implemented.
Do not promote the raw loader flag as verified coverage or add this candidate
to bundled rankings. A future coverage-screen improvement needs its own scope.

## Terrain findings

The loader used zoom-8 Terrarium tiles, approximately **125.30 m tile-pixel
spacing at the center**, bilinearly sampled on the application's 500 m grid.
Pixel spacing is not underlying DEM accuracy or effective source resolution.
The 32 km dimensions use the existing local-equirectangular convention, not a
claim of an exact geodesic square at every latitude.

| Computed diagnostic | Value |
| --- | ---: |
| Elevation range | −279.19 to 1,001.47 m |
| Relative relief | 1,280.66 m |
| Mean sampled slope | 7.6103° |
| 90th-percentile sampled slope | 15.6622° |
| Slope samples / gradient baseline | 3,969 / 1 km |

These full-window diagnostics include the disputed coverage and are **not**
promoted to analog rankings. There are 1,085 negative height samples; negative
elevation was not used to classify water. No local DEM acquisition epoch,
vertical-datum consistency or error distribution was established. The
[Tilezen attribution requirements](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
apply to the mixed-source tiles; no claim is made that all input is NASA data.

## Verification and saved evidence

Run the offline verifier with the saved source files:

```sh
node scripts/audit-longyearbreen.mjs
```

To intentionally refresh this audit's public sources and research outputs:

```sh
node scripts/audit-longyearbreen.mjs --fetch
```

The fetch mode never writes application data. A changed provider outline or
coastline can invalidate a previous result; verification fails rather than
inventing substitute data. Downloads are bounded, time limited, and limited to
the selected glacier query, one coastline file and four terrain tiles.

Checks passed for saved-source hashes, closed finite simple rings, Svalbard
coordinate bounds, full outline containment, center-in-polygon, hole retention,
independent EPSG:25833 registration (maximum computational discrepancy about
0.00079 m), and projected area reconstruction. This submillimetre computational
agreement is **not positional accuracy of the glacier observation**.

All 4,225 rounded heights reconstruct exactly from archived PNG pixels. An
independent grid-difference calculation reproduces terrain statistics, and
independent point-in-polygon parity agrees on all 25 coastline-screen points.
Fingerprints of all 43 production data files and the two imported science/search
modules remain unchanged. No browser/GPU QA is claimed for this research audit.
`node --check scripts/audit-longyearbreen.mjs`, the offline verifier,
`npm run check` (38 JSON datasets), and `git diff --check` pass. The unchanged
application test suite was not rerun for this report-only step.

Saved artifacts are in
[research/longyearbreen-audit-2026-11-15](research/longyearbreen-audit-2026-11-15/):
`results.json`, `sources.json`, `terrain-window.json`, `longyearbreen-2020.geojson`,
`local-land-10m.geojson`, `grid-screen.json`, original compressed vector responses,
and the four original elevation PNGs. Contact details and authentication/session
parameters are not retained in the metadata extracts.

## Next decision

Retain this as verified **historical mapped-glacier evidence**, but defer the
chosen window as a ranked Earth reference. The next candidate search should
favor an inland polar window with independently verified land coverage and
dated ice geometry. Do not silently move the window, bypass the coverage rule,
claim contemporary ice, or infer thermal/physical equivalence to lunar polar
ice. Ice-associated mapping and instrument-documentation workflows remain
possible research uses, subject to separate field and scientific review.
