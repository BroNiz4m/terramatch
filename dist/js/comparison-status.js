// A loaded window can be inspected without being eligible for a terrain score.
// Keep site, data and source-screen exclusions conservative, including cached records.
export function comparisonStatus(site, data) {
  const screening = data?.source?.landScreening || null;
  const eligible = site?.comparisonEligible !== false && data?.comparisonEligible !== false && screening?.allLand !== false;
  return {
    status: eligible ? 'eligible' : 'coverage-review-required',
    scoreEligible: eligible,
    label: eligible ? 'Eligible for terrain ranking' : 'Coverage review required',
    reason: eligible ? null : screening?.allLand === false
      ? 'The coarse 5 × 5 land-mask screen includes non-land samples. This does not classify the whole location as water or unsuitable.'
      : 'This study window is excluded from inland ranking because its coverage includes coastal bathymetry or has not been cleared for comparison.',
    screening,
    limitation: 'Natural Earth 1:110m is a coarse coastline screen, not a detailed land/water classification. Passing it does not prove that every point is dry land or suitable for fieldwork.'
  };
}
