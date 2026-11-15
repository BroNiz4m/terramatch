/** Observed Sentinel-2 imagery. Selection is bounded, reproducible and independent of terrain scores. */
export const EARTH_IMAGERY_SOURCES = [
  {
    id: 'sentinel2-recent', body: 'earth', title: 'Copernicus Sentinel-2 L2A · recent screened observation',
    agency: 'ESA Copernicus · Microsoft Planetary Computer',
    url: 'https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a',
    license: 'Contains modified Copernicus Sentinel data. Freely accessible mission data; retain Copernicus and service attribution.',
    credit: 'Contains modified Copernicus Sentinel data · ESA / European Union · hosted by Microsoft Planetary Computer',
    note: 'Search up to 48 recent catalogue items in 180 days; inspect at most 6 full-footprint scenes, newest first. Sample the local Scene Classification Layer for clouds, cirrus, cloud shadow and missing data. This is a bounded search, not a guarantee of the newest or cloud-free observation. Imagery does not change terrain scores.',
    period: 'Observation date comes from the selected catalogue item', resolution: '10 m true-colour source · 20 m classification source'
  },
  {
    id: 'sentinel2-eox-2025', body: 'earth', title: 'EOxCloudless 2025 · annual Sentinel-2 mosaic',
    agency: 'ESA Copernicus / EOX IT Services GmbH', url: 'https://cloudless.eox.at/documentation/faq',
    license: 'CC BY-NC-SA 4.0. Educational/non-commercial use; retain EOX/Copernicus credit and ShareAlike terms for image derivatives. Public service fair use; no availability guarantee.',
    note: 'Annual 2025 cloudless mosaic used when a recent full-footprint observation cannot be selected. Individual acquisition dates vary across the mosaic; not current conditions or ranking input.',
    period: '2025 annual mosaic · individual dates vary',
    credit: 'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025) · CC BY-NC-SA 4.0',
    endpoint: 'https://tiles.maps.eox.at/wms', layer: 's2cloudless-2025', resolution: '10 m nominal mosaic source; resampled preview'
  }
];

const API = 'https://planetarycomputer.microsoft.com/api';
export const RECENT_POLICY = Object.freeze({lookbackDays: 180, catalogueLimit: 48, sceneLimit: 6, maxObscuredFraction: .1, minValidFraction: .98, qualitySize: 128});

export function recentSearchURL(bounds, now = new Date()) {
  const start = new Date(now.getTime() - RECENT_POLICY.lookbackDays * 86400000);
  const url = new URL(API + '/stac/v1/search');
  url.search = new URLSearchParams({collections: 'sentinel-2-l2a', bbox: [bounds.west, bounds.south, bounds.east, bounds.north].join(','),
    datetime: start.toISOString() + '/' + now.toISOString(), sortby: '-datetime', limit: String(RECENT_POLICY.catalogueLimit),
    query: JSON.stringify({'eo:cloud_cover': {lte: 40}})});
  return url.href;
}

function inRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [a, b] = ring[j];
    if ((y > point[1]) !== (b > point[1]) && point[0] < (a - x) * (point[1] - y) / (b - y) + x) inside = !inside;
  }
  return inside;
}
function inGeometry(point, geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some(rings => rings?.[0]?.length >= 4 && inRing(point, rings[0]) && !rings.slice(1).some(ring => inRing(point, ring)));
}
export function eligibleRecentScenes(features, bounds, now = new Date()) {
  const earliest = now.getTime() - RECENT_POLICY.lookbackDays * 86400000;
  const probes = [];
  for (let y = 0; y <= 4; y++) for (let x = 0; x <= 4; x++) probes.push([bounds.west + (bounds.east - bounds.west) * x / 4, bounds.south + (bounds.north - bounds.south) * y / 4]);
  const seen = new Set();
  return (Array.isArray(features) ? features : []).filter(item => {
    const date = Date.parse(item.properties?.datetime), cloud = item.properties?.['eo:cloud_cover'];
    if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(item.id) || seen.has(item.id) || item.collection !== 'sentinel-2-l2a') return false;
    seen.add(item.id);
    return Number.isFinite(date) && date >= earliest && date <= now.getTime() && Number.isFinite(cloud) && cloud <= 40 && cloud >= 0 &&
      item.assets?.visual && item.assets?.SCL && probes.every(point => inGeometry(point, item.geometry));
  }).sort((a, b) => Date.parse(b.properties.datetime) - Date.parse(a.properties.datetime) || a.id.localeCompare(b.id));
}

