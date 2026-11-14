# TerraMatch — handoff

This file records work done outside the Codex conversation so that Codex and other
developers can continue from the current workspace.

## 2026-11-14 — Claude Code: text, data-script safety and source-catalogue fixes

### 1. Task and scope

After a read-only code review, the project owner asked for three of four reported
minor issues to be fixed:

1. **Joined words / missing spaces** in user-visible text, exports, source notes and
   source-derived metadata strings (for example `Challenge2026`, `Paige et al.2010`,
   `GROUND_TEMP,sol29`, `within450m`).
2. *(Not requested; not changed.)* The Sources view labels `terrarium` and
   `natural-earth` as "CONTEXT / CHALLENGE RESOURCE" although on-demand searches use
   them as analysis data (`dist/js/app.js`, `inUse` set in `renderSources`).
3. **Data-loss risk**: a failed run of `scripts/fetch-planetary-thermal.mjs` (for
   example offline) overwrote the existing, validated `shackleton-thermal.json` /
   `jezero-thermal.json` with an `available:false` record.
4. **Duplicated `SEARCH_SOURCES`** in `dist/js/terrain-search.js` and
   `dist/js/search-ui.js`, with inconsistent Open-Meteo licence text.

No scientific values, scores, methods, datasets, features, hosting configuration or
Git history were changed.

### 2. Files changed

| File | Change |
| --- | --- |
| `dist/js/app.js` | Markdown report text: spacing after `;` and `,`; `Challenge 2026`. |
| `dist/js/planetary-thermal.js` | Source catalogue text: `Paige et al. 2010`, `DOI 10.17189/1522849`, `Mars 2020`. |
| `scripts/fetch-planetary-thermal.mjs` | Same text fixes for future regenerated records (`sol 29`, `Sol 29 hh:mm LMST`, `within 450 m`, `local 7 × 7`, `calendar 2025`, `field 188..195`, `2 cm depth`, `Mars 2020 … GROUND_TEMP, sol 29, P04`). `main()` now keeps an existing `available:true` record when ingestion fails and sets exit code 1. |
| `scripts/fetch-terrain.mjs` | `signed16` → `signed 16-bit` in the LOLA sampling note. |
| `dist/data/jezero-thermal.json` | Metadata text only: `coordinates.note`, `source.title`, the 48 `series[].time` labels (`Sol29 …` → `Sol 29 …`). |
| `dist/data/shackleton-thermal.json` | Metadata text only: `raster.sampling`, `temporal.note`, `source.method`, `quality.ignoredField`. |
| `dist/data/shackleton-terrain.json` | Metadata text only: `source.sampling`. |
| `dist/js/terrain-search.js` | `SEARCH_SOURCES` is now the single canonical catalogue (merged wording; consistent licence). |
| `dist/js/search-ui.js` | Imports and re-exports `SEARCH_SOURCES` from `terrain-search.js`; its duplicate array was removed. `app.js` imports are unchanged. |
| `tests/planetary-thermal.test.mjs` | One test name and one regex updated from `2cm` to `2 cm` to match the corrected metadata. |
| `THERMAL-PLANETARY.md` | Documents the new keep-existing-record behaviour. |

### 3. Status

- Done: issues 1, 3 and 4.
- Not done: issue 2 (owner did not request it).
- Not changed: other test names that also lack spaces (for example
  `lunar thermal raster iscomplete65×65…` in `tests/planetary-thermal.test.mjs`).
  They are not user-visible.

### 4. Technical decisions

- **Data JSON edited as text, not re-serialized.** Only the listed string values
  changed. Every numeric value, array, hash and byte range is byte-identical, and the
  files still parse. These strings are TerraMatch-authored metadata, not source bytes.
  No recorded SHA-256 covers these JSON files (the hashes cover source archive bytes,
  POWER raw responses and the land mask).
- **The script fix is fail-safe instead of silent.** A failed ingestion with an
  existing available record logs the reason, keeps the file and sets
  `process.exitCode = 1`, so automation still sees the failure. If no available record
  exists, the previous behaviour stays: an explicit `available:false` record with the
  failure reason.
- **Canonical `SEARCH_SOURCES`** keeps the wording previously shown in the Sources view
  (from `search-ui.js`) and adds the details that were only in `terrain-search.js`
  (EPSG:3857, Joerd attribution, the 110m dataset URL). Open-Meteo licence wording:
  free API for non-commercial use, data CC BY 4.0, GeoNames CC BY 4.0. Source ids are
  unchanged, so `search-cache.js` validation and cached windows keep working.

### 5. Data sources

