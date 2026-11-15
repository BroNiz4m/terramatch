import {loadLocationImagery} from './location-imagery.js?v=20261116-observations-1';
import {escapeHTML as esc} from './icons.js';
const key = (site, data) => JSON.stringify([site.id, site.body, site.lat, site.lon, data?.widthMeters, data?.depthMeters, data?.bounds]);
const percent = fraction => (fraction * 100).toFixed(1) + '%';
const statusLabel = record => record.imageryStatus === 'recent-observation' ? 'Recent observation' : record.imageryStatus === 'archive-fallback' ? 'Annual mosaic · fallback' : 'Historical orbital mosaic';

export function locationFigureHTML(site, dem, scale) {
  return `<figure class="location-visual" data-location-imagery="${esc(site.id)}"><div class="location-visual-toolbar"><span>North up · Full study area</span><div class="segmented" aria-label="Location preview"><button type="button" data-imagery-view="imagery" aria-pressed="true">Imagery</button><button type="button" data-imagery-view="elevation" aria-pressed="false">Elevation</button></div></div><img class="terrain-preview-image" src="${esc(dem)}" alt="Elevation-derived terrain map for ${esc(site.name)}" decoding="async"><figcaption><strong data-imagery-title>Loading imagery · elevation shown</strong><span data-imagery-detail>${esc(scale)} · Regional data; fine features unresolved</span><span class="imagery-status-badge" data-imagery-badge hidden></span><span data-imagery-resolution hidden></span><span data-imagery-credit hidden></span><span data-imagery-status role="status" aria-live="polite"></span><details class="imagery-record" data-imagery-record hidden><summary>Image date, quality &amp; source</summary><div data-imagery-notes></div><a data-imagery-source target="_blank" rel="noopener noreferrer">Open original source record ↗</a></details><button class="text-link" data-imagery-retry hidden>Retry imagery</button></figcaption></figure>`;
}

function notesHTML(metadata) {
  const quality = metadata.quality;
  return `<p>${esc(metadata.product || '')}</p>${metadata.observedAt ? `<p>Acquired: ${esc(metadata.observedAt)} · ${esc(metadata.platform || '')} ${esc(metadata.instrument || '')}</p>` : `<p>${esc(metadata.period || 'Acquisition dates vary across this mosaic.')}</p>`}
    ${quality ? `<p>Sampled local cloud/shadow: ${percent(quality.obscuredFraction)} · valid classification: ${percent(quality.validFraction)}${quality.snowFraction > .01 ? ' · snow/ice: ' + percent(quality.snowFraction) : ''}. Classification estimates can miss clouds and fine features.</p>` : ''}
    ${metadata.selectionReason ? `<p>Why this archive: ${esc(metadata.selectionReason)}</p>` : ''}
    ${metadata.selection ? `<p>Search: up to 48 catalogue scenes in 180 days; inspect at most 6 full-area scenes, newest first. This is a bounded search; an annual mosaic is shown if no inspected scene can be selected.</p>` : ''}
    <p>${esc(metadata.caveat || '')}</p><p>Fetched: ${esc(metadata.retrievedAt || 'Not recorded')} · fetching time is separate from observation time.</p><p>${esc(metadata.license || '')}</p>`;
}

