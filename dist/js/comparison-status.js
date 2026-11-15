// A loaded window can be inspected without being eligible for a terrain score.
// Keep site, data and source-screen exclusions conservative, including cached records.
import {currentCoverage,COVERAGE_LIMIT,COVERAGE_VERSION} from './land-coverage.js';
import {knownWaterReviews} from './reviewed-areas.js';
export function comparisonStatus(site, data) {
  const screening = data?.source?.landScreening || null;
  const assessment=data?.source?.coverageAssessment||null;
  const waterReviews=knownWaterReviews(data);
  const runtime=String(data?.siteId||site?.id||'').startsWith('custom-');
  const pending=runtime&&(data?.coverageRecheckRequired||assessment?.version!==COVERAGE_VERSION||(assessment?.status==='screened-land'&&!currentCoverage(data)));
  const eligible = !pending&&!waterReviews.length&&site?.comparisonEligible !== false && data?.comparisonEligible !== false && screening?.allLand !== false&&(!assessment||assessment.status==='screened-land');
  return {
    status: eligible ? 'eligible' : 'coverage-review-required',
    scoreEligible: eligible,
    label: eligible ? 'Eligible for terrain ranking' : 'Coverage review required',
    reason: eligible ? null : waterReviews.length?waterReviews.map(review=>review.reason).join(' '):pending?'This saved or unverified search window needs the current coastline checks. Analyze the location again if automatic rechecking is unavailable.':assessment?.reason|| (screening?.allLand === false
      ? 'The coarse 5 × 5 land-mask screen includes non-land samples. This does not classify the whole location as water or unsuitable.'
      : 'This study window is excluded from inland ranking because its coverage includes coastal bathymetry or has not been cleared for comparison.'),
    screening,
    assessment,
    knownWaterReviews:waterReviews,
    limitation: runtime||assessment?COVERAGE_LIMIT:'Natural Earth 1:110m is a coarse coastline screen, not a detailed land/water classification. Passing it does not prove that every point is dry land or suitable for fieldwork.'
  };
}
