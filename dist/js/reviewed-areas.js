// Bounded literature reviews. A named feature inside an area does not classify every terrain cell.
const lpsc2004 = {title: 'Christiansen & Hurst (2004), LPSC 2143 — low-shield volcanoes', url: 'https://www.lpi.usra.edu/meetings/lpsc2004/pdf/2143.pdf', kind: 'Conference abstract'};
const blackButte = {title: 'USGS — Black Butte Crater Lava Field', url: 'https://www.usgs.gov/volcanoes/black-butte-crater-lava-field', kind: 'Agency geological context'};
const rockCorral = {title: 'Hottendorf et al. (2023), LPSC 2644 — Rock Corral Butte', url: 'https://www.hou.usra.edu/meetings/lpsc2023/pdf/2644.pdf', kind: 'Conference abstract'};
const inlGeology = {title: 'USGS SIR 2025-5020, table 4 — basalt vents near INL', url: 'https://pubs.usgs.gov/publication/sir20255020/full', kind: 'Geological report'};
const basalt = {title: 'NASA — BASALT research program', url: 'https://www.nasa.gov/missions/analog-field-testing/what-is-basalt/', kind: 'Agency research-program context'};
const magic = {title: 'BLM — Magic Reservoir', url: 'https://www.blm.gov/visit/magic-reservoir', kind: 'Agency location record'};
const salda = {title: 'Garczynski et al. (2021), LPSC 2235 — Lake Salda', url: 'https://www.hou.usra.edu/meetings/lpsc2021/pdf/2235.pdf', kind: 'Conference abstract'};

export const KNOWN_WATER_REFERENCES = [
  {id: 'magic-reservoir', name: 'Magic Reservoir', lat: 43.288253, lon: -114.398923,
    source: magic, coordinateBasis: 'BLM map marker in geographic WGS84 coordinates, checked 2026-11-15.',
    reason: 'This study area contains the published Magic Reservoir reference point. Inland-water coverage requires review before terrain ranking.'},
  {id: 'lake-salda', name: 'Lake Salda', lat: 37.55, lon: 29.68,
    source: salda, coordinateBasis: 'Rounded lake reference coordinate from the cited field-study region.',
    reason: 'This study area contains the Lake Salda reference point. The known lake requires inland-water coverage review before terrain ranking.'}
];

export function containsReference(bounds, point) {
  if (!bounds || !['north', 'south', 'west', 'east'].every(key => Number.isFinite(bounds[key]))) return false;
  const longitude = point.lon + Math.round(((bounds.west + bounds.east) / 2 - point.lon) / 360) * 360;
  return point.lat >= bounds.south && point.lat <= bounds.north && longitude >= bounds.west && longitude <= bounds.east;
}

export function knownWaterReviews(data) {
  if (data?.body !== 'earth') return [];
  return KNOWN_WATER_REFERENCES.filter(point => containsReference(data.bounds, point));
}

export const REVIEWED_AREAS = [
  {id: 'idaho-sample-04', center: {lat: 43.25, lon: -114.24}, extentMeters: 32000,
    title: 'Black Butte–Magic Reservoir regional sample', priorUse: 'published-planetary-context',
    finding: 'USGS identifies the Black Butte basaltic lava field at 43.18° N, 114.35° W inside this area. Low-shield and lava-pit research already discusses this region in planetary context. The area also contains the BLM Magic Reservoir reference point.',
    boundary: 'The source vent and reservoir marker lie inside the analysis bounds. Lava-unit and reservoir polygons have not been digitized here.',
    novelty: 'Prior planetary research is documented. A new coordinate or terrain score does not establish a newly discovered analog.',
    sources: [blackButte, lpsc2004, {title: 'De Crescenzo et al. (2022), LPSC 2944 — Black Butte lava pits', url: 'https://www.hou.usra.edu/meetings/lpsc2022/pdf/2944.pdf', kind: 'Conference abstract'}, magic]},
  {id: 'idaho-sample-06', center: {lat: 43.25, lon: -112.96}, extentMeters: 32000,
    title: 'Rock Corral Butte regional sample', priorUse: 'published-planetary-context',
    finding: 'The published Rock Corral Butte vent coordinate, 43°22.25′ N, 113°1.20′ W, lies inside this area. The cited study examines basaltic flow inflation and its implications for small volcanic shields on Mars and Venus.',
    boundary: 'Containment applies to the published vent point. The full 7 × 11 km flow footprint and individual deposits have not been intersected with this DEM area.',
    novelty: 'Planetary-analogy literature already exists for this landform. Its regional Jezero terrain index is a separate project comparison.',
    sources: [rockCorral]},
  {id: 'idaho-sample-09', center: {lat: 43.55, lon: -112.96}, extentMeters: 32000,
    title: 'Western INL–Atomic City regional sample', priorUse: 'novelty-unverified',
    finding: 'USGS table 4 places the West of Atomic City Vent (43.449, −112.844) and Lavatoo Butte (43.531, −113.094) inside this area. These support local basaltic geological context. The table coordinates use NAD83 and are used here for approximate regional containment.',
    boundary: 'Mapped vent locations establish point context. They do not identify the rock type of every cell or supply a mapped experimental footprint. Land ownership and access across the area require separate assessment.',
    novelty: 'A bounded search did not establish prior use of this exact 32 km footprint as a Jezero regional-terrain analog. Novelty remains unverified. The landforms are already documented geologically.',
    sources: [inlGeology]},
  {id: 'craters-moon', center: {lat: 43.371, lon: -113.493}, extentMeters: 32000,
    title: 'Craters of the Moon regional reference', priorUse: 'established-analog-region',
    finding: 'The BASALT program conducted published Mars-analog science operations in the Craters of the Moon region.',
    boundary: 'The analysis area follows a regional reference center. Published BASALT experiment boundaries have not been overlaid with this DEM footprint.',
    novelty: 'This is an established analog research region and serves as a comparison reference.', sources: [basalt]},
  {id: 'amboy', center: {lat: 34.557, lon: -115.78}, extentMeters: 32000,
    title: 'Amboy regional reference', priorUse: 'established-analog-region',
    finding: 'The NASA PDS archive documents field photography at Amboy in February 1976. Its volcanic cone is much smaller than this regional analysis area.',
    boundary: 'The 32 km terrain statistics describe surrounding relief as well as the volcanic field. Individual cone slopes and lava hazards require finer measurements.',
    novelty: 'Amboy has a documented field-study history and serves as an established reference.',
    sources: [{title: 'NASA PDS — Amboy Crater field photographs', url: 'https://pds-geosciences.wustl.edu/missions/amboycrater/index.htm', kind: 'Mission archive'}]}
];

export function areaLiteratureReview(data) {
  if (data?.body !== 'earth' || !data.center) return null;
  return REVIEWED_AREAS.find(area => Math.abs(data.center.lat - area.center.lat) < 0.00001
    && Math.abs(data.center.lon - area.center.lon) < 0.00001
    && data.widthMeters === area.extentMeters && data.depthMeters === area.extentMeters) || null;
}
