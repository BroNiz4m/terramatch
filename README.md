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
web host. All planet textures, the 3D runtime, photographs and DEM subsets are
served locally. There is no API key requirement or runtime dependency on NASA
portal availability.

## Use the application

1. Select Mars / Jezero or Moon / Shackleton in **Explore**.
2. Select slope and/or relief and run **Find Earth analogs**. Review the three
   inland candidates and their source evidence.
3. Choose **Explore in 3D**. Watch the lander arrive, its door open, the ramp
   unfold, and the hexapod deploy. **Skip arrival** starts exploration immediately.
4. **W/S** move; **A/D** turn; **Shift** accelerates navigation. Drag to orbit the
   follow camera; scroll to zoom. **E** inspects terrain, **C** opens the Earth
   comparison sidebar, and **Escape** pauses. Touch movement controls appear on
   coarse-pointer devices.
5. Switch **Surface / Slope / Elevation** layers. Inspect and save geolocated
   terrain observations with optional notes. Notes persist in browser local storage.
6. Use **Compare** for measurements, profiles, slope histograms and candidate
   rankings. Earth candidates can also be explored in 3D.
7. Export the Markdown comparison report, evidence JSON or field notebook. Each
   contains source information; reports include the method and interpretation limits.
8. Use **Sources** to inspect exact provenance, citations and assumptions.

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
- `dist/data/`: six sourced terrain subsets and source summary.
- `scripts/fetch-terrain.mjs`: reproducible data retrieval and subset pipeline.
- `.openai/hosting.json`: private Sites project and static hosting configuration.

Use of public space-agency data does not imply agency endorsement.
