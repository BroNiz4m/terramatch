/** Re-fetch the actual numeric NASA POWER TS reference series; no API key needed. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SITES } from '../dist/js/science.js';
import { buildEarthThermalURL, parsePowerThermalResponse, DEFAULT_EARTH_THERMAL_PERIOD } from '../dist/js/earth-thermal.js';

const directory = new URL('../dist/data/', import.meta.url);
const selectedId = process.argv[2];
const sites = SITES.filter(site => site.body === 'earth' && (!selectedId || site.id === selectedId));
if (!sites.length) throw new Error('No matching reference Earth site.');
await mkdir(directory, { recursive: true });
for (const site of sites) {
  const options = { lat: site.lat, lon: site.lon, siteId: site.id, ...DEFAULT_EARTH_THERMAL_PERIOD };
  const url = buildEarthThermalURL(options);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${site.id}: POWER HTTP ${response.status}`);
  const raw = await response.text();
  const rawResponseSHA256 = createHash('sha256').update(raw).digest('hex');
  const record = parsePowerThermalResponse(JSON.parse(raw), { ...options, requestUrl: url, retrievedAt: new Date().toISOString(), rawResponseSHA256, retrievalMode: 'bundled' });
  if (!['ready', 'partial'].includes(record.status)) throw new Error(`${site.id}: ${record.error?.message ?? record.status}`);
  record.source.rawResponseFile = `data/earth-thermal-${site.id}-raw.json`;
  await writeFile(new URL(`earth-thermal-${site.id}-raw.json`, directory), raw);
  await writeFile(new URL(`earth-thermal-${site.id}.json`, directory), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ site: site.id, status: record.status, days: record.summary.validCount, sources: record.source.modelProducts, minDailyMeanK: record.summary.minimumDailyMeanK, maxDailyMeanK: record.summary.maximumDailyMeanK, hash: rawResponseSHA256, output: fileURLToPath(new URL(`earth-thermal-${site.id}.json`, directory)) }));
}
