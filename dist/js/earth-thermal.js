/**
 * NASA POWER TS: daily-mean Earth skin temperature from model/reanalysis.
 * This point-context series is NOT satellite LST, a spatial thermal map,
 * subdaily extremes, or a component of TerraMatch's cross-body terrain score.
 */
export const DEFAULT_EARTH_THERMAL_PERIOD = Object.freeze({ start: '20250101', end: '20251231' });
export const EARTH_THERMAL_SOURCE = Object.freeze({
  id: 'nasa-power-ts',
  title: 'NASA POWER daily Earth skin temperature (TS)',
  agency: 'NASA POWER / GMAO',
  url: 'https://power.larc.nasa.gov/',
  documentationUrl: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/',
  methodologyUrl: 'https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/',
  parameterReferenceUrl: 'https://gis.earthdata.nasa.gov/portal/rest/services/POWER/POWER_MONTHLY_METEOROLOGY_LST/ImageServer/multiDimensionalInfo',
  license: 'NASA POWER openly available data; acknowledge NASA POWER and source model products.',
  spatialResolution: Object.freeze({ latitudeDegrees: 0.5, longitudeDegrees: 0.625 }),
});

const LIMITATIONS = Object.freeze([
  'Daily-mean Earth skin temperature from a model/reanalysis grid, not a satellite land-surface-temperature observation or a 2 m air-temperature measurement.',
  'The native 0.5° latitude × 0.625° longitude grid is much coarser than a terrain study window and does not resolve local rocks, shade, slopes, or microclimates.',
  'Daily-mean minima and maxima describe the retrieved daily averages, not instantaneous or day/night temperature extremes.',
  'LST in the POWER time-standard field means Local Solar Time, not land surface temperature.',
  'A single calendar year describes that period; it is not a long-term climatology.',
  'This Earth context is not scored against lunar Diviner products or Martian measurements with different physical and temporal definitions.',
]);

const BUNDLED_SITES = Object.freeze({
  'wadi-rum': { lat: 29.575, lon: 35.419 },
  'al-wahbah': { lat: 22.9, lon: 41.138 },
  'amboy': { lat: 34.557, lon: -115.78 },
  'lanzarote': { lat: 28.995, lon: -13.74 },
});
const completedCache = new Map();
const DAY_MS = 86_400_000;

