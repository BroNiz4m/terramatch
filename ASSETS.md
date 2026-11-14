# TerraMatch visual assets

## Original procedural 3D hardware

`dist/js/models.js` exports `createHexapod()`, `createRocket()` and
`createRock(seed, color)`. These original models are created as actual Three.js
meshes, not pre-rendered images. They use local visual metres and face `-Z`.

The hexapod has exactly six articulated legs. Place its root at ground level and
call `robot.userData.update(deltaSeconds, elapsedSeconds, moving,
worldHeightSampler)` once per animation frame. `moving` accepts either a boolean
or a positive normalized gait speed. The sampler receives world X/Z and returns
world Y, and each leg solves a two-link joint pose to its own grounded foot.
`userData.animate({dt,time,walking,speed,terrainHeight})` is an equivalent alias.
`userData.setWalking(bool)`, `legs`, `body`, `head`, `footCount` are also exposed.

The cargo lander has an actual payload opening, interior, a top-hinged cargo door,
and a ramp that unfolds to the ground. Call `lander.userData.setDeployment(0..1)`
to open the door and then lower the ramp. Call `setThrust(0..2)` to show the visual
exhaust. The closed model is about 11.9 visual metres high; its ramp is 4.15 metres
long with a sill at 1.24 metres. Ground feet are at Y=0. The lander exposes
`doorPivot`, `rampPivot`, `flames`, `rampLength`, and `rampHeight`.

These models illustrate navigation and deployment. Their appearance, gait,
decorative rocks and rocket dynamics are not validated engineering or geological
measurements.

## Local runtime

- `dist/vendor/three.module.js` and `three.core.js`: Three.js **0.181.1**.
  Source: <https://cdn.jsdelivr.net/npm/three@0.181.1/build/>.
  MIT license retained as `dist/vendor/THREE-LICENSE.txt`.
- No production CDN import is needed; the files load from the same origin.

## Current original agency imagery

The active globe uses `official-earth.jpg`, `official-mars.jpg` and
`official-moon.jpg`: unchanged original NASA/USGS published renditions.
See [GLOBE-IMAGERY.md](GLOBE-IMAGERY.md) and
`dist/data/globe-imagery-sources.json` for original URLs, dimensions, dates,
registration checks, credits and SHA-256 hashes. The scientific renderer does
not add a fabricated atmosphere, terminator, star field or colour grading.
See [GLOBE-GEOMETRY.md](GLOBE-GEOMETRY.md) for numerical geometry.

NASA GIBS dated true-colour, daytime temperature and annual water-mask PNGs and
their original legends are also bundled. `dist/data/earth-observation-layers.json`
retains WMS requests, dates, hashes and advertised time intervals. These are
2048×1024 browse renditions, not native-resolution quantitative rasters. The
older water rendition is conservatively hidden outside 60°S–80°N because its
Antarctic land rendering was not reliable; this guard is not a no-water finding
or an official coverage boundary. Missing observations use a neutral backdrop.

## Retained legacy imagery (not used by the current globe)

- `dist/assets/earth-day.jpg`: Earth color texture, copied unchanged from
  <https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg>.
- `dist/assets/earth-specular.jpg`: Earth water/specular mask, copied unchanged
  from <https://threejs.org/examples/textures/planets/earth_specular_2048.jpg>.
- `dist/assets/moon.jpg`: lunar visual texture, copied unchanged from
  <https://threejs.org/examples/textures/planets/moon_1024.jpg>.
- `dist/assets/mars.jpg`: Solar System Scope/INOVE 2K Mars texture, copied
  unchanged from <https://www.solarsystemscope.com/textures/download/2k_mars.jpg>.
  Credit: **Solar System Scope / INOVE, CC BY 4.0**.
  Source and license: <https://www.solarsystemscope.com/textures/> and
  <https://creativecommons.org/licenses/by/4.0/>.
  The publisher notes its global visual maps may contain fictional gap-filling.
  This texture is retained for collaboration history and licensing attribution;
  the current renderer does not load it. Terrain measurements come from the
  separately identified DEM products.

## Observational photographs

- `dist/assets/wadi-rum-nasa.jpg`: NASA Earth Observatory, **Wadi Rum, Jordan**,
  July 27, 2001 EO-1 ALI natural-color observation. Credit: Jesse Allen and Robert
  Simmon, NASA Earth Observatory; EO-1 data courtesy NASA EO-1 team and USGS.
  Source: <https://science.nasa.gov/earth/earth-observatory/wadi-rum-jordan-49945/>.
  Original image:
  <https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/49000/49945/wadirum_ali_2001208.jpg>.
  It is an orbital image, not a ground photograph.
- `dist/assets/jezero-panorama.jpg`: NASA Photojournal **PIA26378**,
  *Perseverance's Mid-Climb View of Jezero Crater*, a September 27, 2024
  enhanced-color Mastcam-Z mosaic. Credit: NASA/JPL-Caltech/ASU/MSSS.
  Source:
  <https://science.nasa.gov/photojournal/perseverances-mid-climb-view-of-jezero-crater/>.
  The local copy is NASA's 1200×264 rendition. The panorama is a photograph, not
  a co-registered texture of the terrain DEM subset used by the explorer.

No agency logo or implied NASA endorsement is included in the original models.

## Validation performed

The module and pinned runtime import successfully in Node.js 22. The robot was
updated for 120 moving frames with a rotated and translated world transform;
all six foot targets remained finite. The cargo door and ramp reach the intended
deployment angles and their geometry has finite bounding boxes.
