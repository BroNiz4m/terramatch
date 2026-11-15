import {analyzeTerrain, compareTerrains, taskProfile,resampleTerrain} from './science.js';
import {comparisonStatus} from './comparison-status.js';
import {areaLiteratureReview} from './reviewed-areas.js';
import {escapeHTML as esc} from './icons.js';

const statistics = new WeakMap();
const subsets = new WeakMap();
const number = (value, digits = 1) => Number(value).toFixed(digits);

function statsFor(data) {
  if (!statistics.has(data)) statistics.set(data, analyzeTerrain(data));
  return statistics.get(data);
}

function subsetStatistics(data, extentMeters) {
  if (!subsets.has(data)) subsets.set(data, new Map());
  const cached = subsets.get(data);
  if (cached.has(extentMeters)) return cached.get(extentMeters);
  const size = extentMeters / 500 + 1;
  const candidates = [];
  for (const x of [-4000, -2000, 0, 2000, 4000]) {
    for (const y of [-4000, -2000, 0, 2000, 4000]) {
      const startColumn = (65 - size) / 2 + x / 500;
      const startRow = (65 - size) / 2 + y / 500;
      const heights = [];
      for (let row = 0; row < size; row++) heights.push(...data.heights.slice((startRow + row) * 65 + startColumn, (startRow + row) * 65 + startColumn + size));
      candidates.push({offsetGridXmeters: x, offsetGridYmeters: y,
        stats: analyzeTerrain({size, heights, widthMeters: extentMeters, depthMeters: extentMeters})});
    }
  }
  cached.set(extentMeters, candidates);
  return candidates;
}

export function terrainSensitivity(targetData, earthData, weights, eligible) {
  if (!eligible) return {status: 'withheld', reason: 'Resolve area coverage before interpreting subset indices.', extents: []};
  if (![targetData, earthData].every(data => data.size === 65 && data.widthMeters === 32000 && data.depthMeters === 32000)) {
    return {status: 'unavailable', reason: 'This sensitivity exercise requires the standard 65 × 65, 32 km grids.', extents: []};
  }
  const extents = [16000, 24000].map(extentMeters => {
    const targets = subsetStatistics(targetData, extentMeters), earths = subsetStatistics(earthData, extentMeters);
    let minimum = Infinity, maximum = -Infinity, centeredIndex = null;
    for (const target of targets) for (const earth of earths) {
      const index = compareTerrains(target.stats, earth.stats, weights).score;
      minimum = Math.min(minimum, index); maximum = Math.max(maximum, index);
      if (!target.offsetGridXmeters && !target.offsetGridYmeters && !earth.offsetGridXmeters && !earth.offsetGridYmeters) centeredIndex = index;
    }
    return {extentKm: extentMeters / 1000, centeredIndex, shiftedMinimum: minimum, shiftedMaximum: maximum, pairs: targets.length * earths.length};
  });
  return {status: 'computed', extents, centersPerBody: 25, offsetsMeters: [-4000, -2000, 0, 2000, 4000],
    note: 'Overlapping subsets of the existing grids. Each body uses 25 independent center choices along local grid axes. These deterministic ranges describe footprint sensitivity. They are not confidence intervals, DEM error estimates or independently observed sites. Posting stays 500 m and slope baseline stays 1 km. No extra terrain is acquired.'};
}