export function sceneImageURL(item, bounds, asset, width, height = width) {
  const url = new URL(API + '/data/v1/item/bbox/' + [bounds.west, bounds.south, bounds.east, bounds.north].join(',') + '/' + width + 'x' + height + '.png');
  url.search = new URLSearchParams({collection: 'sentinel-2-l2a', item: item.id, assets: asset, dst_crs: 'EPSG:4326',
    resampling: asset === 'SCL' ? 'nearest' : 'bilinear', reproject: asset === 'SCL' ? 'nearest' : 'bilinear', return_mask: 'true'});
  return url.href;
}

export function classificationQuality(pixels) {
  let valid = 0, obscured = 0, snow = 0, unknown = 0;
  const total = pixels.length / 4;
  if (!total || !Number.isInteger(total)) throw Error('Invalid classification image.');
  for (let i = 0; i < pixels.length; i += 4) {
    const value = pixels[i];
    if (pixels[i + 3] < 250 || value < 2 || value > 11) continue;
    valid++;
    if ([3, 8, 9, 10].includes(value)) obscured++;
    if (value === 7) unknown++;
    if (value === 11) snow++;
  }
  const validFraction = valid / total, obscuredFraction = valid ? obscured / valid : 1;
  return {validFraction, obscuredFraction, unclassifiedFraction: valid ? unknown / valid : 1, snowFraction: valid ? snow / valid : 0,
    accepted: validFraction >= RECENT_POLICY.minValidFraction && obscuredFraction <= RECENT_POLICY.maxObscuredFraction && unknown / (valid || 1) <= .05};
}

function deadline(signal, ms) {
  const controller = new AbortController(), abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(abort, ms);
  return {signal: controller.signal, close() { clearTimeout(timer); signal?.removeEventListener('abort', abort); }};
}

