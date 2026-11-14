# Scientific globe geometry

Earth, Mars and the Moon use original agency **numeric global relief/shape data**. A colour image is never interpreted as terrain height. No procedural displacement, random crater field or vertical exaggeration is added to the global scientific geometry.

The bundled grids are deliberately modest **361 × 181 geographic nodes at 1° spacing**, not the full native source resolution. They support global shape and broad-relief visualization. Narrow peaks, small craters, rover-scale hazards and precise landing conditions are unresolved.

## Sources and height conventions

| Body | Original numeric source | Native source grid | Bundled geometry |
|---|---|---|---|
| Earth | NOAA NGDC/NCEI ETOPO1 Ice Surface | 21,601 × 10,801 node-registered, 1 arc-minute | WGS84 geodetic ellipsoid with ETOPO1 mean-sea-level relief applied approximately as geodetic height |
| Mars | NASA MGS MOLA MEGDR `MEGR90N000CB` mean planetary radius, plus separate `MEGT90N000CB` topography | 1,440 × 720 pixel-centered, 0.25° | Actual archived planetary radius, not topography added to a reference ellipsoid |
| Moon | NASA LRO LOLA `LDEM_4`, V3.0 | 1,440 × 720 pixel-centered, 0.25° | Archived radial height added to the 1,737,400 m reference sphere |

Every data JSON records the actual source product URLs, metadata labels, source byte counts, retrieval dates, SHA-256 hashes, registration, scaling, source frames, resampling operations and limitations. Source kernels and original datasets are unmodified upstream products; the application ships documented sampled derivatives.

## Earth

Original NOAA catalogue:

https://coastwatch.pfeg.noaa.gov/erddap/info/etopo180/index.html

Numeric request:

```text
https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.csv?altitude[(-90):60:(90)][(-180):60:(180)]
```

This selects every 60th latitude/longitude node from the original one-arc-minute ETOPO1 ice-surface grid, then reorders rows north-to-south. The grid includes land topography, ice-sheet surface height, and ocean-floor bathymetry. Negative heights are genuine relief values and remain negative.

Horizontal datum is WGS84; vertical datum is **Mean Sea Level**. The rendered reference ellipsoid uses the official WGS84 semi-major axis 6,378,137 m and inverse flattening 298.257223563, giving a polar semi-axis of 6,356,752.314245 m. Official NGA reference:

https://earth-info.nga.mil/?action=wgs84&dir=wgs84

**Approximation disclosed:** ETOPO1 orthometric/mean-sea-level height is not WGS84 ellipsoidal altitude. No geoid-undulation grid is applied. The renderer treats the supplied height as a geodetic-normal offset approximately; it must not claim survey-grade physical positioning. A separate sea-surface ellipsoid may be drawn at zero reference height, but the ETOPO1 negative field represents the seafloor, not the visible water surface.

Eight sampled antimeridian pairs in the original NOAA subset differ by 1 m between −180° and +180°, although these denote the same longitude. To close a watertight globe, each affected pair is replaced by their mean. All original pair values, latitudes and resulting means are retained under `source.sampledGrid.seamAdjustments`. No unrecorded endpoint patch is applied. The source's exact polar rows are constant in longitude and are retained.

Sampled-grid heights range from −9,200 to 5,855 m. Those are the extrema of this coarse derivative, **not** Earth's full-resolution topographic extrema.

## Mars

Original archive:

https://pds-geosciences.wustl.edu/missions/mgs/megdr.html

Products under:

```text
https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/
```

- `megr90n000cb.img` and `.lbl`: mean planetary radius, version 2.0.
- `megt90n000cb.img` and `.lbl`: topography relative to the Mars areoid.

Both are signed big-endian 16-bit rasters, 1,440 columns × 720 rows. The radius conversion is **DN + 3,396,000 m**. Topography is the original signed value in metres; it is a separate physical field.

The globe therefore uses the radius product directly along a planetocentric latitude/longitude direction. It does **not** add areoid-referenced topography to a spherical or ellipsoidal reference and pretend that gives the same physical surface. `sampleGlobeElevation` returns the areoid topography for contextual readout; `sampleGlobeRadius` and `surfacePosition` use the actual radius array exclusively.

The MOLA frame is the source's IAU2000 planetocentric body-fixed system with positive-east longitude. Reference ellipsoid axes from NAIF PCK are 3,396,190 m, 3,396,190 m and 3,376,200 m. These axes are useful shape metadata and reference-ellipsoid utilities; they are not double-added to the measured radius.

The bundled radius range is 3,373,426.25–3,416,448 m. The separate sampled areoid-topography range is −7,674.25–20,421.75 m. Binning/interpolation in the original MOLA grids and the additional global sampling limit detail and accuracy.

