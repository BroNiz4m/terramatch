import {isLand} from './land-geometry.js';

export const PLACE_REGIONS_SHA256 = 'f3964abf334fcc039826efe9dad4627bbbb1ced18a046d94c2ed761aaec8d698';
export const PLACE_NAME_SOURCE = {
  id: 'natural-earth-regions', title: 'Study-area names — Natural Earth administrative regions',
  agency: 'Natural Earth', url: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/',
  license: 'Public domain. Made with Natural Earth.',
  note: 'Approximate state/province and country labels for the study-area center, from bundled simplified administrative polygons. Generalized historical boundaries can be outdated or disputed. A 32 km area may cross boundaries. Labels identify geographic regions; analog status requires separate scientific evidence.'
};
const REGIONS_URL = new URL('../data/place-regions.json.gz', import.meta.url).href;
let regionsPromise;

export function clearPlaceNameCache() { regionsPromise = undefined; }

async function loadRegions(signal) {
  signal?.throwIfAborted();
  if (!regionsPromise) {
    const request = (async () => {
      const response = await fetch(REGIONS_URL, {signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`Geographic names unavailable (${response.status}).`);
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== PLACE_REGIONS_SHA256) throw new Error('Geographic names failed their source hash check.');
      const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const regions = JSON.parse(text);
      if (regions.version !== 'natural-earth-regions-v1' || !regions.features?.length) throw new Error('Invalid geographic names dataset.');
      return regions;
    })();
    regionsPromise = request;
    request.catch(() => { if (regionsPromise === request) regionsPromise = undefined; });
  }
  if (!signal) return regionsPromise;
  // Each caller can cancel independently while the shared static asset finishes loading.
  let onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason || new DOMException('Cancelled', 'AbortError'));
    signal.addEventListener('abort', onAbort, {once: true});
    if (signal.aborted) onAbort();
  });
  try { return await Promise.race([regionsPromise, cancelled]); }
  finally { signal.removeEventListener('abort', onAbort); }
}

export function regionAt(lat, lon, regions) {
  const matches = regions.features.filter(feature => {
    const [west, south, east, north] = feature.bbox;
    return lon >= west && lon <= east && lat >= south && lat <= north && isLand(lon, lat, feature);
  });
  const subdivisions = matches.filter(feature => feature.properties.level === 'region');
  const countries = matches.filter(feature => feature.properties.level === 'country');
  const selected = subdivisions.length === 1 ? subdivisions[0] : countries.length === 1 ? countries[0] : null;
  return selected?.properties || null;
}

export async function nameSearchWindow(record, {signal} = {}) {
  signal?.throwIfAborted();
  const {site, data} = record;
  const previous = data.source.placeName;
  if (previous?.datasetSha256 === PLACE_REGIONS_SHA256 && previous.center?.lat === site.lat && previous.center?.lon === site.lon) return record;
  const genericName = site.origin === 'automatic'
    || /^(Selected coordinates|Globe-selected location)$/i.test(site.name)
    || /^Earth\s+[+-]?\d[\d.]*°?,\s*[+-]?\d[\d.]*°?$/i.test(site.name)
    || /^Study area\s+\d[\d.]*°[NS],\s*\d[\d.]*°[EW]$/i.test(site.name);
  if (!genericName && site.country && !['Earth', 'Selected Earth location', 'Region unresolved'].includes(site.country)) {
    data.name = site.name;
    return record;
  }
  let location;
  try {
    const regions = await loadRegions(signal);
    const match = regionAt(site.lat, site.lon, regions);
    location = {status: match ? 'regional-label' : 'unresolved', sourceId: PLACE_NAME_SOURCE.id,
      datasetSha256: PLACE_REGIONS_SHA256, revision: regions.revision,
      region: match?.level === 'region' ? match.name : null, country: match?.country || null,
      center: {lat: site.lat, lon: site.lon}, approximate: true, limitation: regions.limitation};
    if (match) {
      if (genericName) site.name = `${match.name} study area`;
      if (!site.country || ['Earth', 'Selected Earth location', 'Region unresolved'].includes(site.country)) site.country = match.country;
    }
  } catch (error) {
    if (signal?.aborted) throw signal.reason || error;
    location = {status: 'unavailable', sourceId: PLACE_NAME_SOURCE.id, reason: error.message};
  }
  if (genericName && location.status !== 'regional-label') {
    site.name = `Study area ${Math.abs(site.lat).toFixed(3)}°${site.lat < 0 ? 'S' : 'N'}, ${Math.abs(site.lon).toFixed(3)}°${site.lon < 0 ? 'W' : 'E'}`;
  }
  if (site.country === 'Earth') site.country = 'Region unresolved';
  if (location.status === 'regional-label' && !site.sourceIds.includes(PLACE_NAME_SOURCE.id)) site.sourceIds.push(PLACE_NAME_SOURCE.id);
  data.name = site.name;
  data.source.placeName = location;
  return record;
}