No new data sources, products or retrievals were added. No network data were fetched
for the application datasets.

### 6. Method and scientific limits

Unchanged. The terrain index, thermal records and their documented limitations are
exactly as before.

### 7. Tests actually run (Windows 11, Node v25.2.0, npm 11.6.2)

- `npm ci`: installed the dev dependency (`happy-dom`) into `node_modules/`, which is
  git-ignored.
- `npm run check`: passed ("Checked application modules, local 3D engine and 17 JSON
  datasets").
- `npm test`: **61 tests, 61 passed, 0 failed**.
- Offline simulation of `scripts/fetch-planetary-thermal.mjs` on a scratch copy outside
  the repository, with `fetch` replaced by a function that throws:
  - Both thermal records existed: both were kept byte-identical (SHA-256 compared) and
    the exit code was 1.
  - `jezero-thermal.json` removed: an `available:false` record with the failure reason
    was written.
- **Not run:** a visual check in a real browser or on a GPU, the live published Site,
  or a real network regeneration of any dataset.

### 8. Known issues and next steps

- Issue 2 (Sources view labels for `terrarium` / `natural-earth`) remains.
- `dist/data/retrieval-manifest.json` has no `networkRequestsDuringThisRun` field,
  which the current `scripts/fetch-terrain.mjs` writes. It appears to come from an
  earlier script version. Per-site provenance is still inside each terrain JSON.
- `SITES[].image` in `science.js` points to six images that do not exist. The field is
  never read: the UI uses `siteImage()`, which falls back to DEM hillshades. No visible
  effect.
- `AUDIT.md` still describes the first release ("14 automated tests", no new global
  search) alongside later documents that report 61 tests.

### 9. Overlap with other developers

No overlap is known. All changes are small, local string or function edits. If Codex has
uncommitted edits to the same files, compare with `git diff` before committing.

### 10. Commit / push / deploy status

These changes exist **only in this local workspace**
(`C:\Users\user\Projects\terramatch`, branch `main`, based on `788c50e`). Claude did
**not** commit, push or deploy anything, and did not change `.openai/hosting.json`,
remotes or branches. The project owner and Codex handle commit, push and publishing.

## 2026-11-14 — Claude Code: real-browser QA and three fixes

### 1. Task and scope

The owner asked for the outstanding real-browser verification and for defects found
there to be fixed. The local server (`npm start`, `http://127.0.0.1:4173`) was driven in
a real Chromium-based browser pane with WebGL 2 available (1024 × 768, then an emulated
375 × 812 touch phone). Real network services were used: Terrarium tiles and the
Open-Meteo geocoder.

### 2. What was exercised and passed

- Load: 6 terrain windows, globe renders, no console errors at any point in the session.
- Compare: index, both SVG charts, thermal cards with both thermal charts.
- Sources: 22 source cards, study-window table, provenance dialog opens and closes with
  Escape.
- Manual search: coordinates (`-24.5, -69.25`: 4 tiles, zoom 10, 25/25 land samples) and
  a place name (`Devon Island`, resolved by the geocoder).
- Automatic search: Middle East, 12 windows: 12 completed, 0 failed, 2 excluded.
- Local cache: the 11 searched windows were restored after a page reload.
- Expedition (Jezero and Shackleton): landing, door and ramp, hexapod deployment,
  movement with W and Shift, Slope and Temperature layers, inspection dialog (E),
  comparison side panel (C). Shackleton shows the Diviner field; Jezero correctly shows
  "No spatial thermal layer available".
- Phone size: no horizontal overflow; touch controls appear and move the explorer.

Exports were not clicked in the browser (they download files); they remain covered by
the automated DOM tests only.

### 3. Defects found and fixed

| File | Defect | Fix |
| --- | --- | --- |
| `dist/js/expedition.js` (`makeMap`) | The minimap was almost entirely contour-coloured for windows with negative elevations (Jezero, Shackleton), because JavaScript `%` keeps the sign of a negative height. | Contours now use height above the window minimum: `(h-this.stats.min)%interval`. Display only; no elevation value changed. |
| `dist/js/app.js` (`renderComparison`) | Ranking numbers were built as `0${i+1}`, giving `010`, `011`… once searches add ten or more candidates. | `String(i+1).padStart(2,'0')`. |
| `dist/js/thermal-ui.js` | Raw identifiers were shown to users, e.g. `quality-filtered-sol-observations`, `annual-maximum`, `daily_mean`. | A `readable()` helper replaces `-` and `_` with spaces for display. Stored records and exports are unchanged. |

All three were re-checked in the browser after the fix.

### 4. Defects found and not changed

- **Follow camera at the start of exploration:** in a 1024 px wide window the lander
  covers roughly a third of the view, because the camera starts behind the lander. It
  clears once the explorer walks forward or the user drags the view. This is a camera
  design choice, so it was left for the owner to decide.
- **Phone layout (375 px):** the layer buttons run about 8 px under the minimap, and the
  location readout sits close to the touch arrows. Usable, but tight.
- **Comparison panel open at 1024 px:** the keyboard-hint strip is partly covered.
- Automated key taps are instantaneous, so held-key movement was verified by dispatching
  keydown and keyup events to the page's own handlers and through the touch-control API.

### 5. Tests actually run after these fixes

- `npm run check`: passed.
- `npm test`: **61 tests, 61 passed, 0 failed**.
- **Not covered:** other browsers (Firefox, Safari), a physical phone, frame-rate
  measurement, and the published live Site.

### 6. Commit / push / deploy status

Unchanged: all work is local and uncommitted. Nothing was committed, pushed or deployed.


## 2026-11-14 — Claude Code: exploration-task presets and leftovers

### 1. Task and scope

The owner asked for the review findings other than browser QA and publishing to be
worked on. This entry covers two of them: the **Exploration task** selector did not
change the comparison (finding 1), and small leftovers (finding 8). The data-heavy
findings (ice module, more lunar-relevant Earth candidates, comparable thermal
statistics, score sensitivity, denser automatic search) are **not started**.

### 2. Files changed

| File | Change |
| --- | --- |
| `dist/js/science.js` | New exports `TASK_PROFILES`, `taskProfile`, `taskMeasures`. Removed the six unused `image` fields that pointed to files that are not shipped. |
| `dist/js/app.js` | Task selection applies the preset weights (respecting unchecked characteristics), re-ranks, updates a task brief, adds a task panel to Compare, and records the task in evidence JSON and the Markdown report. Method dialog mentions presets. Sources view now labels `terrarium` and `natural-earth` as analysis data. |
| `dist/index.html` | New `#task-brief` paragraph under the task selector. |
| `tests/science.test.mjs`, `tests/app.test.mjs` | Two new tests and extra assertions for presets, task panel, exports and the removed image fields. |
| `README.md`, `DATA.md`, `AUDIT.md` | Document the presets; AUDIT.md gets a dated addendum instead of a rewrite. |

### 3. Technical decisions and scientific limits

- The presets reuse the existing index and only change its two weights. No new score
  was introduced. Weights: terrain 0.65/0.35, navigation 0.85/0.15, fieldwork 0.50/0.50,
  thermal 0.65/0.35 (unchanged, because temperature never enters the index).
- **These weights are judgement calls, not calibrated values.** The UI, exports
  (`task.calibrated: false`) and DATA.md say so. The owner may want different numbers.
- Task measures are sums of existing slope-histogram bins; nothing new is measured.
- `dist/data/retrieval-manifest.json` was left as it is. Regenerating it means
  re-fetching every terrain window, which also changes retrieval timestamps.

### 4. Tests actually run

- `npm run check`: passed.
- `npm test`: **63 tests, 63 passed, 0 failed**.
- Real browser (WebGL 2): switching tasks re-ranks the candidates (for Jezero with the
  searched windows loaded, the order differs between navigation and field operations),
  the brief and the Compare task panel render, and there are no console errors.

### 5. Commit / push / deploy status

Unchanged: all work is local and uncommitted. Nothing was committed, pushed or deployed.

## 2026-11-14 — Codex: GitHub integration and task-selection guard

### Scope and integration

- The owner asked Codex to integrate the reviewed Claude update, fix the empty
  characteristic selection, run checks and update the existing live Site.
- GitHub commit `9ffd46d0dfb0930b0812c943713cde1c36f16bd7` was integrated by
  fast-forward from the previous release `788c50e`. Claude's changes and earlier
  handoff entries were preserved. Earlier statements that work was uncommitted
  describe the state when those entries were written, before the GitHub push.
- The three changed source-derived JSON records were compared with the previous
  release during review: numeric values and structure were unchanged; 55 strings
  changed across those records.

### Additional fix

- `dist/js/app.js`: `applyTaskWeights()` rejects an empty terrain selection
  instead of silently restoring both preset weights. Changing tasks with both
  checkboxes off restores the previous task selection, leaves active weights and
  rankings intact, and asks the user to select at least one characteristic.
- A single selected characteristic still applies its task weight without
  re-enabling the other checkbox. Re-enabling both applies the normal preset.
- `tests/app.test.mjs`: added DOM regression assertions for rejection, unchanged
  rankings, visible selector restoration, slope-only, relief-only and both-on
  task changes.
- `DATA.md`: documented the empty-selection rule.

### Validation and remaining work

- `npm run check`: passed; 17 JSON datasets checked.
- `npm test`: **63 tests passed, 0 failed**, including the additional regression
  assertions in the existing application test.
- `git diff --check`: passed.
- Codex did not repeat real-browser/GPU QA for this integration. Claude's earlier
  Chromium observations remain separately attributed above; Firefox, Safari,
  physical-phone and frame-rate verification remain outstanding.
- No data regeneration, numerical science changes or ice implementation were
  performed. Ice, more lunar-relevant Earth candidates, comparable thermal
  statistics, sensitivity analysis and denser discovery remain future work.

### Publication

- This entry accompanies the integration release intended for GitHub `main` and
  the existing Site, with the existing owner-only Site audience preserved.
- Live URL: https://terramatch-expedition.nizamkasema.chatgpt.site
- Source files do not themselves certify a deployment. The GitHub commit history
  and Sites deployment result identify the final published revision and status.

## 2026-11-14 — Codex: ice-source audit, before implementation

### Scope

The owner approved the next step specifically as a source audit before writing
the ice module. GitHub and the working tree were checked first; the current
application baseline was `58b1fbc`. No application file, bundled production
dataset, score, dependency or hosting configuration was changed by this audit.

### New files

- `ICE-SOURCE-AUDIT.md`: source decisions, primary references, evidence classes,
  access limits, candidate geography checks and release gates.
- `scripts/audit-ice-sources.mjs`: bounded public-source probes; writes only
  research evidence, not application datasets.
- `research/ice-audit-2026-11-14/probes.json`: this run's response metadata,
  hashes, five exact Diviner facet probes and selected glacier/COG metadata.

### Main findings

- Diviner `ice_depth` is modelled sublimation-stability depth, not detection.
  Three sampled depths were positive; two were `-1`, including the Shackleton
  centre facet. The meaning of `-1` was not established. The product XML lists
  `-999` for excluded depths while the SIS lists `-32768`; do not guess a complete
  classifier or infer ice presence/absence from these values.
- Published M3 spectral detection evidence is relevant, but an attributable
  georeferenced detection mask was not acquired. Do not digitise the publication
  illustration into a claimed detection layer.
- GLIMS REST discovery, search and bounds work with the current Site origin.
  Three tested WFS/WMS endpoints returned 404. Metadata and bounds were obtained
  for Longyearbreen analysis `994985`, observation date `2016-08-23`. Full outline
  geometry was not verified. Duplicate contributor rows, historical/split
  outlines, ambiguous names and observation dates require explicit handling.
- A Taylor Glacier name query returned Alaska metadata; the tested `country=AQ`
  parameter did not remove it. Coordinates must validate the intended region.
- ESA WorldCover 2021 v200 class 70 combines persistent snow and glaciers. The
  Svalbard tile returned an exact 4 KiB TIFF range, but no allow-origin header.
  No numerical class pixels or quality layer were decoded. Antarctica is outside
  this product's coverage.
- MOD10A1.061 can provide seasonal snow context; its scientific data access
  requires Earthdata Login, and cloud/polar-night flags are not no-snow evidence.
- These sources are incompatible quantities, so no common ice-match score is
  justified. Longyearbreen is an access example, not a verified new lunar analog.

### Verification and next implementation step

- `node --check scripts/audit-ice-sources.mjs`: passed.
- `node scripts/audit-ice-sources.mjs`: passed; all three bounded source probes
  completed and produced the research report. The five facet temperatures match
  the existing thermal provenance exactly.
- `git diff --check`: passed.
- No application tests or browser/GPU tests were rerun: application code was
  unchanged. The previous integration release passed 63 automated tests.
- Next: resolve or visibly quarantine unknown model values, acquire real dated
  glacier geometry or decode/quality-screen actual Earth classification pixels,
  then implement separately labelled evidence with provenance and no-data states.
  Check the complete candidate terrain window and existing land screen first.

### Publication scope

The audit files are intended for the collaboration GitHub repository. They do
not constitute an ice feature or a new Site release; the live application
remains the integration release. Verify final GitHub publication from its commit
history rather than assuming an audit document changes the live application.


## 2026-11-14 — Official scientific globe and environment integration

This release replaces the active third-party globe textures with unchanged agency
images: NASA BMNG November 2004 (5400×2700), NASA/JPL Viking Mars texture
(1440×720), and the USGS/NASA LROC global morphology mosaic (1024×512).
Legacy assets remain for attribution/history but are not loaded by GlobeView.
See GLOBE-IMAGERY.md and the imagery JSON manifest for original-byte SHA256,
registration checks, dimensions, acquisition periods and limitations. Mars'
exact MDIM revision and geodetic control accuracy are not published with its JPEG;
only global map layout is verified. Moon is a historical grayscale image mosaic.

### Geometry and positioning

- All three bodies share one metres-to-scene factor. Shared camera framing is
  the default; Fit body changes the camera, not planetary radii.
- Earth: WGS84 ellipsoid + NOAA ETOPO1 topography/bathymetry. ETOPO1 is MSL
  height applied as geodetic height with geoid undulation omitted: approximate,
  not survey-grade. The undersea mesh represents bathymetry, not moving water.
- Mars: original MOLA MEGR absolute radius, with MEGT areoid topography kept
  separate for elevation colouring. Never add areoid heights to an ellipsoid
  to produce the Mars surface. Moon: LOLA radial heights + 1737400m sphere.
- Global data are resampled to 361×181 nodes at 1°. These are not full-native
  resolution globes. Finer existing study-window analytics remain separate.
- No relief exaggeration, artificial terminator/atmosphere or procedural stars
  are presented as observations. Imagery is unlit and ungraded. Optical pixels,
  elevation, temperature and classifications remain separate quantities.
- Three.js axes map standard geophysical XYZ to [X,Z,-Y]. Picking inverts the
  same reference convention used for the geometry. Polar mission focus now
  centres the actual lunar coordinates rather than clamping their latitude.
- Globe renderer supports surface/elevation, source failures without generated
  fallback, observation overlays, and dated EONET point markers.

### New Planet data workspace

- Original global map previews, physical figure comparison, frames, DEM datum,
  source URLs and full provenance. Data remain readable without WebGL.
- Earth: five NASA POWER daily variables for the selected candidate over 2025
  (skin and 2m air temperature, 10m wind, pressure, precipitation). Four exact
  reference sites use bundled original responses; new coordinates request NASA.
  This is coarse historical model/reanalysis, not current local weather.
- Earth layers: original dated NASA GIBS global PNGs (2048×1024) and original
  legends. Truecolour and daytime temperature reference date 2026-11-13;
  annual water reference 2015-01-01. Other advertised dates request NASA.
  Date gaps/future dates fail explicitly. No numbers are decoded from colours.
  Neutral background shows transparent areas, without undated base-image fill.
- The older GIBS water browse shows unreliable Antarctic land detail. Its overlay
  is conservatively hidden outside 60°S–80°N; this is a project display guard,
  not an official coverage boundary or a water absence result. PNG bytes remain
  original. No local quantitative water classifier or lunar ice detector added.
- EONET defaults to a labelled 2026-11-14 snapshot, with Refresh from NASA.
  Open severe-storm catalogue query: global, 30 days, limit100. Approximate
  dated points are not live storm footprints, forecasts or local all-clear.
- Mars: original PDS MEDA calibrated sol29 pressure CSV/XML, all50926rows,
  Barocap channels separate (sampled means751.2609/742.0936/742.0259Pa).
  Date2021-03-19–21UTC; 37 occupied half-hour bins and11gaps, uncertainty blank.
  Does not infer current dust storms or conditions elsewhere on Mars.
- Existing mission thermal evidence remains accessible and separate from terrain
  ranking. Planet/environment records are included in evidence JSON and report
  when loaded; viewing these layers does not modify terrain resemblance scores.

### Validation and collaboration

- 97 automated tests passed, including real bundled-source hashes, numeric
  coordinate/mesh tests, renderer integration with an injected renderer, source
  failure/cancellation, date intervals, polar overlay guard, and real DOM flows
  through all three Planet data bodies, dated weather records and exports.
- Application syntax/JSON checks passed. 15 representative local static routes
  returned HTTP200. Original source maps and NASA legends visually inspected.
- Browser/GPU rendering QA is NOT verified for this release. Computer Use could
  read an old Firefox screenshot, then stopped input because URL policy is not
  supported by the current Windows browser. No alternative automation bypass.
- No mobile layout redesign: that remains last priority per the user.
- No changes to the ice-source audit classification gates. Follow
  ICE-SOURCE-AUDIT.md before implementing ice evidence.
- Sources were opened at4a4c378; GitHub fetched with no collaborator divergence
  before packaging. Preserve all collaboration files and existing Site audience.
  Site helper commits/synchronizes this source, then the same commit is pushed
  to GitHub and privately deployed to the existing TerraMatch URL.
