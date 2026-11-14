# TerraMatch Cargo Lander

Original procedural Three.js geometry built for TerraMatch, using the team's cargo-lander reference for the low box silhouette. This is a fictional exploration vehicle, not a NASA spacecraft model or an engineering-validated lander. No generated picture, downloaded spacecraft model, or image texture supplies the vehicle shape.

## Geometry and axes

Local units represent visual metres. The cargo exit faces **−Z**, Y is up, and the root origin is nominal flat landing-pad ground. The ivory hull has orange corner trim, a real open payload bay, two independent vertical-axis cargo doors, four splayed legs with circular footpads, six underbody bell nozzles, roof equipment and an antenna. The ramp folds into two short segments to stow beneath the low roof.

| Dimension | Value |
| --- | --- |
| Hull width × depth | 6.4 × 5.2 m |
| Main roof top | 3.84 m |
| Antenna top | 4.755 m |
| Nominal deck surface | 0.85 m |
| Structural bay height | 2.65 m |
| Minimum overhead clearance at lamps | 2.57 m above deck |
| Guaranteed bay / walking-ramp width | 4.5 m |
| Usable bay depth | 4.6 m |
| Ramp length, two segments | 4.1 m |
| Extended foot contact centres | X ±4.10 m, Z ±3.32 m |
| Open door rotation | Left +110°, right −110° about Y |

Both side panels read **powered by Wh0Knows**, with a smaller first line above the larger team name. The `0` is a numeral zero. The front lintel reads **TerraMatch**. Browser labels are rendered locally into canvas textures. A local pixel-font DataTexture fallback renders the same literal spelling without a DOM; both are sRGB, and the fallback explicitly flips its top-down rows for texture sampling.

## API

`createCargoLander()` returns a `THREE.Group`; `createRocket()` remains a compatibility alias returning the same low cargo vehicle. Existing hexapod and seeded rock implementations are preserved.

`userData` exposes:

- `doorPivots[2]`, `rampPivot`, `rampTipPivot`, `rampLength`, `rampWidth`, `rampHeight`, `rampAngle`, `rampTipZ`, `bayWidth`, `bayDepth`, `bayHeight`, `doorFrontZ` and `bayBackZ`.
- `setDeployment(progress)` opens side doors first, then unfolds the ramp. Progress is clamped to 0–1.
- `setLandingGear(progress)` retracts or extends all four legs; progress is clamped to 0–1.
- `setCompression(progress)` lowers the hull by up to 0.10 m while keeping extended foot contacts grounded and updating ramp height / nozzle anchors.
- `setGrounding(sampleLocalHeight)` receives **local X and Z**, and expects a **local Y** relative to the root origin. Each pad samples independently. Reach is bounded to −0.80…+0.45 m and any clamping is reported in `groundingStatus`.
- `setRampGroundHeight(localY)` tilts the deployed ramp to the requested local ground height at its endpoint. Extreme tilt is clamped and exposed through `rampGrounding`.
- `rampSurfaceHeight(localX, localZ)` returns the nominal deck/ramp walking plane, or `null` outside its footprint. The folded / moving ramp is not walkable. Small floor ribs and curb geometry sit above this nominal surface.
- `footAnchors[4]` are dynamic local pad-bottom contact positions; `landingLegs` contains the hardware meshes.
- `nozzleAnchors[6]` are dynamic local downward outlets. `nozzleGlows` contains subtle throat lights; `setThrust(level)` and `update(dt,time)` animate these. The model creates no exhaust plume or dust. `flames` is an empty effects attachment group for compatibility.
- `brandingText`, `brandingLabels[2]`, `frontBrand`, and the original model credit.

The model never moves its root during `update`. The expedition arrival controller owns world movement, leveling policy, deployment timing and terrain placement. `landing-effects.js` owns exhaust and dust.

## Verification

`node --test tests/models.test.mjs` checks the low silhouette, finite geometry, actual open-door clearance by raycasting, full-stance walking hexapod fit, ramp endpoint / sampler agreement after compression and terrain changes, independent pad grounding, bounded reach, exact rendered branding and six real nozzle bells. These geometry tests do not validate spacecraft flight physics or claim a browser/GPU render review.
