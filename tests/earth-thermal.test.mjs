import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildEarthThermalURL, parsePowerThermalResponse, fetchEarthThermal, loadEarthThermal, clearEarthThermalCache } from '../dist/js/earth-thermal.js';

const location = { lat: 29.575, lon: 35.419, siteId: 'wadi-rum', start: '20250101', end: '20250103' };
const payload = (values = { 20250101: 0, 20250102: -999, 20250103: 10 }, units = 'C') => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [35.419, 29.575, 1076.35] },
  properties: { parameter: { TS: values } },
  parameters: { TS: { units, longname: 'Earth Skin Temperature' } },
  header: { sources: ['MERRA2'], api: { version: 'fixture' }, time_standard: 'LST', fill_value: -999, start: '20250101', end: '20250103' }, messages: [],
});
const mockResponse = data => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });

test('POWER requests the TS physical variable and explicit local-solar-time period', () => {
  const url = new URL(buildEarthThermalURL(location));
  assert.equal(url.hostname, 'power.larc.nasa.gov');
  assert.equal(url.searchParams.get('parameters'), 'TS');
  assert.equal(url.searchParams.get('start'), '20250101');
  assert.equal(url.searchParams.get('time-standard'), 'LST');
  assert.throws(() => buildEarthThermalURL({ ...location, lat: 91 }), /latitude/);
  assert.throws(() => buildEarthThermalURL({ ...location, start: '20250230' }), /calendar/);
  assert.throws(() => buildEarthThermalURL({ ...location, end: '20241231' }), /after/);
});

test('Celsius is converted to Kelvin, 0°C remains valid, fill stays null', () => {
  const record = parsePowerThermalResponse(payload(), location);
  assert.equal(record.status, 'partial');
  assert.deepEqual(record.series, [{ time: '2025-01-01', valueK: 273.15 }, { time: '2025-01-02', valueK: null }, { time: '2025-01-03', valueK: 283.15 }]);
  assert.equal(record.summary.meanOfDailyMeansK, 278.15);
  assert.equal(record.summary.minimumDailyMeanK, 273.15);
  assert.equal(record.summary.maximumDailyMeanK, 283.15);
  assert.equal(record.summary.minimumDailyMeanDate, '2025-01-01');
  assert.equal(record.summary.validCount, 2);
  assert.equal(record.summary.missingCount, 1);
  assert.equal(record.monthly[0].valueK, 278.15);
  assert.equal(record.metric.statistic, 'daily_mean');
  assert.equal(record.metric.timeStandardMeaning, 'Local Solar Time');
  assert.deepEqual(record.source.modelProducts, ['MERRA2']);
});

test('missing or all-fill days cannot produce a fabricated zero-degree series', () => {
  const missing = parsePowerThermalResponse(payload({ 20250101: -999 }), location);
  assert.equal(missing.status, 'no-data');
  assert.equal(missing.summary.meanOfDailyMeansK, null);
  assert.equal(missing.summary.coverageFraction, 0);
  assert.deepEqual(missing.actualPeriod, { start: null, end: null });
  assert.ok(missing.series.every(p => p.valueK === null));
  const absent = parsePowerThermalResponse({}, location);
  assert.equal(absent.status, 'no-data');
  assert.equal(absent.error.code, 'no-ts-values');
});

test('native Kelvin is not converted twice; unknown units fail explicitly', () => {
  assert.equal(parsePowerThermalResponse(payload({ 20250101: 300 }, 'K'), location).series[0].valueK, 300);
  assert.equal(parsePowerThermalResponse(payload({}, 'F'), location).error.code, 'unsupported-units');
});

test('daily coverage and monthly means respect leap days and partial months', () => {
  const record = parsePowerThermalResponse(payload({ 20240228: 0, 20240229: 2, 20240301: 4 }), { ...location, start: '2024-02-28', end: '2024-03-01' });
  assert.equal(record.status, 'ready');
  assert.equal(record.series.length, 3);
  assert.equal(record.monthly.length, 2);
  assert.equal(record.monthly[0].expectedCount, 2);
  assert.equal(record.monthly[0].valueK, 274.15);
  assert.equal(record.monthly[1].valueK, 277.15);
});

test('live fetch records raw-response digest and handles HTTP/network/invalid JSON', async () => {
  const raw = JSON.stringify(payload());
  const record = await fetchEarthThermal({ ...location, fetchImpl: async () => mockResponse(payload()) });
  assert.equal(record.source.rawResponseSHA256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(record.source.retrievalMode, 'live');
  assert.ok(record.source.retrievedAt);
  assert.equal((await fetchEarthThermal({ ...location, fetchImpl: async () => ({ ok: false, status: 503 }) })).error.code, 'http');
  assert.equal((await fetchEarthThermal({ ...location, fetchImpl: async () => { throw new Error('offline'); } })).error.code, 'network');
  assert.equal((await fetchEarthThermal({ ...location, fetchImpl: async () => ({ ok: true, text: async () => '<html>' }) })).error.code, 'invalid-response');
});

test('timeout and user cancellation are distinguishable and abort the request', async () => {
  const blockingFetch = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  const timeout = await fetchEarthThermal({ ...location, timeoutMs: 5, fetchImpl: blockingFetch });
  assert.equal(timeout.status, 'error');
  assert.equal(timeout.error.code, 'timeout');
  const controller = new AbortController();
  const pending = fetchEarthThermal({ ...location, signal: controller.signal, fetchImpl: blockingFetch });
  controller.abort();
  const cancelled = await pending;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.error.code, 'cancelled');
});

test('a changed/new site fetches its exact coordinates and rejects planetary locations', async () => {
  clearEarthThermalCache();
  let requested;
  const result = await loadEarthThermal({ id: 'manual', body: 'earth', lat: -12.5, lon: 123.75 }, { ...location, fetchImpl: async url => { requested = new URL(url); return mockResponse(payload()); } });
  assert.equal(requested.searchParams.get('latitude'), '-12.5');
  assert.equal(requested.searchParams.get('longitude'), '123.75');
  assert.equal(result.location.lat, -12.5);
  await assert.rejects(() => loadEarthThermal({ body: 'mars', lat: 18, lon: 77 }), /Earth/);
});

test('bundled references contain real daily means, retained raw payloads, and matching hashes', async () => {
  for (const id of ['wadi-rum', 'al-wahbah', 'amboy', 'lanzarote']) {
    const data = JSON.parse(await readFile(new URL(`../dist/data/earth-thermal-${id}.json`, import.meta.url), 'utf8'));
    const raw = await readFile(new URL(`../dist/data/earth-thermal-${id}-raw.json`, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), data.source.rawResponseSHA256, id);
    assert.equal(data.metric.id, 'TS');
    assert.equal(data.metric.canonicalUnit, 'K');
    assert.equal(data.series.length, 365);
    assert.equal(data.summary.validCount, 365);
    assert.deepEqual(data.source.modelProducts, ['MERRA2']);
    assert.ok(data.summary.minimumDailyMeanK > 0);
    assert.ok(data.summary.maximumDailyMeanK >= data.summary.minimumDailyMeanK);
    assert.equal(data.requestedPeriod.start, '2025-01-01');
    assert.equal(data.requestedPeriod.end, '2025-12-31');
    assert.equal(data.monthly.length, 12);
    assert.ok(!('score' in data));
  }
});
