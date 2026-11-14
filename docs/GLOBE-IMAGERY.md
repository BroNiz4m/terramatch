# Original agency imagery for the three globes

The new files are original **provider-published JPEG renditions**, downloaded
without image edits. They are not imagegen output, third-party planet textures,
recolored elevation grids, or locally invented terrain. Their hashes and map
registration are recorded in `dist/data/globe-imagery-sources.json`.

| Body | Local file | Original delivered dimensions | Bytes |
| --- | --- | ---: | ---: |
| Earth | `dist/assets/official-earth.jpg` | 5400 × 2700 | 1,851,209 |
| Mars | `dist/assets/official-mars.jpg` | 1440 × 720 | 972,896 |
| Moon | `dist/assets/official-moon.jpg` | 1024 × 512 | 151,314 |

Total: **2,975,419 bytes**. No upscaling was used to suggest greater detail than
the providers actually delivered. The Earth original slightly exceeds the 5K
target; the Mars/Moon originals are smaller than the preferred 2K target.

## Earth: NASA Blue Marble Next Generation

Provider: NASA Earth Observatory / NASA GSFC. Product: **November 2004 base map**.
The selected file is the ordinary base map, not the separate shaded-topography
or bathymetry map. NASA publishes monthly MODIS-based global composites; this is
historical surface context, not a live view of weather, clouds or vegetation.

Source product:
<https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/>

Unchanged rendition:
<https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700.jpg>

The matching official GeoTIFF's first 65,536 bytes were retrieved using an HTTP
206 range request and its actual TIFF/GeoTIFF tags decoded:

- Width 5400; height 2700.
- `GeographicTypeGeoKey = 4326` (WGS84 geographic).
- `GTRasterTypeGeoKey = 1` (pixel-is-area).
- Model tiepoint at image (0,0): approximately **−180°, +90°**.
- Pixel scale: **0.0666666667°** in each direction.

This verifies a north-up, Greenwich-centered, full-world equirectangular layout.
The corresponding texture convention is `u=(longitude+180)/360` and
`v=(90-latitude)/180`, with v measured downward from the top of the image.

Metadata source:
<https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700_geo.tif>

## Mars: official NASA/JPL Viking image texture

NASA's 3D resource page explicitly identifies the image as **Viking images
processed at USGS**, from JPL/Caltech planetary maps. The original published
1440×720 JPEG is retained byte-for-byte. It resolves approximately 0.25° per
delivered pixel (about 14.8 km/pixel at the equator), not rover-scale terrain.

Provider page: <https://science.nasa.gov/3d-resources/mars/>

Unchanged rendition:
<https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/mars/Mars.jpg>

The global texture's −180°..180°, north-up layout was cross-checked against the
official Viking dataset's simple-cylindrical, east-positive, planetocentric
registration and the positions of Olympus Mons, Valles Marineris and Syrtis
Major. The NASA JPEG has **no embedded CRS** and its page does **not specify its
exact MDIM revision**. These checks establish the global layout, not a new claim
of pixel-level geodetic accuracy or exact MDIM 2.1 provenance.

Official reference metadata:
<https://www.mars.asu.edu/data/mdim_color/>
<https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m>

The USGS MDIM 2.1 reference is an observation-derived, photometrically processed
colorized mosaic; it is not a map of terrain elevation encoded as colors.
Provider processing and the display JPEG's missing per-pixel validity mask mean
we do not claim perfectly unprocessed or uniformly calibrated RGB observations.

Credit: **NASA / Jet Propulsion Laboratory & Caltech; Viking imagery processed
at USGS.**

## Moon: official USGS LROC monochrome mosaic

The preferred NASA SVS CGI Moon Kit color-file host could not be reached after
bounded retries. The replacement is an original USGS rendition of the **NASA
LRO/LROC WAC Global Morphology Mosaic, version 3 (June 2013)**. It is a 643 nm
single-band **grayscale optical** map, not a natural-color map or a colorized
height map. The downloadable USGS sample is 1024×512; we retain that resolution
and make no 2K/4K-detail claim.

Source and unchanged rendition:
<https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m>
<https://astrogeology.usgs.gov/ckan/dataset/db948a2d-4d6a-4775-a0d3-12613d36f9e7/resource/d24d5ef3-abc5-42ee-ac7c-4c3261106327/download/moon_lro_lroc-wac_mosaic_global_1024.jpg>

The USGS record explicitly provides **Simple Cylindrical** projection, longitude
−180°..180°, latitude −90°..90° and a **1,737,400 m reference sphere**. NASA Trek's
independent WAC capabilities metadata confirms a top-left corner of (−180°,90°)
and eastward columns/southward rows:
<https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml>

The source mosaic uses over 15,000 observations acquired November 2009–February
2011. Provider processing includes orthorectification using GLD100/LOLA, combining
different acquisition periods and filling some gores with actual observations
from other times. Polar shadows and photometric seams remain as supplied. A dark
or apparently blank area is not locally painted over, a measured temperature,
evidence of ice, or proof that every surface pixel has been observed. The small
JPEG has no separate pixel validity mask. Nominal global extent does not remove
these coverage limitations.

Credit: **NASA/GSFC/Arizona State University; LROC Team; USGS Astrogeology.** The
USGS metadata describes the product as public domain and asks users to cite the
authors. Source references include Speyerer et al. (2011) and the June 2013
morphology mosaic.

## Reproduce and validate

```sh
node scripts/fetch-globe-imagery.mjs
node scripts/fetch-globe-imagery.mjs --metadata-only
```

The first command downloads provider bytes and recreates the manifest. The second
validates and hashes the existing images without a network download. Every image
must have an actual 2:1 JPEG frame; the total set must remain under 20 MB.

All image files retain their source appearance. The renderer must not treat
image color as topography, temperature or a new measurement. Physical body shape,
relative scale, map coordinates, current orientation and illumination are separate
model choices and need their own data/metadata; a map image alone cannot establish
them. Public NASA/USGS data use does not imply agency endorsement.
