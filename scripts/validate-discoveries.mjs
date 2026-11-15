import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeTerrarium} from '../dist/js/terrain-search.js';
import {SITES, analyzeTerrain, compareTerrains} from '../dist/js/science.js';
import {fetchMarsTerrain} from './lib/planetary-terrain.mjs';
import {comparisonStatus} from '../dist/js/comparison-status.js';
import {characterizeComparison} from '../dist/js/terrain-characterization.js';
import {areaLiteratureReview, containsReference} from '../dist/js/reviewed-areas.js';

// Offline source reconstruction and bounded scientific review. Existing research remains an input archive.
const root = new URL('../', import.meta.url);
const archive = new URL('research/earth-analog-survey-2026-11-15/', root);
const out = new URL('research/discovery-validation-2026-11-15/', root);
const readJSON = async url => JSON.parse(await fs.readFile(url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const original = await readJSON(new URL('results.json', archive));
const retrieval = await readJSON(new URL('retrieval.json', archive));
const literature = await readJSON(new URL('literature-manifest.json', out));
const selection = ['idaho-sample-04', 'idaho-sample-09', 'idaho-sample-06', 'craters-moon', 'amboy'];
const productionPaths = (await fs.readdir(new URL('dist/data/', root))).map(name => 'dist/data/' + name)
  .concat(['dist/js/science.js', 'dist/js/comparison-status.js', 'dist/js/reviewed-areas.js', 'dist/js/terrain-characterization.js']);
const fingerprints = async () => Object.fromEntries(await Promise.all(productionPaths.map(async path => [path, digest(await fs.readFile(new URL(path, root)))])));
const before = await fingerprints();
let checks = 0, reconstructed = 0, subsetPairIndicesComputed = 0;
function close(actual, expected, tolerance = 1e-8) { assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`); checks++; }

const tiles = new Map();
for (const source of retrieval.files) {
  const bytes = await fs.readFile(new URL(source.file, archive));
  assert.equal(digest(bytes), source.sha256);
  tiles.set(source.url, {...await decodeTerrarium(bytes), sha256: source.sha256});
}
for (const source of literature.filter(source => source.file)) {
  assert.equal(digest(await fs.readFile(new URL(source.file, out))), source.sha256);
}

function independentStats(data) {
  const heights = data.heights, size = data.size, angles = [], bins = [2, 5, 10, 20, 35, 90], counts = Array(6).fill(0);
  for (let row = 1; row < size - 1; row++) for (let col = 1; col < size - 1; col++) {
    const index = row * size + col;
    const angle = Math.atan(Math.hypot((heights[index + 1] - heights[index - 1]) / 1000, (heights[index + size] - heights[index - size]) / 1000)) * 180 / Math.PI;
    angles.push(angle); counts[bins.findIndex(edge => angle < edge)]++;
  }
  angles.sort((a, b) => a - b);
  return {relief: Math.max(...heights) - Math.min(...heights), slopeMean: angles.reduce((sum, value) => sum + value, 0) / angles.length,
    slopeP90: angles[Math.floor(.9 * (angles.length - 1))], histogram: counts.map(count => count / angles.length)};
}
function independentIndex(a, b) {
  const slope = .5 * a.histogram.reduce((sum, share, index) => sum + Math.abs(share - b.histogram[index]), 0);
  const relief = Math.min(1, Math.abs(Math.log((a.relief + 1) / (b.relief + 1))) / Math.log(4));
  return Math.round(100 * (1 - .65 * slope - .35 * relief) * 10) / 10;
}
function cropStats(data, extentKm) {
  const size = extentKm * 2 + 1, result = [];
  for (const x of [-8, -4, 0, 4, 8]) for (const y of [-8, -4, 0, 4, 8]) {
    const startRow = (65 - size) / 2 + y, startCol = (65 - size) / 2 + x, heights = [];
    for (let row = 0; row < size; row++) heights.push(...data.heights.slice((startRow + row) * 65 + startCol, (startRow + row) * 65 + startCol + size));
    result.push({centered: !x && !y, stats: independentStats({size, heights})});
  }
  return result;
}

const targetSite = SITES.find(site => site.id === 'jezero');
const targetBytes = await fs.readFile(new URL('dist/data/jezero-terrain.json', root));
const targetData = JSON.parse(targetBytes);
const marsSources = new URL('research/jezero-amboy-case-2026-11-15/', root);
const marsManifest = await readJSON(new URL('source-manifest.json', marsSources));
async function marsSource(url) {
  const source = marsManifest[url]; assert.ok(source, `Missing source ${url}`);
  const bytes = await fs.readFile(new URL(source.file, marsSources));
  assert.equal(digest(bytes), source.sha256); return bytes;
}
const reconstructedMars = await fetchMarsTerrain(targetSite, {readLabel: async url => (await marsSource(url)).toString('utf8'), readRange: marsSource});
assert.deepEqual(reconstructedMars.heights, targetData.heights); reconstructed += targetData.heights.length;
const targetStats = independentStats(targetData);
const targetSubsets = Object.fromEntries([16, 24].map(size => [size, cropStats(targetData, size)]));

const results = [];
for (const id of selection) {
  const entry = original.windows.find(window => window.candidate.id === id);
  const bytes = await fs.readFile(new URL(entry.file, archive));
  const saved = JSON.parse(bytes), data = saved.data, zoom = data.source.zoom, scale = 256 * 2 ** zoom;
  const byKey = new Map(data.source.files.map(source => {
    const tile = tiles.get(source.url); assert.equal(tile.sha256, source.sha256); return [`${source.x}/${source.y}`, tile];
  }));
  const pixel = (x, y) => {
    x = ((x % scale) + scale) % scale; y = Math.max(0, Math.min(scale - 1, y));
    const tile = byKey.get(`${Math.floor(x / 256)}/${Math.floor(y / 256)}`); assert.ok(tile);
    return tile.heights[(y % 256) * 256 + x % 256];
  };
  for (let row = 0; row < 65; row++) for (let col = 0; col < 65; col++) {
    const lat = data.bounds.north + (data.bounds.south - data.bounds.north) * row / 64;
    const lon = data.bounds.west + (data.bounds.east - data.bounds.west) * col / 64;
    const x = (lon + 180) / 360 * scale - .5, y = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * scale - .5;
    const ix = Math.floor(x), iy = Math.floor(y), dx = x - ix, dy = y - iy;
    const height = (pixel(ix, iy) * (1 - dx) + pixel(ix + 1, iy) * dx) * (1 - dy) + (pixel(ix, iy + 1) * (1 - dx) + pixel(ix + 1, iy + 1) * dx) * dy;
    close(Math.round(height * 100) / 100, data.heights[row * 65 + col]); reconstructed++;
  }
  const own = independentStats(data), app = analyzeTerrain(data);
  for (const key of ['relief', 'slopeMean', 'slopeP90']) close(own[key], app[key]);
  own.histogram.forEach((value, index) => close(value, app.slopeHistogram[index]));
  const evidence = characterizeComparison(targetData, data, {target: targetSite, candidate: saved.site});
  close(evidence.measurements.earth.under5, own.histogram[0] + own.histogram[1]);
  if (evidence.scoreEligible) {
    close(evidence.score, independentIndex(targetStats, own));
    for (const extent of evidence.sensitivity.extents) {
      const a = targetSubsets[extent.extentKm], b = cropStats(data, extent.extentKm);
      const indices = a.flatMap(target => b.map(earth => independentIndex(target.stats, earth.stats)));
      close(extent.shiftedMinimum, Math.min(...indices)); close(extent.shiftedMaximum, Math.max(...indices));
      close(extent.centeredIndex, independentIndex(a.find(row => row.centered).stats, b.find(row => row.centered).stats));
      subsetPairIndicesComputed += indices.length;
    }
  } else { assert.equal(evidence.score, null); assert.equal(evidence.sensitivity.status, 'withheld'); }
  results.push({id, inputPath: 'research/earth-analog-survey-2026-11-15/' + entry.file, inputSha256: digest(bytes),
    center: data.center, bounds: data.bounds, sourceFiles: data.source.files,
    historicalIndexBeforeReview: original.comparisons.find(target => target.targetId === 'jezero').ranked.find(row => row.id === id)?.presets.terrain.score ?? null,
    characterization: evidence});
}

const magicResult = results.find(result => result.id === 'idaho-sample-04');
assert.ok(magicResult.characterization.coverage.knownWaterReviews.some(reference => containsReference(magicResult.bounds, reference)));
assert.equal(magicResult.characterization.scoreEligible, false);
const blmSource=literature.find(source=>source.id==='magic-reservoir');
assert.equal(blmSource.status,200);
const marker=(await fs.readFile(new URL(blmSource.file,out),'utf8')).match(/marker:([-\d.]+)%2C([-\d.]+)/);
assert.ok(marker,'Published BLM map marker is retained in the archived source');
const magicReference=magicResult.characterization.coverage.knownWaterReviews.find(reference=>reference.id==='magic-reservoir');
close(magicReference.lon,Number(marker[1]));close(magicReference.lat,Number(marker[2]));
assert.equal(areaLiteratureReview({body: 'earth', center: {lat: 43.5, lon: -113}, widthMeters: 32000, depthMeters: 32000}), null, 'nearby windows do not inherit literature');

const rankings = [];
for (const entry of original.windows) {
  const saved = await readJSON(new URL(entry.file, archive));
  if (comparisonStatus(saved.site, saved.data).scoreEligible && !saved.candidate.withholdTerrainScore) {
    rankings.push({id: entry.candidate.id, score: compareTerrains(targetData, saved.data).score, control: !!saved.candidate.control});
  }
}
rankings.sort((a, b) => b.score - a.score);
assert.equal(rankings.length, 17); assert.ok(!rankings.some(row => row.id === 'idaho-sample-04'));
assert.deepEqual(await fingerprints(), before);
const report = {version: 1, localDate: '2026-11-15',
  scope: 'Three generated Idaho areas and two established references assessed for Jezero regional-terrain reconnaissance. Area identities and literature precede stronger claims.',
  selectionRule: 'Review the original high-scoring sample 04, the next generated candidate 09, and sample 06 as a documented volcanic example, alongside Craters of the Moon and same-pipeline Amboy controls. Retain failures and adverse findings.',
  target: {id: targetSite.id, inputSha256: digest(targetBytes), source: targetData.source}, results, currentResearchRanking: rankings,
  literatureAccess: literature.map(({id, url, status, error}) => ({id, url, status, error})),
  verification: {numericalChecks: checks, reconstructedHeights: reconstructed, terrainPngHashesVerified: retrieval.files.length,
    literatureResponseHashesVerified: literature.filter(source => source.file).length, successfulLiteratureResponses: literature.filter(source => source.status === 200).length,
    subsetPairIndicesComputed, sourceElevationFetches: 0, productionFingerprintsUnchanged: true}, productionFingerprints: before};
await fs.mkdir(out, {recursive: true});
await fs.writeFile(new URL('results.json', out), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({verification: report.verification, results: results.map(result => ({id: result.id, score: result.characterization.score, priorUse: result.characterization.literature.priorUse})), leaders: rankings.slice(0, 4)}, null, 2));
