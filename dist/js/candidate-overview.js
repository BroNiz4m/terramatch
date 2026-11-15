import {escapeHTML as esc} from './icons.js';

const number = (value, digits = 1) => Number(value).toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
const coordinate = (value, positive, negative) => `${Math.abs(value).toFixed(3)}°${value < 0 ? negative : positive}`;
export const areaCoordinates = site => `${coordinate(site.lat, 'N', 'S')}, ${coordinate(site.lon, 'E', 'W')}`;

function comparisonReason(result) {
  if (result.components[0].weight === 0) return 'Compared using elevation range only.';
  if (result.components[1].weight === 0) return 'Compared using slope distribution only.';
  if (result.reliefDistance === 1) return 'Elevation-range difference reaches its maximum penalty under this index.';
  if (result.slopeDistance < result.reliefDistance) return 'Slope distribution has the smaller mismatch under this index.';
  if (result.reliefDistance < result.slopeDistance) return 'Elevation range has the smaller mismatch under this index.';
  return 'Slope distribution and elevation range have equal distances under this index.';
}

export function candidateOverviewRows(rankings, context) {
  return rankings.map((item, index) => ({
    id: item.site.id, name: item.site.name, country: item.site.country,
    lat: item.site.lat, lon: item.site.lon, origin: item.site.origin || 'reference',
    rank: context.rows[index].rank, tied: context.rows[index].tied,
    selected: context.selected.id === item.site.id,
    score: item.score, gap: context.rows[index].gapFromLeadingPoints,
    slopeMean: item.earthStats.slopeMean, relief: item.earthStats.relief,
    reliefAtCap: context.rows[index].reliefAtCap, reliefActive: context.relief.active,
    summary: comparisonReason(item)
  }));
}

export function candidateOverviewHTML(rows, {target, stats, context, survey, loadedSites}) {
  const references = loadedSites.filter(site => !site.origin).length;
  const searched = loadedSites.length - references;
  const region = survey ? `${survey.regionName} · ${survey.cancelled ? 'stopped with partial results' : 'completed'}` : 'Choose a region in Explore to search for additional candidates.';
  return `<section class="panel candidate-overview" id="loaded-ranking-list" aria-labelledby="candidate-overview-title">
    <div class="overview-heading"><div><h2 id="candidate-overview-title">Candidate ranking</h2><p>Compare all ranked areas with ${esc(target.name)} before opening individual evidence.</p></div><a class="text-link" href="#selected-area-details">Selected area details ↓</a></div>
    <div class="overview-context"><p><strong>Target</strong> ${esc(target.name)} · ${esc(target.country)} · ${areaCoordinates(target)}</p>
    <p><strong>Latest search</strong> ${esc(region)}</p>
    <p><strong>This session</strong> ${searched} searched areas + ${references} bundled references · ${rows.length} ranked · ${context.scope.coverageReviewCount} need coverage review</p></div>
    <p class="overview-help">Each study area covers 32 × 32 km around its center. Average slope summarizes regional steepness; the index compares the full slope distribution. Elevation range (relief) is the highest minus the lowest elevation within the area. Slopes use a 1 km baseline.</p>
    <p class="overview-help">Higher indices indicate closer slope and relief measurements under the selected weights. Ranking covers the eligible areas in this session. Geological and mission suitability require further evidence.</p>
    <div class="data-table-wrap"><table class="data-table candidate-comparison-table"><caption>Terrain measurements against ${esc(target.name)}. Equal indices share a rank.</caption>
    <thead><tr><th scope="col">Rank</th><th scope="col">Study area</th><th scope="col">Terrain index</th><th scope="col">Average slope</th><th scope="col">Elevation range</th><th scope="col">Comparison summary</th><th scope="col">Evidence</th></tr></thead>
    <tbody><tr class="overview-target"><th scope="row">Target</th><td><strong>${esc(target.name)}</strong><small>${esc(target.country)}</small></td><td>Reference</td><td>${number(stats.slopeMean, 2)}°</td><td>${number(stats.relief, 0)} m</td><td colspan="2">Measurements for the selected planetary study area</td></tr>
    ${rows.map(row => `<tr class="ranking-row${row.selected ? ' selected-candidate-row' : ''}" data-ranking-id="${row.id}">
      <td><span class="rank-number" aria-label="${row.tied ? 'Shared rank' : 'Rank'} ${row.rank}">${row.tied ? '=' : ''}${String(row.rank).padStart(2, '0')}</span></td>
      <th scope="row"><strong>${esc(row.name)}</strong><small>${esc(row.country)} · ${areaCoordinates(row)}</small><small>${row.origin === 'reference' ? 'Bundled reference' : row.origin === 'automatic' ? 'Automatic search' : 'Manual search'}${row.selected ? ' · Selected' : ''}</small></th>
      <td><strong>${number(row.score)} / 100</strong><small>${row.gap ? number(row.gap) + ' points below leader' : 'Leading index'}</small><div class="ranking-badges">${row.tied ? '<span class="ranking-tie-badge">Tied at one decimal</span>' : ''}${row.reliefAtCap ? '<span class="ranking-cap-badge">Relief cap' + (row.reliefActive ? '' : ' · off') + '</span>' : ''}</div></td>
      <td>${number(row.slopeMean, 2)}°</td><td>${number(row.relief, 0)} m</td><td>${esc(row.summary)}</td>
      <td><button class="text-link" data-select-comparison="${row.id}" aria-label="Review evidence for ${esc(row.name)}, ${areaCoordinates(row)}">Review evidence ↗</button></td>
    </tr>`).join('')}</tbody></table></div>
    ${rows.length ? '' : '<p class="overview-empty">No areas are eligible for ranking yet. Inspect coverage findings below or run another search in Explore.</p>'}
    </section>`;
}

export function candidateOverviewReport(rows, target, stats) {
  const cell = value => String(value).replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
  return `\n\n## Candidate comparison overview\n\nEach area covers 32 × 32 km. Ranking includes eligible areas in this session.\n\n| Rank | Area | Country | Center | Index | Average slope | Elevation range | Origin | Comparison summary |\n| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |\n`
    + `| Target | ${cell(target.name)} | ${cell(target.country)} | ${areaCoordinates(target)} | — | ${number(stats.slopeMean, 2)}° | ${number(stats.relief, 0)} m | Planetary target | Reference measurements |\n`
    + rows.map(row => `| ${row.tied ? 'Tied ' : ''}${row.rank} | ${cell(row.name)} | ${cell(row.country)} | ${areaCoordinates(row)} | ${number(row.score)} | ${number(row.slopeMean, 2)}° | ${number(row.relief, 0)} m | ${row.origin} | ${cell(row.summary)} |`).join('\n') + '\n';
}