function dateValue(value, label) {
  const compact = String(value ?? '').replaceAll('-', '');
  if (!/^\d{8}$/.test(compact)) throw new RangeError(`${label} must be YYYYMMDD or YYYY-MM-DD.`);
  const year = Number(compact.slice(0, 4)), month = Number(compact.slice(4, 6)), day = Number(compact.slice(6, 8));
  const stamp = Date.UTC(year, month - 1, day);
  const date = new Date(stamp);
  if (year < 1981 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new RangeError(`${label} is not an available valid calendar date (1981 or later).`);
  return { compact, iso: `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`, stamp };
}

function requestOptions(options = {}) {
  const lat = options.lat ?? options.latitude;
  const lon = options.lon ?? options.longitude;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new RangeError('Earth latitude must be finite and between −90 and 90 degrees.');
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new RangeError('Earth longitude must be finite and between −180 and 180 degrees.');
  const start = dateValue(options.start ?? options.period?.start ?? DEFAULT_EARTH_THERMAL_PERIOD.start, 'Start date');
  const end = dateValue(options.end ?? options.period?.end ?? DEFAULT_EARTH_THERMAL_PERIOD.end, 'End date');
  if (start.stamp > end.stamp) throw new RangeError('The thermal period must end on or after its start.');
  const days = (end.stamp - start.stamp) / DAY_MS + 1;
  if (days > 3660) throw new RangeError('Request at most 3,660 daily values at once.');
  return { lat, lon, start, end, days, siteId: options.siteId ?? null };
}

/** Explicitly requests POWER's Local Solar Time daily averaging convention. */
export function buildEarthThermalURL(options = {}) {
  const r = requestOptions(options);
  const url = new URL('https://power.larc.nasa.gov/api/temporal/daily/point');
  url.search = new URLSearchParams({ parameters: 'TS', community: 'RE', longitude: String(r.lon), latitude: String(r.lat), start: r.start.compact, end: r.end.compact, format: 'JSON', 'time-standard': 'LST' }).toString();
  return url.href;
}

function baseRecord(r, options = {}) {
  return {
    schemaVersion: 1,
    status: 'no-data',
    siteId: r.siteId,
    location: { lat: r.lat, lon: r.lon, elevationMeters: null },
    metric: {
      id: 'TS', label: 'Earth skin temperature',
      definition: 'Daily-mean model/reanalysis surface skin temperature',
      canonicalUnit: 'K', nativeUnit: null, statistic: 'daily_mean',
      timeStandard: 'LST', timeStandardMeaning: 'Local Solar Time',
    },
    source: {
      ...EARTH_THERMAL_SOURCE,
      spatialResolution: { ...EARTH_THERMAL_SOURCE.spatialResolution },
      modelProducts: [], apiVersion: null,
      requestUrl: options.requestUrl ?? buildEarthThermalURL({ lat: r.lat, lon: r.lon, start: r.start.compact, end: r.end.compact }),
      retrievedAt: options.retrievedAt ?? new Date().toISOString(),
      rawResponseSHA256: options.rawResponseSHA256 ?? null,
      retrievalMode: options.retrievalMode ?? 'live',
    },
    requestedPeriod: { start: r.start.iso, end: r.end.iso, days: r.days },
    actualPeriod: { start: null, end: null },
    series: [], monthly: [],
    summary: { validCount: 0, missingCount: r.days, coverageFraction: 0, meanOfDailyMeansK: null, minimumDailyMeanK: null, maximumDailyMeanK: null, rangeOfDailyMeansK: null, minimumDailyMeanDate: null, maximumDailyMeanDate: null },
    limitations: [...LIMITATIONS], messages: [],
  };
}

function failRecord(r, options, status, code, message) {
  const record = baseRecord(r, options);
  record.status = status;
  record.error = { code, message };
  return record;
}

/** Normalize one unchanged POWER JSON response; fill values become explicit null. */
export function parsePowerThermalResponse(payload, options = {}) {
  const r = requestOptions(options);
  const record = baseRecord(r, options);
  if (!payload || typeof payload !== 'object') return failRecord(r, options, 'error', 'invalid-response', 'NASA POWER returned no JSON object.');
  record.source.modelProducts = Array.isArray(payload.header?.sources) ? payload.header.sources.map(String) : [];
  record.source.apiVersion = payload.header?.api?.version ?? null;
  record.source.fillValue = Number.isFinite(payload.header?.fill_value) ? payload.header.fill_value : -999;
  record.source.providerTitle = payload.header?.title ?? null;
  record.messages = Array.isArray(payload.messages) ? payload.messages.map(String) : [];
  const standard = payload.header?.time_standard;
  if (typeof standard === 'string') {
    record.metric.timeStandard = standard;
    record.metric.timeStandardMeaning = standard === 'LST' ? 'Local Solar Time' : standard === 'UTC' ? 'Coordinated Universal Time' : 'Provider time standard';
  }
  const elevation = payload.geometry?.coordinates?.[2];
  if (Number.isFinite(elevation)) record.location.elevationMeters = elevation;
  const parameter = payload.properties?.parameter?.TS;
  if (!parameter || typeof parameter !== 'object' || Array.isArray(parameter)) {
    record.error = { code: 'no-ts-values', message: 'No Earth Skin Temperature (TS) series was returned for this location and period.' };
    return record;
  }
  const units = payload.parameters?.TS?.units;
  record.metric.nativeUnit = units ?? null;
  record.metric.providerLongName = payload.parameters?.TS?.longname ?? null;
  const isCelsius = ['C', '°C', 'degC', 'Celsius'].includes(units);
  const isKelvin = ['K', 'Kelvin', 'kelvin'].includes(units);
  if (!isCelsius && !isKelvin) {
    record.status = 'error';
    record.error = { code: 'unsupported-units', message: `Cannot safely convert POWER TS units ${String(units)} to Kelvin.` };
    return record;
  }
  const monthly = new Map();
  for (let stamp = r.start.stamp; stamp <= r.end.stamp; stamp += DAY_MS) {
    const time = new Date(stamp).toISOString().slice(0, 10);
    const raw = parameter[time.replaceAll('-', '')];
    let valueK = null;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw !== record.source.fillValue) {
      const converted = raw + (isCelsius ? 273.15 : 0);
      if (converted > 0) valueK = Math.round(converted * 1e8) / 1e8;
    }
    record.series.push({ time, valueK });
    const month = time.slice(0, 7);
    if (!monthly.has(month)) monthly.set(month, { time: `${month}-01`, month, valueK: null, validCount: 0, expectedCount: 0, coverageFraction: 0, sum: 0 });
    const m = monthly.get(month); m.expectedCount++;
    if (valueK !== null) { m.sum += valueK; m.validCount++; }
  }
  const valid = record.series.filter(point => point.valueK !== null);
  record.monthly = [...monthly.values()].map(({ sum, ...month }) => ({ ...month, valueK: month.validCount ? sum / month.validCount : null, coverageFraction: month.validCount / month.expectedCount }));
  record.summary.validCount = valid.length;
  record.summary.missingCount = r.days - valid.length;
  record.summary.coverageFraction = valid.length / r.days;
  if (!valid.length) {
    record.error = { code: 'no-valid-values', message: 'All requested TS days were missing or invalid; no temperature statistic was calculated.' };
    return record;
  }
  const minimum = valid.reduce((a, b) => b.valueK < a.valueK ? b : a);
  const maximum = valid.reduce((a, b) => b.valueK > a.valueK ? b : a);
  Object.assign(record.summary, {
    meanOfDailyMeansK: valid.reduce((sum, p) => sum + p.valueK, 0) / valid.length,
    minimumDailyMeanK: minimum.valueK, maximumDailyMeanK: maximum.valueK,
    rangeOfDailyMeansK: maximum.valueK - minimum.valueK,
    minimumDailyMeanDate: minimum.time, maximumDailyMeanDate: maximum.time,
  });
  record.actualPeriod = { start: valid[0].time, end: valid.at(-1).time };
  record.status = valid.length === r.days ? 'ready' : 'partial';
  return record;
}

