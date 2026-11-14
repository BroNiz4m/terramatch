/** Download unchanged agency-published global map renditions. No image editing. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const BASE = new URL('../dist/', import.meta.url);
export const GLOBE_IMAGE_DEFINITIONS = [
  {
    body: 'earth', path: 'assets/official-earth.jpg',
    provider: 'NASA Earth Observatory / NASA GSFC', product: 'Blue Marble: Next Generation — November 2004 base map',
    title: 'Earth — NASA Blue Marble Next Generation, November 2004',
    sourceUrl: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700.jpg',
    documentationUrl: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/',
    metadataUrls: ['https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700_geo.tif', 'https://earthobservatory.nasa.gov/ContentFeature/BlueMarble/bmng.pdf'],
    registration: { projection: 'equirectangular', crs: 'EPSG:4326', westLongitude: -180, eastLongitude: 180, northLatitude: 90, southLatitude: -90, latitudeConvention: 'geographic/geodetic', longitudeDirection: 'east-positive', primeMeridianAtU: 0.5, northAtV: 0, rowOrder: 'north-to-south', pixelIsArea: true, verification: 'Matching original NASA GeoTIFF header read via bounded HTTP range: GeographicTypeGeoKey=4326; ModelTiepoint pixel0,0 → longitude−180,latitude90; ModelPixelScale=0.0666666667° in both axes; dimensions5400×2700. Greenwich-centered north-up global layout.' },
    frame: 'Earth WGS84 geographic coordinates (EPSG:4326); longitude relative to Greenwich. This optical mosaic is not a current-date Earth orientation solution.',
    acquisitionPeriod: 'November 2004 monthly composite',
    processing: ['NASA-published MODIS-based monthly global surface composite.', 'Unchanged provider JPEG rendition: no TerraMatch color changes, inpainting, super-resolution or generated geography.', 'Base imagery only; no shaded-relief/topography or bathymetry visualization selected.'],
    limitations: ['Historical monthly composite, not a live satellite image or current cloud/weather map.', 'A mosaic combines observations and provider compositing/gap-handling; it is not one simultaneous photograph.', 'Provider labels the 5400×2700 rendition approximately 8 km/pixel; native BMNG source detail is not preserved at this delivery size.', 'Optical color is separate from terrain elevation, temperature, cloud motion, atmosphere physics and surface classification.'],
    credit: 'NASA Earth Observatory / Reto Stöckli / NASA GSFC Blue Marble Next Generation; acknowledge the source product.',
    access: 'NASA publicly available imagery; NASA media-use and source-credit conditions apply.',
  },
  {
    body: 'mars', path: 'assets/official-mars.jpg',
    provider: 'NASA / Jet Propulsion Laboratory / Caltech; Viking imagery processed at USGS', product: 'NASA 3D Resources: Mars Image Texture',
    title: 'Mars — NASA/JPL Viking image texture',
    sourceUrl: 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/mars/Mars.jpg',
    documentationUrl: 'https://science.nasa.gov/3d-resources/mars/',
    metadataUrls: ['https://www.mars.asu.edu/data/mdim_color/', 'https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m'],
    registration: { projection: 'equirectangular', westLongitude: -180, eastLongitude: 180, northLatitude: 90, southLatitude: -90, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', primeMeridianAtU: 0.5, northAtV: 0, rowOrder: 'north-to-south', verification: 'NASA-published global Viking texture layout cross-checked against official Viking simple-cylindrical metadata and Olympus Mons/Valles Marineris/Syrtis Major placement. The JPEG has no embedded CRS; the NASA texture page does not specify its exact MDIM version.' },
    frame: 'Mars body-fixed geographic layout, east-positive longitudes. Registration is a global map-layout check, not a new geodetic control or current-date orientation solution.',
    acquisitionPeriod: 'Historical Viking orbital-image mosaic; exact constituent acquisition dates are not specified on the NASA 3D texture page.',
    processing: ['NASA describes the source as Viking images processed at USGS, from JPL/Caltech planetary maps.', 'Original published NASA JPEG copied unchanged; no TerraMatch recoloring, painting, generated gap filling or resampling.', 'The provider page does not identify the exact Viking MDIM revision; the separate MDIM documentation is used for coordinate-layout reference, not asserted as proof of byte-identical product lineage.'],
    limitations: ['Historical processed mosaic, not live color, dust, weather or season.', 'The provider JPEG is 1440×720: approximately 0.25° per delivered pixel, so rover-scale features are not resolved.', 'No radiometric calibration, per-pixel missing-data mask, or complete constituent-frame inventory accompanies this visualization texture.', 'The exact MDIM processing revision is not specified by NASA for this JPEG; do not claim a particular control accuracy.', 'A color-map feature or brightness is not a measured elevation, temperature, mineral abundance or water/ice detection.'],
    credit: 'NASA / Jet Propulsion Laboratory & Caltech; Viking imagery processed at USGS.',
    access: 'NASA publicly available image texture; retain NASA/JPL-Caltech credit.',
  },
  {
    body: 'moon', path: 'assets/official-moon.jpg',
    provider: 'USGS Astrogeology / NASA LRO / LROC Team / Arizona State University', product: 'LRO LROC WAC Global Morphology Mosaic 100m v3 — original USGS 1024-pixel sample',
    title: 'Moon — NASA LROC WAC monochrome global morphology mosaic',
    sourceUrl: 'https://astrogeology.usgs.gov/ckan/dataset/db948a2d-4d6a-4775-a0d3-12613d36f9e7/resource/d24d5ef3-abc5-42ee-ac7c-4c3261106327/download/moon_lro_lroc-wac_mosaic_global_1024.jpg',
    documentationUrl: 'https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m',
    metadataUrls: ['https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml', 'https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_GLOBAL'],
    registration: { projection: 'equirectangular', westLongitude: -180, eastLongitude: 180, northLatitude: 90, southLatitude: -90, latitudeConvention: 'planetocentric on the lunar reference sphere', longitudeDirection: 'east-positive', primeMeridianAtU: 0.5, northAtV: 0, rowOrder: 'north-to-south', verification: 'USGS product metadata specifies Simple Cylindrical and global bounds −180..180 longitude, −90..90 latitude. NASA Trek WAC capabilities independently give top-left −180,90 and the same geographic bounds.' },
    frame: 'Lunar body-fixed spherical geographic grid; USGS product reference radius 1,737,400 m. No ICRF orientation kernel is included in this image.',
    acquisitionPeriod: 'LROC images acquired November 2009–February 2011; v3 morphology mosaic created June 2013.',
    processing: ['Original USGS JPEG sample of the LROC WAC 643 nm monochromatic global morphology mosaic, copied unchanged.', 'Provider combined more than 15,000 observations and selected acquisition periods to reduce illumination differences; some gores were filled with real observations from other times.', 'Images were orthorectified against GLD100 and polar LOLA shape models. Source topography is used for geometric correction, not rendered as a color-coded elevation map.', 'This grayscale optical alternative is used because the preferred NASA SVS color-map host could not be reached from the build environment. It is not the SVS color/laser-albedo composite.'],
    limitations: ['A single-band grayscale morphology mosaic, not a natural-color RGB image.', 'Original USGS delivery is only 1024×512 (approximately 0.3516° or 10.7 km per delivered pixel at the equator). No upscaling or invented detail was applied.', 'The underlying source mosaic has approximately 100 m pixels, but this small JPEG does not retain that native resolution.', 'Polar shadow, different acquisition seasons, photometric seams and genuinely dark/unmapped areas remain as supplied by the provider. Darkness is not a mapped height, a temperature or proof of ice.', 'The JPEG includes no per-pixel validity mask; full nominal map extent does not establish a fully observed surface everywhere.', 'The historic mosaic does not reproduce illumination or permanent-shadow conditions at a chosen current date.'],
    credit: 'NASA/GSFC/Arizona State University; LROC Team; USGS Astrogeology. Cite Speyerer et al. (2011) and the June 2013 morphology mosaic.',
    access: 'USGS product metadata: public domain; please cite authors.',
  },
];

export function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('Provider response is not a JPEG.');
  let offset = 2;
  while (offset < buffer.length - 10) {
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    const length = buffer.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    if (length < 2) throw new Error('Invalid JPEG segment.');
    offset += length;
  }
  throw new Error('No JPEG dimension header was found.');
}

export async function fetchGlobeImagery({ download = true } = {}) {
  const images = [];
  let totalBytes = 0;
  const { readFile } = await import('node:fs/promises');
  for (const item of GLOBE_IMAGE_DEFINITIONS) {
    let bytes;
    if (download) {
      const response = await fetch(item.sourceUrl, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${item.body}: provider HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    } else bytes = await readFile(new URL(item.path, BASE));
    const dimensions = jpegDimensions(bytes);
    if (dimensions.width !== dimensions.height * 2) throw new Error(`${item.body}: provider map is not a 2:1 global raster.`);
    totalBytes += bytes.length;
    if (totalBytes > 20_000_000) throw new Error('Official map set exceeds the 20 MB delivery budget.');
    const target = new URL(item.path, BASE);
    if (download) { await mkdir(new URL('./', target), { recursive: true }); await writeFile(target, bytes); }
    const entry = { ...item, ...dimensions, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), retrievedAt: new Date().toISOString(), fileTransformation: 'None: provider-published JPEG bytes retained.' };
    images.push(entry);
    console.log(JSON.stringify({ body: item.body, path: item.path, ...dimensions, bytes: bytes.length, sha256: entry.sha256 }));
  }
  const manifest = { schemaVersion: 1, images, totalBytes, imagePolicy: 'Original provider renditions only. No generated geography, color retouching, super-resolution or invented terrain. Provider processing and coverage limits are disclosed per image.' };
  await writeFile(new URL('data/globe-imagery-sources.json', BASE), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await fetchGlobeImagery({ download: !process.argv.includes('--metadata-only') });
}