export async function loadRecentEarthImagery(plan, {signal, fetchImpl = globalThis.fetch, decodeImage, createCanvas, loadArchive, now = new Date(), recentTimeoutMs = 22000, onProgress = () => {}}) {
  const recent = deadline(signal, recentTimeoutMs), inspected = [], searchURL = recentSearchURL(plan.bounds, now);
  let reason = '', matched = 0, eligible = 0;
  async function readImage(url, width, height) {
    const request = deadline(recent.signal, 8000);
    try {
      const response = await fetchImpl(url, {signal: request.signal, mode: 'cors', cache: 'force-cache'});
      if (!response.ok) throw Error('Image service returned HTTP ' + response.status + '.');
      const bytes = await response.arrayBuffer(), signature = new Uint8Array(bytes);
      if (bytes.byteLength > 5000000 || !(signature[0] === 137 && signature[1] === 80 && signature[2] === 78 && signature[3] === 71)) throw Error('No usable observation image was returned.');
      const image = await decodeImage(new Blob([bytes], {type: 'image/png'}));
      try {
        if (recent.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (image.width !== width || image.height !== height) throw Error('Observation image dimensions do not match the request.');
        const canvas = createCanvas(); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d', {willReadFrequently: true});
        if (!context) throw Error('Image inspection is unavailable.');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, width, height).data;
        const sha256 = globalThis.crypto?.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('') : null;
        return {canvas, pixels, record: {url, bytes: bytes.byteLength, sha256}};
      } finally { image.close?.(); }
    } finally { request.close(); }
  }
  try {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (plan.bounds.west < -180 || plan.bounds.east > 180) throw Error('Recent-scene selection does not span the date line; using the annual mosaic for this footprint.');
    onProgress('Looking for recent Sentinel-2 observations…');
    const search = deadline(recent.signal, 8000);
    let catalogue;
    try {
      const response = await fetchImpl(searchURL, {signal: search.signal, mode: 'cors', cache: 'no-cache'});
      if (!response.ok) throw Error('The recent-observation catalogue is unavailable (HTTP ' + response.status + ').');
      catalogue = await response.json();
      if (!Array.isArray(catalogue.features)) throw Error('The observation catalogue returned an invalid result.');
    } finally { search.close(); }
    matched = catalogue.features.length;
    const scenes = eligibleRecentScenes(catalogue.features, plan.bounds, now); eligible = scenes.length;
    if (!scenes.length) reason = 'No recent low-cloud scene covered the full study area in the bounded 180-day search.';
    for (const item of scenes.slice(0, RECENT_POLICY.sceneLimit)) {
      if (recent.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const entry = {itemId: item.id, observedAt: item.properties.datetime}; inspected.push(entry);
      try {
        onProgress('Checking local clouds and coverage · ' + entry.observedAt.slice(0, 10));
        const mask = await readImage(sceneImageURL(item, plan.bounds, 'SCL', RECENT_POLICY.qualitySize), RECENT_POLICY.qualitySize, RECENT_POLICY.qualitySize);
        const quality = classificationQuality(mask.pixels); entry.quality = quality; entry.classificationRequest = mask.record;
        if (!quality.accepted) { entry.reason = 'Missing coverage, cloud/shadow or unclassified pixels exceeded the selection threshold.'; continue; }
        const visual = await readImage(sceneImageURL(item, plan.bounds, 'visual', plan.size, plan.height), plan.size, plan.height);
        let valid = 0, min = 255, max = 0;
        for (let i = 0; i < visual.pixels.length; i += 4) {
          if (visual.pixels[i + 3] >= 250 && visual.pixels[i] + visual.pixels[i + 1] + visual.pixels[i + 2] > 0) valid++;
          min = Math.min(min, visual.pixels[i], visual.pixels[i + 1], visual.pixels[i + 2]);
          max = Math.max(max, visual.pixels[i], visual.pixels[i + 1], visual.pixels[i + 2]);
        }
        if (valid / (visual.pixels.length / 4) < .98 || max - min < 2) throw Error('The true-colour image has incomplete or blank coverage.');
        const blob = await new Promise((resolve, reject) => visual.canvas.toBlob(value => value ? resolve(value) : reject(Error('Could not prepare observation preview.')), 'image/png'));
        if (recent.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const source = EARTH_IMAGERY_SOURCES[0]; entry.accepted = true;
        return {blob, metadata: {siteId: plan.siteId, body: 'earth', center: plan.center, bounds: plan.bounds,
          extentMeters: {width: plan.widthMeters, depth: plan.depthMeters}, sourceId: source.id, product: source.title,
          sourceURL: API + '/stac/v1/collections/sentinel-2-l2a/items/' + encodeURIComponent(item.id),
          period: 'Observed ' + entry.observedAt.slice(0, 10) + ' · recent screened scene', observedAt: entry.observedAt,
          platform: item.properties.platform || 'Sentinel-2', instrument: 'MSI', sourceResolutionMeters: 10,
          resolution: source.resolution, previewSamplingMeters: plan.widthMeters / plan.size, imageryStatus: 'recent-observation',
          credit: source.credit, license: source.license, caveat: source.note, quality, opaqueCoverage: valid / (visual.pixels.length / 4),
          retrievedAt: new Date().toISOString(), selection: {searchURL, searchedAt: now.toISOString(), policy: RECENT_POLICY, catalogueMatched: matched, eligibleScenes: eligible, inspected},
          processing: 'Sentinel-2 true-colour observation cropped to the study bounds, reprojected north-up and resampled for display. Local cloud/shadow screening uses a 128 × 128 sample of the 20 m SCL product; classifications are estimates, not a guarantee of clear ground. No generated detail. Independent of DEM measurements and ranking.',
          requests: [mask.record, visual.record]}};
      } catch (error) {
        if (recent.signal.aborted) throw error;
        entry.reason = error.message;
      }
    }
    reason ||= 'No inspected recent scene passed the local cloud and full-coverage checks.';
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    reason = recent.signal.aborted ? 'The recent-observation search timed out.' : error.message;
  } finally { recent.close(); }
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  onProgress('Loading the 2025 annual mosaic · recent scene unavailable…');
  const archive = await loadArchive();
  archive.metadata.imageryStatus = 'archive-fallback';
  archive.metadata.selectionReason = reason;
  archive.metadata.selection = {searchURL, searchedAt: now.toISOString(), policy: RECENT_POLICY, catalogueMatched: matched, eligibleScenes: eligible, inspected};
  return archive;
}