export function characterizeComparison(targetData, earthData, {target, candidate, weights = {slope: .65, relief: .35}, task = 'terrain'} = {}) {
  const spacing=Math.max(targetData.widthMeters/(targetData.size-1),earthData.widthMeters/(earthData.size-1));
  targetData=resampleTerrain(targetData,spacing);earthData=resampleTerrain(earthData,spacing);
  const targetStats = statsFor(targetData), earthStats = statsFor(earthData);
  const coverage = comparisonStatus(candidate, earthData);
  const eligible = coverage.scoreEligible && comparisonStatus(target, targetData).scoreEligible;
  const comparison = eligible ? compareTerrains(targetData, earthData, weights) : null;
  const review = areaLiteratureReview(earthData);
  const shares = data => ({under5: data.slopeHistogram[0] + data.slopeHistogram[1], under10: data.slopeHistogram.slice(0, 3).reduce((sum, value) => sum + value, 0), atLeast20: data.slopeHistogram.slice(4).reduce((sum, value) => sum + value, 0)});
  const a = shares(targetStats), b = shares(earthStats);
  const bins = ['0–2°', '2–5°', '5–10°', '10–20°', '20–35°', '35–90°'];
  const differences = bins.map((range, index) => ({range, targetShare: targetStats.slopeHistogram[index], earthShare: earthStats.slopeHistogram[index], differencePoints: (earthStats.slopeHistogram[index] - targetStats.slopeHistogram[index]) * 100}));
  const largestDifference = differences.reduce((largest, row) => Math.abs(row.differencePoints) > Math.abs(largest.differencePoints) ? row : largest);
  const exercise = {
    basis: 'Project inference from regional terrain measurements',
    question: `How would the terrain differences between ${target?.name || 'the planetary target'} and ${candidate?.name || 'this Earth area'} change a regional observation plan?`,
    objective: taskProfile(task).label,
    actions: ['Use the existing slope and elevation views to select observation areas spanning the terrain ranges present.',
      'Record coordinates, supporting measurements and the reason for each proposed observation in the notebook.',
      'Reconsider the plan using the footprint-sensitivity results and list the finer data needed for follow-up.'],
    output: 'An annotated regional reconnaissance plan and decision log linking each choice to terrain evidence.',
    assessment: 'Review the evidence used for observation choices and how the plan responds to changed footprints.',
    limit: 'This desktop exercise evaluates map interpretation and scientific planning. Physical mobility, instrument performance and field access need separate evidence.'
  };
  return {version: 'terrain-characterization-v1', scope: 'Regional terrain reconnaissance and observation planning',
    condition: `${target?.name || 'Planetary target'} · slope distributions and within-area elevation range`,
    scoreEligible: eligible, score: comparison?.score ?? null, coverage,
    measurements: {target: {relief: targetStats.relief, slopeMean: targetStats.slopeMean, slopeP90: targetStats.slopeP90, ...a},
      earth: {relief: earthStats.relief, slopeMean: earthStats.slopeMean, slopeP90: earthStats.slopeP90, ...b},
      slopeSampleCount: earthStats.slopeSampleCount, slopeBaselineMeters: earthStats.gradientBaselineMeters,
      under5DifferencePoints: (b.under5 - a.under5) * 100, reliefDifferenceMeters: earthStats.relief - targetStats.relief,
      slopeBins: differences, largestSlopeDifference: largestDifference},
    indexContributions: comparison ? {slopePenaltyPoints: 100 * comparison.slopeDistance * comparison.components[0].weight,
      reliefPenaltyPoints: 100 * comparison.reliefDistance * comparison.components[1].weight, reliefCapped: comparison.reliefDistance === 1,
      note: 'Component penalties subtract from 100 under the active weights. They describe this heuristic index.'} : null,
    sensitivity: terrainSensitivity(targetData, earthData, weights, eligible),
    literature: review || {priorUse: candidate?.origin ? 'unreviewed' : 'bundled-reference',
      finding: 'No footprint-specific literature assessment is bundled for this selected area.',
      novelty: 'Prior analog use and scientific novelty require a literature review. Search origin records how the coordinates entered this session.'},
    proposedExercise: exercise,
    limits: [`The ${spacing} m sampling and ${spacing*2/1000} km slope baseline describe regional terrain. Rocks, cracks and rover-scale hazards remain unresolved.`,
      'Earth and planetary DEM products have different source resolutions, datums and interpolation histories. Sampling onto one grid does not equalize accuracy.',
      'Terrain similarity alone does not establish matching minerals, sedimentary history, thermal conditions or biology.',
      'Earth gravity, atmosphere and radiation differ from lunar and Martian conditions. Access and actual field operations require independent assessment.'],
    provenance: {target: targetData.source, earth: earthData.source}};
}

