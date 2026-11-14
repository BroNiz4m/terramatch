# TerraMatch

**Find Earth's next training ground.**

TerraMatch is a NASA Space Apps Challenge 2026 project for exploring planetary
terrain and comparing Earth analog candidates. The application contains an
interactive Earth/Mars/Moon globe, an animated cargo-lander deployment, an
actual controllable six-legged 3D explorer, and evidence-backed terrain
comparisons. The application UI is implemented in HTML/CSS/ES modules, with
Three.js vendored locally. Generated design images are not used as functioning UI.

## Run locally

Requires Node.js 22 or later. No production dependency installation is needed.

```sh
npm start
```

Open **http://127.0.0.1:4173** in a browser with WebGL 2 and hardware acceleration.
The static application is in `dist/`. It can be served from any ordinary static
web host. Planet textures, the 3D runtime, photographs, six reference DEM subsets
and the global land mask are served locally. There is no API key requirement.
New manual/automatic searches require internet access to public terrain tiles;
place-name searches additionally use Open-Meteo / GeoNames. Bundled reference
comparisons work without those services. Use HTTPS or localhost for source hashes.

## Use the application

1. Select Mars / Jezero or Moon / Shackleton in **Explore**.
2. In **Manual search**, submit a place name or decimal latitude, longitude.
   Alternatively choose **Pick on globe**, rotate Earth, and click a location.
   **Analyze this area** fetches a new 32 × 32 km elevation window. Its source
   tile hashes, land screening, charts and provenance remain available.
3. In **Automatic search**, select a regional or global sample, or draw a region
   by clicking two opposite globe corners. Choose a budget of 12, 24 or 48 windows
   and start the survey. Actual new coordinate windows are fetched, analyzed and
   compared with the target. Progress, failure/exclusion counts and cancellation
   with partial results are supported. A global sample is not exhaustive.
4. Select slope and/or relief and run **Rank loaded candidates**. Results include
   bundled references and eligible on-demand windows. New candidates show their
   manual/automatic origin. The latest 24 valid search windows are cached locally.
5. Choose **Explore in 3D**. Watch the lander arrive, its door open, the ramp
   unfold, and the hexapod deploy. **Skip arrival** starts exploration immediately.
6. **W/S** move; **A/D** turn; **Shift** accelerates navigation. Drag to orbit the
   follow camera; scroll to zoom. **E** inspects terrain, **C** opens the Earth
   comparison sidebar, and **Escape** pauses. Touch movement controls appear on
   coarse-pointer devices.
7. Switch **Surface / Slope / Elevation** layers. Inspect and save geolocated
   terrain observations with optional notes. Notes persist in browser local storage.
8. Use **Compare** for measurements, profiles, slope histograms and candidate
   rankings. Earth candidates can also be explored in 3D.
9. Export the Markdown comparison report, evidence JSON or field notebook. Each
   contains source information; reports include the method, candidate origin,
   recorded survey coverage and interpretation limits.
10. Use **Sources** to inspect exact provenance, citations and assumptions.

## Actual datasets

- NASA MGS MOLA MEGDR: Jezero Crater, Mars.
- NASA LRO LOLA LDEM_75S_240M: Shackleton region, Moon.
- Skadi mixed-source elevation tiles: Wadi Rum, Al Wahbah, Amboy and Lanzarote.
- All study windows: 32 × 32 km; 65 × 65 samples; 500 m sampling; 1 km slope baseline.
- Lanzarote is deliberately excluded from the inland ranking because its window
  includes coastal bathymetry. Amboy is an established reference site, not a new discovery.

See [DATA.md](DATA.md) for exact products, projections, byte ranges, source hashes,
reproduction commands and formulas. See [ASSETS.md](ASSETS.md) for visual credits,
licenses and the original procedural hardware model APIs.

See [SEARCH-DATA.md](SEARCH-DATA.md) for runtime terrain retrieval, PNG decoding,
manual/automatic search contracts, real network checks and coverage limits.
[LANDMASK.md](LANDMASK.md) records the coarse land-screening asset and its hash.

On-demand windows use RGB-encoded Mapzen / Tilezen Terrarium mixed-source DEM tiles.
Direct PNG decoding avoids color conversion, retains negative land elevations,
and samples pixel centers across tile seams. Search supports centers between
84° S and 84° N. A 5 × 5 Natural Earth land-mask screen excludes windows containing
mapped non-land samples from inland ranking. It is a coarse screen, not proof
that every point is dry land, and it does not reliably classify inland lakes.

## Scope and scientific interpretation

The resemblance index compares coarse slope distributions and relative relief.
It is a transparent terrain heuristic, **not a probability of mission suitability**.
It does not establish mineral, thermal, ice, biological or engineering equivalence.
Material descriptions are qualitative context with linked sources.

Terrain elevation geometry comes from the sourced DEM. Fine ground textures,
decorative rocks, sky colors and lighting are visual treatments. The explorer
avatar is enlarged for navigation; its speed, gait and the lander arrival sequence
are not validated robotics or flight simulations. Decorative rocks do not identify
actual planetary hazards. Lunar lighting does not reconstruct permanent shadow.
Coarse terrain resemblance supports a shortlist for further investigation; it is
not a landing-site, permanent-base or field-safety certification.

## Verification

```sh
npm ci
npm run check
npm test
```

Tests cover analytical slope calculations, cross-datum relief comparison,
interpolation, polar geolocation, data eligibility, model geometry, full expedition
state/movement logic, DOM workflows and scientific exports. DOM and expedition
logic tests use a DOM environment and a renderer test double; they are **not**
visual or GPU-rendering tests. A desktop-browser visual review is still needed
when browser automation is available.

## Structure

- `dist/index.html`, `dist/styles.css`: responsive application shell and design.
- `dist/js/app.js`: mission workflow, comparisons, notebook, dialogs and exports.
- `dist/js/globe.js`: interactive planet globe and hardware preview.
- `dist/js/expedition.js`: real-time scene, deployment, controls, minimap and layers.
- `dist/js/models.js`: original six-legged robot, cargo rocket and rock meshes.
- `dist/js/science.js`: source catalogue, sampling, geolocation and comparison.
- `dist/js/terrain-search.js`: on-demand terrain, PNG decoding, place lookup and
  bounded grid surveys with cancellation and source hashes.
- `dist/js/search-ui.js`, `dist/search.css`: manual and automatic discovery workflow.
- `dist/js/search-cache.js`: validation and local caching of recent search windows.
- `dist/data/`: six sourced terrain subsets and source summary.
- `scripts/fetch-terrain.mjs`: reproducible data retrieval and subset pipeline.
- `.openai/hosting.json`: private Sites project and static hosting configuration.

Use of public space-agency data does not imply agency endorsement.


## Surface thermal context

Choose **Thermal environment study**, then open Compare for source-derived
Earth, Moon and Mars temperature records. The 3D Temperature layer distinguishes
spatial lunar data from coarse Earth daily-mean context. Rover point observations
are not extended over an entire crater. Thermal evidence retains its own
statistic and time coverage and does not change the terrain-only ranking.
See [THERMAL.md](THERMAL.md), [THERMAL-EARTH.md](THERMAL-EARTH.md) and
[THERMAL-PLANETARY.md](THERMAL-PLANETARY.md) for definitions and limits.