export function createLocationImageryUI({getSite, getData, load = loadLocationImagery, onUpdate = () => {}} = {}) {
  const cache = new Map(), records = new Map(), fallbacks = new WeakMap(); let controller = null;
  function snapshot(sites) { return sites.map(site => records.get(key(site, getData(site.id))) || {siteId: site.id, status: 'not-requested'}); }
  function mount(root) {
    controller?.abort();
    for (const [k, record] of records) if (record.status === 'loading') records.set(k, {...record, status: 'cancelled', reason: 'The selected view changed before imagery finished.'});
    controller = new AbortController(); const signal = controller.signal;
    for (const figure of root.querySelectorAll('[data-location-imagery]')) {
      const site = getSite(figure.dataset.locationImagery), data = site && getData(site.id); if (!site || !data) continue;
      const img = figure.querySelector('img'), detail = figure.querySelector('[data-imagery-detail]');
      if (!fallbacks.has(figure)) fallbacks.set(figure, {dem: img.src, detail: detail.textContent});
      const original = fallbacks.get(figure), title = figure.querySelector('[data-imagery-title]'), credit = figure.querySelector('[data-imagery-credit]'), status = figure.querySelector('[data-imagery-status]'), retry = figure.querySelector('[data-imagery-retry]'), k = key(site, data);
      let mode = 'imagery', result = cache.get(k) || null, failed = null, pending = false, progress = '';
      if (result && Date.now() - result.cachedAt > 6 * 3600000) { URL.revokeObjectURL(result.url); cache.delete(k); result = null; }
      if (result) { cache.delete(k); cache.set(k, result); }
      function render() {
        if (signal.aborted || !figure.isConnected) return;
        figure.querySelectorAll('[data-imagery-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.imageryView === mode)));
        const actual = mode === 'imagery' && result, metadata = result?.metadata;
        img.src = actual ? result.url : original.dem;
        img.alt = actual ? `Observed ${site.body === 'earth' ? 'satellite' : 'orbital'} imagery for ${site.name}` : `Elevation-derived terrain map for ${site.name}`;
        title.textContent = actual ? (site.body === 'earth' ? 'Satellite imagery' : 'Orbital imagery') : mode === 'elevation' ? 'Elevation map · shaded relief' : failed ? 'Imagery unavailable · elevation shown' : 'Loading imagery · elevation shown';
        detail.textContent = actual ? `${data.widthMeters / 1000} × ${data.depthMeters / 1000} km · ${metadata.period}` : original.detail;
        credit.hidden = !actual; credit.textContent = actual ? metadata.credit : '';
        const badge = figure.querySelector('[data-imagery-badge]'), resolution = figure.querySelector('[data-imagery-resolution]'), record = figure.querySelector('[data-imagery-record]');
        if (badge) { badge.hidden = !actual; badge.textContent = actual ? statusLabel(metadata) : ''; }
        if (resolution) { resolution.hidden = !actual; resolution.textContent = actual && metadata.resolution ? `${metadata.resolution}${Number.isFinite(metadata.previewSamplingMeters) ? ' · preview ≈ ' + Math.round(metadata.previewSamplingMeters) + ' m/px' : ''}` : ''; }
        if (record) { record.hidden = !actual; if (actual) figure.querySelector('[data-imagery-notes]').innerHTML = notesHTML(metadata); }
        status.textContent = mode === 'imagery' ? failed || (pending ? progress || 'Reading imagery for these coordinates…' : actual && metadata.selectionReason ? metadata.selectionReason : '') : '';
        retry.hidden = mode !== 'imagery' || pending || (!failed && !(result && site.body === 'earth'));
        retry.textContent = result ? 'Check newer imagery' : 'Retry imagery';
        const link = figure.querySelector('[data-imagery-source]');
        if (link) { link.hidden = !actual; if (actual) link.href = metadata.sourceURL; }
      }
      async function retrieve() {
        if (pending || result) return;
        pending = true; failed = null; records.set(k, {siteId: site.id, status: 'loading'}); render();
        try {
          const loaded = await load(site, data, {signal, onProgress(message) { progress = message; render(); }});
          if (signal.aborted) return;
          result = {url: URL.createObjectURL(loaded.blob), metadata: loaded.metadata, cachedAt: Date.now()};
          cache.set(k, result); records.set(k, {siteId: site.id, status: 'available', ...loaded.metadata}); onUpdate();
          while (cache.size > 12) { const oldest = cache.keys().next().value; URL.revokeObjectURL(cache.get(oldest).url); cache.delete(oldest); records.delete(oldest); }
        } catch (error) {
          if (signal.aborted) return;
          failed = error.name === 'AbortError' ? 'The imagery request timed out. Retry or inspect the elevation map.' : error.message || 'Imagery is unavailable. Elevation is shown instead.';
          records.set(k, {siteId: site.id, status: 'unavailable', reason: failed}); onUpdate();
        } finally { pending = false; render(); }
      }
      figure.querySelectorAll('[data-imagery-view]').forEach(button => button.onclick = () => { mode = button.dataset.imageryView; render(); if (mode === 'imagery') void retrieve(); });
      retry.onclick = () => { if (pending) return; if (result) { URL.revokeObjectURL(result.url); cache.delete(k); result = null; } void retrieve(); };
      render(); if (!result) void retrieve();
    }
  }
  return {mount, snapshot,
    sourceSummaryHTML(sites) {
      return `<section class="panel imagery-source-summary" id="comparison-imagery-sources"><h2>Images for this comparison</h2><p>Image observations are separate from the elevation datasets used for ranking.</p><div class="imagery-source-pair">${snapshot(sites).map((record, i) => `<article><h3>${esc(sites[i].name)}</h3>${record.status === 'available' ? `<strong>${esc(statusLabel(record))}</strong><p>${esc(record.period || '')}</p><p>${esc(record.credit || '')}</p>${record.selectionReason ? `<p>${esc(record.selectionReason)}</p>` : ''}<details><summary>Image provenance</summary>${notesHTML(record)}<a href="${esc(record.sourceURL)}" target="_blank" rel="noopener noreferrer">Original source record ↗</a></details>` : `<p>${record.status === 'loading' ? 'Imagery is loading in Compare.' : record.status === 'unavailable' ? esc(record.reason) : 'Open Compare to load imagery for this pair.'}</p>`}</article>`).join('')}</div></section>`;
    },
    dispose() { controller?.abort(); for (const entry of cache.values()) URL.revokeObjectURL(entry.url); cache.clear(); records.clear(); }
  };
}
