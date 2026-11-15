# Automatic location-pair search — 15 November 2026

The new Explore dashboard searches source-derived terrain descriptors for
Earth–Moon and Earth–Mars pairs. It does not substitute the six bundled targets
for a failed search. Manual search and existing references remain available.
The generated design image is a layout reference; it is not a data source.

## Data path on the existing static hosting

Raw PDS IMG responses inspected during implementation did not expose a browser
CORS permission. The solution is to distribute exact numeric source values in
small, same-origin compressed tiles. No proxy, new backend, credentials, AI
terrain, colour-to-height inference or hosting migration is required.

| Body | Original source | Native posting | Regional analysis |
| --- | --- | --- | --- |
| Earth | Mapzen/Tilezen Terrarium mixed-source elevation tiles, fetched for newly sampled coordinates | Source- and latitude-dependent; original metadata retained | Existing 500 m window sampled onto the common 2 km comparison grid |
| Mars | NASA MGS MOLA `MEGT90N000FB.IMG`, MEGDR 32 ppd, version 2.0 | Approximately 1,853 m north–south | 32 km square, 17 × 17 grid, 2 km spacing |
| Moon | NASA LRO LOLA `LDEM_16.IMG`, version V3.1 | Approximately 1,895 m north–south | Same nominal extent and analysis spacing |

Source URLs, original full-file SHA-256, byte length, observation dates, original
label SHA-256, native registration, coordinate frame and vertical datum appear in
`dist/data/search-atlas/manifest.json`. Original PDS labels are bundled alongside
it. The atlas has 324 twenty-degree tiles, 12,000 indexed coordinate areas and
about 91 MB of compressed data; individual searches request only needed tiles.

Each tile stores original signed 16-bit source DNs as reversible row differences
modulo 65536, then gzip-compresses them. Decoding restores the DNs exactly. LOLA
heights use the original ×0.5 m scale; MOLA topography uses metres relative to the
Mars areoid. Regional heights are bilinear samples at original pixel-center
registration, including longitude-seam support. No source precision is invented.

Source posting and output spacing are not effective measurement accuracy. Both
products interpolate between altimeter tracks. Per-cell observation counts and
uncertainty layers were not acquired for this atlas; that is disclosed. Equal
analysis spacing does not equalize instrument accuracy. Local equirectangular
32 km extents are approximate physical extents away from their central latitude.

## What the button actually searches

1. Read the SHA-verified planetary indexes for Moon, Mars or Both. Each has
   6,000 centers on a 3° latitude/longitude lattice, from 73.5°S to 73.5°N.
   These descriptors were computed from the original numeric DEMs. They are
   not hand-selected successful pairs. Arbitrary planetary window centers up to
   75°S/75°N are supported by the numeric reader; this UI searches the index.
2. Generate a spatially distributed sample of 6, 12 or 24 new Earth centers
   within the chosen region. Fetch actual Terrarium tiles. Apply the existing
   coarse and detailed coastline checks and known-water exclusions. Register
   full terrain/source evidence even when a window is excluded from scoring.
3. Resample Earth to the 2 km comparison grid. Apply the requested condition:
   balanced accepts all eligible terrain; gentle requires mean regional slope
   ≤2°; rugged requires relief ≥500 m and mean regional slope ≥1°. These
   thresholds are project-defined, not mission requirements.
4. Compare eligible Earth descriptors with every indexed planetary descriptor
   satisfying the condition. Use the disclosed 0.65 slope / 0.35 relief index.
   Shortlist up to two targets per Earth area per body. Reserve space for both
   bodies when requested; show up to 12 pairs.
5. Fetch the shortlisted planetary numeric tiles, verify hashes, decode complete
   32 km grids and recalculate the pair measurements. Publish only completed
   pairs, with source metadata, failures, exclusions and cancellation status.

The index uses the existing six slope bins [0,2,5,10,20,35,90]°. Very gentle
landscapes can share one bin and receive similar or rounded-100 scores even when
their detailed terrain differs. The UI also gives measured mean slopes, relief
and histogram distances. A 100/100 index is not exact terrain equivalence,
scientific confidence, newness, a probability, or mission suitability.

Sampling is not exhaustive on Earth or either planetary surface. No geographic
novelty or previously unvisited status is inferred. The product proposes a
terrain-based candidate analog relationship for follow-up literature and field
assessment. It does not establish matching geology, minerals, thermal conditions,
illumination, ice, safety, access, permits or operating conditions.

## Dashboard and comparison

Automatic search is the initial mode. Target-region and detailed mission controls
are shown in Manual search. Pair results sit beneath the globe; selecting one
updates both locations and the right evidence panel. Planet previews switch the
actual agency-mosaic globe. Regional thumbnails are explicitly labelled DEM
shaded relief, not site photographs or mineral/imagery reconstructions.

Selecting a pair focuses its Earth marker and draws a connector to the matching
Moon or Mars preview. Its Earth endpoint follows the actual projected globe
coordinate during rotation, zoom and resizing. The line is hidden when that
point is behind the globe, outside the viewport, or another body/manual mode is
shown. This is a comparison relationship, not a travel path or physical distance.

Compare opens a table of every discovered pair and the selected pair's detailed
charts. The existing all-Earth ranking against a single target remains available
as additional evidence. All charts, characterization and source records use
the correct common analysis spacing. Reference-only comparisons keep their
500 m grid and 1 km gradients. The 3D scene uses the selected area's real DEM
and its own native application-grid statistics. Robot and rock meshes remain
illustrations. New planetary coordinates never inherit Jezero/Shackleton
temperature records.

Evidence JSON includes the search record, all pair summaries and provenance;
Markdown adds a pair table and coverage/failure record. Earth's existing last-24
window cache remains. Planetary windows and pair lists currently last for the
browser session; their static source tiles remain available for a repeat search.

## Reproduce and verify

```sh
node scripts/build-search-atlas.mjs --fetch
node scripts/verify-pair-search.mjs
node scripts/verify-pair-search.mjs --live
npm run check
npm test
```

The builder caches original IMG/label files in the workspace's
`output/search-atlas-sources/`, outside the repository. Without `--fetch` it uses
those cached original sources only. The independent verifier compares browser
windows with the original raw IMG bytes, including dateline and tile-seam cases,
then checks indexed descriptors against decoded grids. It records results in
`research/pair-search-validation-2026-11-15/results.json`.

The 15 November live run loaded 6 genuinely new Earth windows, searched 6,000
Moon plus 6,000 Mars index centers, and materialized 12 pairs with zero fetch
failures in that run. Source replay checked 8,670 heights in 30 windows and 24
index entries. This verifies data transport/calculation, not scientific analog
validity. Functional DOM tests cover the button, pair selection, both bodies,
Compare, exports, coverage exclusions, integrity failure and partial cancellation.
They are not visual/GPU QA.

## Demo flow

Open Explore → Automatic search → Both → Balanced terrain → Find matching
locations → choose a pair under the globe → read coordinates, slopes, relief
and provenance → Compare this pair → inspect all pairs and selected charts →
export the evidence. Use Advanced options for a smaller quick sample or a
different Earth region. Describe results as candidate terrain analogs requiring
further assessment; do not describe the sampled search as exhaustive.