export function characterizationHTML(evidence) {
  const {measurements: m, literature, sensitivity, proposedExercise: exercise} = evidence;
  const bin = m.largestSlopeDifference;
  const penalty = evidence.indexContributions;
  return `<section class="panel comparison-notes" id="terrain-characterization"><h2>What supports this candidate?</h2>
    <p>${esc(evidence.condition)} · ${esc(evidence.scope)}.</p>
    <p>Samples below 5° slope: <strong>${number(m.target.under5 * 100)}% target / ${number(m.earth.under5 * 100)}% Earth</strong>. The Earth area differs by ${number(m.under5DifferencePoints)} percentage points. These shares describe interior grid samples.</p>
    <p>The largest slope-bin difference is ${esc(bin.range)}: ${number(bin.targetShare * 100)}% target / ${number(bin.earthShare * 100)}% Earth. Elevation range is ${number(m.target.relief, 0)} m / ${number(m.earth.relief, 0)} m.</p>
    ${penalty ? `<p>The active index subtracts ${number(penalty.slopePenaltyPoints)} points for slope distribution and ${number(penalty.reliefPenaltyPoints)} points for elevation range from 100.${penalty.reliefCapped ? ' The elevation-range penalty reaches its cap.' : ''}</p>` : '<p>Coverage review is required. Measurements describe the full DEM area, including any unresolved water or bathymetry. Index and sensitivity scores are withheld.</p>'}
    <details class="ranking-method-details"><summary>Footprint sensitivity and literature evidence</summary>
    <h3>How does the selected area affect the result?</h3>
    ${sensitivity.status === 'computed' ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Area size</th><th>Same-center index</th><th>Independently shifted centers</th></tr></thead><tbody><tr><td>32 × 32 km</td><td>${number(evidence.score)}</td><td>Original area only</td></tr>${sensitivity.extents.map(row => `<tr><td>${row.extentKm} × ${row.extentKm} km</td><td>${number(row.centeredIndex)}</td><td>${number(row.shiftedMinimum)}–${number(row.shiftedMaximum)} · ${row.pairs} subset pairs</td></tr>`).join('')}</tbody></table></div><p>${esc(sensitivity.note)}</p>` : `<p>${esc(sensitivity.reason)}</p>`}
    <h3>What has already been studied?</h3><p>${esc(literature.finding)}</p>${literature.boundary ? `<p>${esc(literature.boundary)}</p>` : ''}<p><strong>${esc(literature.novelty)}</strong></p>
    ${(literature.sources || []).map(source => `<p><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a> · ${esc(source.kind)}</p>`).join('')}
    ${evidence.coverage.knownWaterReviews.map(review => `<p>${esc(review.reason)} <a href="${esc(review.source.url)}" target="_blank" rel="noopener noreferrer">${esc(review.source.title)} ↗</a></p>`).join('')}</details>
    <h3>What could a mission team practise?</h3><p>${esc(exercise.question)}</p><ol>${exercise.actions.map(action => `<li>${esc(action)}</li>`).join('')}</ol><p><strong>Proposed output</strong> ${esc(exercise.output)}</p><p>${esc(exercise.limit)} ${esc(exercise.basis)}.</p>
    </section>`;
}

export function characterizationReport(evidence) {
  const m = evidence.measurements, sensitivity = evidence.sensitivity, literature = evidence.literature;
  const bin = m.largestSlopeDifference, penalty = evidence.indexContributions;
  return `\n\n## Evidence-based terrain characterization\n\n${evidence.condition}. ${evidence.scope}.\n\n`
    + `Under-5° slope-sample shares: target ${number(m.target.under5 * 100)}%, Earth ${number(m.earth.under5 * 100)}%, difference ${number(m.under5DifferencePoints)} percentage points. Relief: target ${number(m.target.relief)} m, Earth ${number(m.earth.relief)} m.\n\n`
    + `Largest slope-bin difference: ${bin.range}, target ${number(bin.targetShare * 100)}%, Earth ${number(bin.earthShare * 100)}%.\n\n`
    + (penalty ? `Rounded index penalties subtract ${number(penalty.slopePenaltyPoints)} slope points and ${number(penalty.reliefPenaltyPoints)} relief points from 100.\n\n` : `Coverage review required. ${evidence.coverage.reason || 'Area eligibility needs review.'}\n\n`)
    + (sensitivity.status === 'computed' ? `### Footprint sensitivity\n\n32 km original index: ${number(evidence.score)}.\n\n| Extent | Centered index | Independently shifted range | Subset pairs |\n| --- | ---: | --- | ---: |\n` + sensitivity.extents.map(row => `| ${row.extentKm} km | ${number(row.centeredIndex)} | ${number(row.shiftedMinimum)}–${number(row.shiftedMaximum)} | ${row.pairs} |`).join('\n') + `\n\n${sensitivity.note}\n\n` : `Sensitivity scores withheld or unavailable. ${sensitivity.reason}\n\n`)
    + `### Literature and prior use\n\n${literature.finding}\n\n${literature.boundary || ''}\n\n${literature.novelty}\n\n` + (literature.sources || []).map(source => `- ${source.title} (${source.kind}) — ${source.url}`).join('\n')
    + `\n\n### Proposed mission-learning exercise\n\n${evidence.proposedExercise.question}\n\n` + evidence.proposedExercise.actions.map((action, index) => `${index + 1}. ${action}`).join('\n')
    + `\n\nOutput: ${evidence.proposedExercise.output}\n\n${evidence.proposedExercise.limit} ${evidence.proposedExercise.basis}.\n\n`;
}