## Moon

Original archive:

https://pds-geosciences.wustl.edu/missions/lro/lola.htm

Exact global source:

```text
https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.img
```

Its label specifies V3.0, source data through 2016-11-29, product creation 2017-09-15, signed little-endian 16-bit values, and scaling **DN × 0.5 m**. The planetary radius is 1,737,400 m plus that radial height.

Source coordinates are planetocentric, east-positive, in the **Mean Earth/polar-axis frame of DE421**. Generic `IAU_MOON` and a precision lunar mean-Earth frame are not interchangeable orientation solutions. TerraMatch's body-fixed globe does not claim current-time inertial orientation, precise libration, illumination or ephemeris.

Sampled radial heights span −7,810.125–9,418.75 m. The original grid can contain interpolated gaps and latitude-band artifacts. Coarse global resampling omits small craters; it does not synthesize replacements.

## NAIF shape metadata

Official kernel:

https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc

Version date: 2022-12-27. Its bytes are hashed and the actual `BODY399_RADII`, `BODY499_RADII` and `BODY301_RADII` fields are parsed into the ingestion provenance.

The kernel's Earth reference radii (6,378,136.6 / 6,378,136.6 / 6,356,751.9 m) differ slightly from exact WGS84. Earth geometry intentionally uses WGS84 because ETOPO1's horizontal reference is WGS84. The two definitions are retained separately instead of being silently conflated.

No time-dependent body rotation is calculated from this text kernel. NAIF warns that generic Earth and lunar orientation models have precision limits; body-fixed geospatial geometry does not establish celestial pointing accuracy.

## Sampling, poles and seams

All bundled output grids have:

```js
{
  width: 361,
  height: 181,
  registration: {
    latitudeStart: 90,
    latitudeStep: -1,
    longitudeStart: -180,
    longitudeStep: 1,
    includesDuplicateLongitudeSeam: true,
    longitudePeriodDegrees: 360
  }
}
```

The NASA native grids are pixel-centered at latitude 89.875° and longitude 0.125°, with 0.25° spacing. Resampling preserves that half-pixel registration and wraps longitude. Output pole nodes use the mean of the nearest native latitude ring and replicate that value at all pole longitudes. This closes the mesh with a documented **coarse pole approximation**, not an invented exact-pole observation. Nonpolar samples use bilinear interpolation of the original numeric values.

Output values can therefore have fractions of a metre even when the native radius field is integer metres. These fractions come from interpolation and averaging, not higher source precision.

## Geometry API

`dist/js/globe-science.js` exports:

```js
BODY_SHAPES
await loadGlobeDEM(body, {signal})
validateGlobeDEM(data)
sampleGlobeElevation(data, latitudeDegrees, longitudeDegrees)
sampleGlobeRadius(data, latitudeDegrees, longitudeDegrees)
surfacePosition(data, latitudeDegrees, longitudeDegrees)
inversePosition(body, xyzMeters)
earthGeodeticPosition(latitudeDegrees, longitudeDegrees, heightMeters)
planetocentricPosition(body, latitudeDegrees, longitudeDegrees, radialHeightMeters)
normalizeLongitude(longitudeDegrees)
```

Position output is standard body-fixed **[X, Y, Z] in metres**: +X at equator/longitude 0°, +Y at equator/90° E, +Z north. The renderer must map those axes into its own coordinate convention and apply a single uniform unit scale. It must not treat metres as kilometres or apply an arbitrary terrain-height multiplier.

Earth inverse coordinates are geodetic WGS84. Mars/Moon inverse angles are planetocentric. For Mars, inverse `heightMeters` is explicitly radial departure from the 3,396 km reference sphere, **not** recovered areoid topography; an areoid-topography readout must sample the separate field at the returned angles.

The `planetocentricPosition` helper is a reference-ellipsoid utility. Actual Mars surface geometry must use `surfacePosition` with the radius data. Earth surface heights retain the disclosed geoid approximation.

## Reproduction and checks

```sh
node scripts/fetch-globe-dem.mjs
node --test tests/globe-science.test.mjs
```

Optional body arguments limit source retrieval, for example `mars moon`. NOAA requests are sequential and retry bounded transient 429/503 responses. Source errors are raised rather than replaced by synthetic data.

Twelve tests passed covering official shapes and kernel radii, complete source-derived grids/provenance, seams and pole closure, WGS84 forward/inverse geometry, distinction between geodetic and geocentric latitude, true MOLA-radius geometry, LOLA reference-radius conversion, preserved bathymetry and geoid limitations, half-pixel resampling, bilinear sampling, invalid input and loading/cancellation.
