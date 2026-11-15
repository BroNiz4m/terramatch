import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

// Geographic labels only. Terrain eligibility continues to use the original land masks.
const revision = 'ca96624a56bd078437bca8184e78163e5039ad19';
const datasets = ['ne_10m_admin_1_states_provinces', 'ne_110m_admin_0_countries'];
const sourceHashes = ['22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5', '6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f'];
const tolerance = 0.005;
const sourceDirectory = process.argv.includes('--source-dir')
  ? process.argv[process.argv.indexOf('--source-dir') + 1] : null;
if (!sourceDirectory && !process.argv.includes('--fetch')) {
  throw new Error('Use --fetch or --source-dir <directory containing the original GeoJSON files>.');
}

function segmentDistanceSquared(point, start, end) {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const fraction = dx || dy
    ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return (point[0] - start[0] - fraction * dx) ** 2 + (point[1] - start[1] - fraction * dy) ** 2;
}

function simplifyRing(ring) {
  const keep = new Set([0, ring.length - 1]);
  const pending = [[0, ring.length - 1]];
  while (pending.length) {
    const [start, end] = pending.pop();
    let greatest = tolerance ** 2, selected = -1;
    for (let index = start + 1; index < end; index++) {
      const distance = segmentDistanceSquared(ring[index], ring[start], ring[end]);
      if (distance > greatest) { greatest = distance; selected = index; }
    }
    if (selected >= 0) {
      keep.add(selected);
      pending.push([start, selected], [selected, end]);
    }
  }
  // Preserve dateline rings and very small polygons rather than collapsing them.
  const crossesDateline = ring.some((point, index) => index && Math.abs(point[0] - ring[index - 1][0]) > 180);
  const selected = keep.size >= 4 && !crossesDateline ? ring.filter((_, index) => keep.has(index)) : ring;
  return selected.map(point => point.map(value => Number(value.toFixed(5))));
}

const sources = [], features = [];
for (const dataset of datasets) {
  const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${revision}/geojson/${dataset}.geojson`;
  let bytes;
  if (sourceDirectory) bytes = await fs.readFile(path.join(sourceDirectory, `${dataset}.geojson`));
  else {
    const response = await fetch(url, {signal: AbortSignal.timeout(90000)});
    if (!response.ok) throw new Error(`${dataset}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== sourceHashes[datasets.indexOf(dataset)]) throw new Error(`Original source hash mismatch: ${dataset}`);
  sources.push({dataset, url, sha256: hash, bytes: bytes.length});
  const collection = JSON.parse(bytes);
  for (const feature of collection.features) {
    const p = feature.properties, region = dataset.includes('admin_1');
    const name = region ? p.name_en || p.name : p.NAME_EN || p.ADMIN;
    const country = region ? p.admin : p.NAME_EN || p.ADMIN;
    if (!name || !country) continue;
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const coordinates = polygons.map(polygon => polygon.map(simplifyRing));
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const polygon of coordinates) for (const ring of polygon) for (const [lon, lat] of ring) {
      bbox[0] = Math.min(bbox[0], lon); bbox[1] = Math.min(bbox[1], lat);
      bbox[2] = Math.max(bbox[2], lon); bbox[3] = Math.max(bbox[3], lat);
    }
    features.push({type: 'Feature', properties: {name, country, level: region ? 'region' : 'country'}, bbox,
      geometry: {type: 'MultiPolygon', coordinates}});
  }
}
const collection = {type: 'FeatureCollection', version: 'natural-earth-regions-v1',
  attribution: 'Made with Natural Earth. Public domain.', revision, sources,
  simplificationToleranceDegrees: tolerance,
  limitation: 'Approximate regional labels for the study-area center. Generalized historical boundaries can be outdated or disputed. A study area can cross regional boundaries. Labels do not identify a settlement, geological unit or validated analog.', features};
const output = gzipSync(JSON.stringify(collection) + '\n', {level: 9});
await fs.writeFile(new URL('../dist/data/place-regions.json.gz', import.meta.url), output);
console.log(JSON.stringify({features: features.length, bytes: output.length, sha256: createHash('sha256').update(output).digest('hex')}));