async function responseHash(text) {
  if (!globalThis.crypto?.subtle) return null;
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Public numeric point request with bounded duration and explicit cancellation. */
export async function fetchEarthThermal(options = {}) {
  const r = requestOptions(options);
  const requestUrl = buildEarthThermalURL({ lat: r.lat, lon: r.lon, start: r.start.compact, end: r.end.compact });
  const base = { ...options, requestUrl };
  if (options.signal?.aborted) return failRecord(r, base, 'cancelled', 'cancelled', 'Earth thermal request was cancelled.');
  const controller = new AbortController();
  let timedOut = false;
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 15000;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable.');
    const response = await fetchImpl(requestUrl, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return failRecord(r, base, 'error', 'http', `NASA POWER request failed (HTTP ${response.status}).`);
    const text = await response.text();
    if (controller.signal.aborted) throw new DOMException('Request cancelled.', 'AbortError');
    const rawResponseSHA256 = await responseHash(text);
    let payload;
    try { payload = JSON.parse(text); }
    catch { return failRecord(r, base, 'error', 'invalid-response', 'NASA POWER returned invalid JSON.'); }
    return parsePowerThermalResponse(payload, { ...base, rawResponseSHA256, retrievedAt: new Date().toISOString(), retrievalMode: 'live' });
  } catch (error) {
    if (timedOut) return failRecord(r, base, 'error', 'timeout', `NASA POWER did not respond within ${timeoutMs} ms.`);
    if (options.signal?.aborted || controller.signal.aborted || error?.name === 'AbortError') return failRecord(r, base, 'cancelled', 'cancelled', 'Earth thermal request was cancelled.');
    return failRecord(r, base, 'error', 'network', `Earth thermal data could not be retrieved: ${error?.message ?? 'network error'}`);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

/**
 * Use the recorded 2025 bundle for an unchanged reference site; otherwise fetch
 * the exact Earth coordinates from POWER. Successful results are session-cached.
 */
export async function loadEarthThermal(site, options = {}) {
  if (!site || (site.body && site.body !== 'earth')) throw new RangeError('Earth thermal context requires an Earth location.');
  const r = requestOptions({ ...options, lat: site.lat, lon: site.lon, siteId: site.id });
  const key = `${r.lat},${r.lon}:${r.start.compact}:${r.end.compact}`;
  if (options.signal?.aborted) return failRecord(r, options, 'cancelled', 'cancelled', 'Earth thermal request was cancelled.');
  if (!options.refresh && completedCache.has(key)) return { ...completedCache.get(key), siteId: site.id ?? null };
  const reference = BUNDLED_SITES[site.id];
  const isDefaultPeriod = r.start.compact === DEFAULT_EARTH_THERMAL_PERIOD.start && r.end.compact === DEFAULT_EARTH_THERMAL_PERIOD.end;
  const exactReference = reference && Math.abs(reference.lat - r.lat) < 1e-7 && Math.abs(reference.lon - r.lon) < 1e-7;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (options.preferBundled !== false && !options.refresh && exactReference && isDefaultPeriod && typeof fetchImpl === 'function') {
    try {
      const response = await fetchImpl(new URL(`../data/earth-thermal-${site.id}.json`, import.meta.url), { signal: options.signal });
      if (response.ok) {
        const bundle = await response.json();
        if (bundle.schemaVersion === 1 && ['ready', 'partial'].includes(bundle.status) && bundle.siteId === site.id && bundle.location?.lat === r.lat && bundle.location?.lon === r.lon && bundle.metric?.id === 'TS' && bundle.metric?.canonicalUnit === 'K' && bundle.requestedPeriod?.start === r.start.iso && bundle.requestedPeriod?.end === r.end.iso && bundle.series?.length === r.days && /^[a-f0-9]{64}$/i.test(bundle.source?.rawResponseSHA256 ?? '') && bundle.series.every(p => p && /^\d{4}-\d{2}-\d{2}$/.test(p.time) && (p.valueK === null || (Number.isFinite(p.valueK) && p.valueK > 0)))) {
          const result = { ...bundle, source: { ...bundle.source, retrievalMode: 'bundled' } };
          completedCache.set(key, result);
          return result;
        }
      }
    } catch (error) {
      if (options.signal?.aborted || error?.name === 'AbortError') return failRecord(r, options, 'cancelled', 'cancelled', 'Earth thermal request was cancelled.');
      // A missing/offline bundle may still be recoverable from the source API.
    }
  }
  const record = await fetchEarthThermal({ ...options, lat: r.lat, lon: r.lon, siteId: site.id, start: r.start.compact, end: r.end.compact });
  if (['ready', 'partial'].includes(record.status)) completedCache.set(key, record);
  return record;
}

export function clearEarthThermalCache() { completedCache.clear(); }
