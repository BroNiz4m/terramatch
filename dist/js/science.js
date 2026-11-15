import {comparisonStatus} from './comparison-status.js';
/** TerraMatch's reproducible terrain comparison. All terrain heights are sourced, not generated. */
export const SOURCES = [
  { id: 'mola', title: 'MGS MOLA MEGDR elevation products', agency: 'NASA / PDS Geosciences', url: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html', license: 'NASA planetary archive; cite MOLA science team and dataset.', note: 'Altimeter-derived gridded topography relative to the Mars areoid. Cells without observations can be interpolated. References use 128 ppd (approximately 463 m north–south); automatic pair search uses the global 32 ppd product (approximately 1,853 m north–south). These are postings, not effective accuracy.' },
  { id: 'lola', title: 'LRO LOLA global and south-polar elevation models', agency: 'NASA / PDS Geosciences', url: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm', license: 'NASA planetary archive; cite LOLA science team and dataset.', note: 'Lunar laser-altimeter terrain. Elevations relative to the 1,737.4 km lunar reference sphere. References use the 240 m south-polar subset; automatic pair search uses the global LDEM_16 grid (approximately 1,895 m north–south). Source cells may interpolate ground tracks.' },
  { id: 'srtm', title: 'Skadi elevation tiles — mixed-source terrain', agency: 'NASA / NGA / USGS / NOAA and other providers; Mapzen / AWS distribution', url: 'https://registry.opendata.aws/terrain-tiles/', license: 'Underlying providers have different conditions; retain Mapzen / Tilezen attribution and source credits.', note: 'Terrain data: USGS SRTM / GMTED2010 / 3DEP; NOAA ETOPO1; Copernicus EU-DEM. Distributed by Mapzen. Regional inputs can differ; these are not unmodified NASA Earthdata files.' },
  { id: 'srtm-nasa', title: 'NASA SRTM Global 1 arc second V003', agency: 'NASA / LP DAAC', url: 'https://doi.org/10.5067/MEaSUREs/SRTM/SRTMGL1.003', license: 'NASA open Earth science data.', note: 'Reference documentation for SRTM elevation. Near-global coverage is 60° N to 56° S. The app uses the openly distributed Skadi derivative and identifies that distinction.' },
  { id: 'jezero', title: 'Jezero Crater landing site', agency: 'NASA Science', url: 'https://science.nasa.gov/mars/mars-2020/jezero-crater/', license: 'NASA site image/data policies apply.', note: 'Mission context for a crater basin containing evidence of an ancient lake and delta. The app terrain score does not test mineralogy or past habitability.' },
  { id: 'earthdata', title: 'NASA Earthdata Search', agency: 'NASA', url: 'https://search.earthdata.nasa.gov/', license: 'Per-dataset conditions and citation requirements.', note: 'Challenge-supplied discovery portal. Surface thermal context is documented separately. Mineralogy, ice and biology have not been analyzed.' },
  { id: 'diviner', title: 'LRO Diviner data archive', agency: 'NASA / PDS Geosciences', url: 'https://pds-geosciences.wustl.edu/missions/lro/diviner.htm', license: 'Cite relevant Diviner data products and publications.', note: 'Challenge-supplied thermal source. Not incorporated into the terrain-only ranking; no temperature values are invented.' },
  { id: 'copernicus', title: 'Copernicus Data Space Ecosystem', agency: 'ESA / European Union', url: 'https://dataspace.copernicus.eu/', license: 'Copernicus Sentinel data terms and relevant product attribution.', note: 'Challenge-supplied resource. Optical imagery can support later land-cover and surface characterization; no Sentinel analysis is claimed here.' },
  { id: 'csa', title: 'RADARSAT data and SAR tutorial', agency: 'Canadian Space Agency', url: 'https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial', license: 'Modified MIT for tutorial code; radar products have their own terms.', note: 'Challenge-supplied SAR processing guidance. Radar data are not incorporated in this release.' },
  { id: 'jaxa', title: 'JAXA G-Portal', agency: 'JAXA', url: 'https://www.gportal.jaxa.jp/?lang=en', license: 'G-Portal product-specific terms and acknowledgement.', note: 'Challenge-supplied resource. Snow, precipitation and other variables are not included in the current terrain-only score.' },
  { id: 'esa-catalogue', title: 'ESA Open Science Catalogue', agency: 'ESA', url: 'https://opensciencedata.esa.int/', license: 'Per-product licence and citation requirements.', note: 'Challenge-supplied catalogue of research datasets, products and workflows.' },
  { id: 'worldview', title: 'NASA Worldview / GIBS', agency: 'NASA', url: 'https://worldview.earthdata.nasa.gov/', license: 'Acknowledge NASA GIBS and original products.', note: 'Challenge-supplied visual discovery resource. A visualization tile is not treated as a scientific elevation measurement.' },
  { id: 'amboy', title: 'Amboy Crater field photos', agency: 'NASA / PDS Geosciences', url: 'https://pds-geosciences.wustl.edu/missions/amboycrater/index.htm', license: 'Per-product PDS archive terms.', note: 'Amboy is an established basaltic field-study location, not a claimed new discovery.' },
  { id: 'wadi-geology', title: 'Wadi Rum Protected Area', agency: 'UNESCO World Heritage Centre', url: 'https://whc.unesco.org/en/list/1377/', license: 'UNESCO content terms; linked for geological context.', note: 'Documents the sandstone mountains, valleys and desert landforms. No material-equivalence score is derived from this contextual source.' },
  { id: 'wahbah-geology', title: 'Al-Wahbah volcanic crater', agency: 'Saudipedia', url: 'https://saudipedia.com/en/what-is-the-deepest-volcanic-crater-in-saudi-arabia', license: 'Provider content terms; linked for contextual reference.', note: 'Identifies Al-Wahbah as a volcanic crater in Harrat Kishb. This does not establish equivalence to impact-crater formation.' },
  { id: 'shackleton-location', title: 'Gazetteer of Planetary Nomenclature: Shackleton', agency: 'IAU / USGS', url: 'https://planetarynames.wr.usgs.gov/Feature/5450', license: 'USGS planetary nomenclature reference.', note: 'Crater center: 89.67° S, 129.78° E. Used to center the lunar terrain window.' },
  {"id":"cabeus-location","title":"Gazetteer: Cabeus crater center","agency":"IAU / USGS","url":"https://planetarynames.wr.usgs.gov/Feature/953","license":"USGS planetary nomenclature reference.","note":"Rounded crater center 85.33° S, 42.13° W. This is not the LCROSS impact coordinate or an approved lunar base site."},
  {"id":"nobile-location","title":"Gazetteer: Nobile crater center","agency":"IAU / USGS","url":"https://planetarynames.wr.usgs.gov/Feature/4321","license":"USGS planetary nomenclature reference.","note":"Rounded crater center 85.28° S, 53.27° E. The window is not the western-rim region in the historical 2021 VIPER announcement."},
  {"id":"gale-location","title":"Curiosity historical Bradbury Landing coordinate","agency":"MSL science team / JGR Planets","url":"https://doi.org/10.1002/2014JE004622","license":"Cite Vasavada et al. (2014); publisher terms apply.","note":"Historical landing coordinate 4.5895° S, 137.4417° E. Not the current rover position or Gale crater center."},
  {"id":"gale-geology","title":"A Guide to Gale Crater","agency":"NASA Science","url":"https://science.nasa.gov/resource/a-guide-to-gale-crater/","license":"NASA content policies; retain original credits.","note":"Basin and layered-sediment context. Terrain scoring does not measure minerals, biology or sedimentary equivalence."},
  {"id":"eberswalde-location","title":"HiRISE: Delta Structure in Eberswalde Crater","agency":"NASA / JPL-Caltech / University of Arizona","url":"https://www.uahirise.org/dtm/dtm.php?ID=PSP_001336_1560","license":"HiRISE provider policies; retain NASA/JPL-Caltech/UArizona credits.","note":"Approximate page center 23.8° S, 326.3° E selects the study window. The app decodes MOLA elevation; the finer HiRISE DEM is not ingested."},
  {"id":"eberswalde-geology","title":"Eberswalde Delta","agency":"NASA Science","url":"https://science.nasa.gov/resource/eberswalde-delta-3-d/","license":"NASA content policies; retain original credits.","note":"Delta-landform context; no water, mineral, biological or mission-suitability score is inferred from the terrain grid."},
];

export const SITES = [
  { id: 'jezero', name: 'Jezero Crater', country: 'Mars', body: 'mars', lat: 18.38, lon: 77.58, category: 'Crater basin & ancient delta', description: 'A terrain study window around the Perseverance landing region, spanning basin floor and surrounding relief.', useCases: ['Terrain reconnaissance', 'Route planning practice', 'Crater-scale relief comparison'], limitations: ['The 500 m grid does not resolve rover-scale rocks or hazards.', 'MOLA cells can contain interpolation between altimeter tracks.', 'A terrain resemblance does not establish matching minerals or habitability.'], sourceIds: ['mola', 'jezero'], terrainFile: 'data/jezero-terrain.json', color: '#e9874a' },
  { id: 'shackleton', name: 'Shackleton region', country: 'Moon', body: 'moon', lat: -89.67, lon: 129.78, category: 'South-polar crater terrain', description: 'A south-polar terrain window centered on Shackleton, for comparing crater-scale slope and relief.', useCases: ['Polar terrain reconnaissance', 'Crater relief comparison', 'Surface-navigation practice'], limitations: ['Terrain alone cannot determine illumination, permanent shadow, ice, landing safety or base suitability.', 'Earth does not reproduce lunar gravity, vacuum or radiation.', 'The robot and landing sequence are an exploration interface, not a flight dynamics model.'], sourceIds: ['lola', 'diviner', 'shackleton-location'], terrainFile: 'data/shackleton-terrain.json', color: '#b7bdcf' },
  {"id":"cabeus-center","name":"Cabeus crater center","country":"Moon","body":"moon","lat":-85.33,"lon":-42.13,"category":"South-polar crater interior","description":"A 32 km projected window at the rounded Cabeus crater center for coarse polar-terrain comparison. This is not the LCROSS impact coordinate.","useCases":["Crater-scale terrain documentation","Polar slope and relief comparison","Survey-planning practice"],"limitations":["No local ice detection, permanent-shadow calculation or base-suitability assessment is provided.","The center window is not the LCROSS impact site; crater-wide scientific context does not classify every grid point.","LOLA interpolates ground tracks; native posting is not effective measurement accuracy.","Projected polar spacing differs slightly from geodesic distance. Earth does not reproduce lunar vacuum, gravity or radiation."],"sourceIds":["lola","cabeus-location"],"terrainFile":"data/cabeus-center-terrain.json","color":"#b2b8ca"},
  {"id":"nobile-center","name":"Nobile crater center","country":"Moon","body":"moon","lat":-85.28,"lon":53.27,"category":"South-polar crater relief","description":"A 32 km projected window at the rounded Nobile crater center. It samples the crater terrain, not the western-rim region in the historical VIPER announcement.","useCases":["Polar-crater terrain reconnaissance","Coarse traverse-planning practice","Relief and slope documentation"],"limitations":["This window is not the historical VIPER western-rim landing region or a mission-certified site.","No illumination, communications, ice abundance or safe-route analysis is derived from the DEM.","LOLA interpolates tracks; individual rocks, soil strength and robot-scale hazards remain unresolved.","A terrain resemblance does not reproduce lunar operating conditions or validate a permanent base."],"sourceIds":["lola","nobile-location"],"terrainFile":"data/nobile-center-terrain.json","color":"#c3b7c6"},
  {"id":"gale-bradbury","name":"Gale / Bradbury Landing","country":"Mars","body":"mars","lat":-4.5895,"lon":137.4417,"category":"Historical landing region & basin relief","description":"A 32 km window around Curiosity's published historical landing coordinate, spanning broad Gale basin relief. It is not the current rover position or the entire crater.","useCases":["Basin-scale terrain survey","Scientific-stop planning exercises","Sedimentary field-workflow practice after independent geology review"],"limitations":["Many native MOLA bins have zero observation counts and retain source-interpolated topography; inspect the recorded support counts.","The 500 m sample interval does not establish rover-scale hazard coverage or source accuracy.","Sedimentary context is qualitative; minerals, habitability and biosignatures are not scored.","No Curiosity thermal or local weather product is bundled for this window; Jezero MEDA observations cannot be reused here."],"sourceIds":["mola","gale-location","gale-geology"],"terrainFile":"data/gale-bradbury-terrain.json","color":"#e4a061"},
  {"id":"eberswalde-delta","name":"Eberswalde delta area","country":"Mars","body":"mars","lat":-23.8,"lon":-33.7,"category":"Delta-area regional terrain","description":"A 32 km window at the approximate HiRISE delta-page center (23.8° S, 326.3° E). Elevation is NASA MOLA, with the finer HiRISE imagery used only as linked context.","useCases":["Fan and delta field-mapping workflows","Regional terrain comparison","Sampling-route practice after separate geological assessment"],"limitations":["Fine delta channels and inverted relief are unresolved by this coarse MOLA comparison.","Many native MOLA bins have zero observation counts; source-interpolated heights are not direct measurements at every output point.","HiRISE pixels are not ingested or claimed as the terrain resolution.","No modern water, mineral-equivalence, biosignature, local thermal or landing-safety result is inferred."],"sourceIds":["mola","eberswalde-location","eberswalde-geology"],"terrainFile":"data/eberswalde-delta-terrain.json","color":"#dba779"},
  { id: 'wadi-rum', name: 'Wadi Rum', country: 'Jordan', body: 'earth', lat: 29.575, lon: 35.419, category: 'Arid sandstone valleys', description: 'Desert relief and exposed sandstone terrain offer a candidate environment for route-planning and field-operations exercises.', useCases: ['Navigation exercises', 'Arid field operations', 'Terrain-profile comparison'], limitations: ['Sandstone geology is not assumed to match Jezero minerals or lunar regolith.', 'Atmospheric pressure, gravity, weathering and biology differ.', 'Access, permissions and field safety have not been assessed.'], sourceIds: ['srtm', 'srtm-nasa', 'wadi-geology'], terrainFile: 'data/wadi-rum-terrain.json', color: '#eac58b' },
  { id: 'al-wahbah', name: 'Al Wahbah', country: 'Saudi Arabia', body: 'earth', lat: 22.900, lon: 41.138, category: 'Volcanic maar & surrounding plateau', description: 'A volcanic crater landscape considered as a candidate for comparing crater-form relief and terrain traverses.', useCases: ['Crater morphology exercises', 'Terrain navigation', 'Volcanic field reconnaissance'], limitations: ['A volcanic maar and an impact crater form through different processes.', 'A salt-covered floor is not evidence of lunar or Martian ice.', 'Candidate status is terrain-based. Surface thermal context is reviewed separately; mineral equivalence is unassessed.'], sourceIds: ['srtm', 'srtm-nasa', 'wahbah-geology'], terrainFile: 'data/al-wahbah-terrain.json', color: '#d8bb97' },
  { id: 'lanzarote', name: 'Lanzarote', country: 'Spain', body: 'earth', lat: 28.995, lon: -13.740, category: 'Volcanic island terrain', description: 'A volcanic-island terrain window retained for visual inspection. Its 32 km window intersects the sea, so it is excluded from terrain ranking.', comparisonEligible: false, useCases: ['Volcanic terrain reconnaissance', 'Coastal-window sensitivity study'], limitations: ['Excluded from ranking: this window includes bathymetry and is not an inland-only terrain sample.', 'An established training environment, not a claimed new analog discovery.', 'Island climate, marine influence and atmosphere differ from planetary targets.', 'Material equivalence requires independent geological evidence.'], sourceIds: ['srtm', 'srtm-nasa'], terrainFile: 'data/lanzarote-terrain.json', color: '#a69886' },
  { id: 'amboy', name: 'Amboy Crater', country: 'United States', body: 'earth', lat: 34.557, lon: -115.780, category: 'Basaltic cinder cone & lava field', description: 'An established terrestrial field-study setting in the Mojave Desert, included as a recognizable reference candidate.', useCases: ['Basaltic terrain studies', 'Instrument field practice', 'Terrain comparison baseline'], limitations: ['This is a known analog/field-study setting, not a newly discovered site.', 'Cinder-cone formation differs from impact-crater formation.', 'The coarse comparison does not resolve lava-surface hazards.'], sourceIds: ['srtm', 'srtm-nasa', 'amboy'], terrainFile: 'data/amboy-terrain.json', color: '#ad9c83' },
];

export const TARGETS = SITES.filter(site => site.body !== 'earth');
export const EARTH_SITES = SITES.filter(site => site.body === 'earth' && site.comparisonEligible !== false);
export const SLOPE_BINS = [0, 2, 5, 10, 20, 35, 90];
export const METHOD = {
  gridSpacingMeters: 500,
  gradientBaselineMeters: 1000,
  extentMeters: 32000,
  description: 'All terrain windows are sampled to a 65 × 65 grid with 500 m spacing. Interior slopes use central differences over a 1,000 m baseline. Default index = 100 × [1 − (0.65 × slope-distribution total-variation distance + 0.35 × normalized log relief difference)]. Active weights are recorded with each comparison.',
  limitations: 'A transparent terrain-only heuristic, not a probability, validated mission-suitability model, discovery claim or assessment of landing/base safety. Material, temperature, ice and biological similarity are not scored.',
};

const terrainCache = new Map();
export async function loadTerrain(site) {
  if (typeof site === 'string') site = SITES.find(item => item.id === site) ?? { terrainFile: site };
  if (!site?.terrainFile) throw new Error('This location has no terrain product.');
  if (!terrainCache.has(site.terrainFile)) {
    terrainCache.set(site.terrainFile, fetch(new URL('../' + site.terrainFile, import.meta.url)).then(async response => {
      if (!response.ok) throw new Error(`Terrain data unavailable (${response.status}).`);
      const data = await response.json();
      if (!Number.isInteger(data.size) || data.heights?.length !== data.size * data.size || !data.heights.every(Number.isFinite)) throw new Error('Invalid terrain data: incomplete height grid.');
      return data;
    }).catch(error => { terrainCache.delete(site.terrainFile); throw error; }));
  }
  return terrainCache.get(site.terrainFile);
}

export function sampleTerrain(data, u, v) {
  const n = data.size, x = Math.max(0, Math.min(1, u)) * (n - 1), y = Math.max(0, Math.min(1, v)) * (n - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), tx = x - x0, ty = y - y0;
  const h = data.heights;
  return (h[y0*n+x0]*(1-tx)+h[y0*n+x1]*tx)*(1-ty)+(h[y1*n+x0]*(1-tx)+h[y1*n+x1]*tx)*ty;
}

const resampledGrids=new WeakMap();
/** Compare at the coarser available spacing; never imply new native detail. */
export function resampleTerrain(data,spacingMeters){
  const original=data.widthMeters/(data.size-1);
  if(spacingMeters===original)return data;
  if(!Number.isFinite(spacingMeters)||spacingMeters<original||data.widthMeters!==data.depthMeters||data.widthMeters%spacingMeters!==0)throw Error('A matched coarser square grid is required.');
  if(!resampledGrids.has(data))resampledGrids.set(data,new Map());const cache=resampledGrids.get(data);if(cache.has(spacingMeters))return cache.get(spacingMeters);
  const size=data.widthMeters/spacingMeters+1,heights=[];for(let row=0;row<size;row++)for(let col=0;col<size;col++)heights.push(sampleTerrain(data,col/(size-1),row/(size-1)));
  const result={...data,size,heights,gridSpacingMeters:spacingMeters,analysisResampling:{inputSpacingMeters:original,outputSpacingMeters:spacingMeters,method:'Bilinear sampling of the existing numeric grid at the common coarser spacing. No new source detail.'}};cache.set(spacingMeters,result);return result;
}

/** Geolocate an avatar/inspection point without treating polar projected axes as geographic degrees. */
export function terrainCoordinates(data, u, v) {
  u=Math.max(0,Math.min(1,u));v=Math.max(0,Math.min(1,v));
  const p=data.projection;
  if(p?.type==='south-polar-stereographic'){
    const x=p.xWest+(p.xEast-p.xWest)*u,y=p.yNorth+(p.ySouth-p.yNorth)*v,rho=Math.hypot(x,y);
    return {lat:-90+2*Math.atan(rho/(2*p.radiusMeters))*180/Math.PI,lon:Math.atan2(x,y)*180/Math.PI};
  }
  const longitude=data.bounds.west+(data.bounds.east-data.bounds.west)*u;
  return {lat:data.bounds.north+(data.bounds.south-data.bounds.north)*v,lon:data.projection?.wrapLongitude?((longitude+180)%360+360)%360-180:longitude};
}

export function analyzeTerrain(data) {
  const {size: n, heights, widthMeters, depthMeters} = data;
  if (!Number.isInteger(n) || n < 3 || heights?.length !== n*n || !heights.every(Number.isFinite) || !(widthMeters > 0) || !(depthMeters > 0)) throw new Error('A complete finite terrain grid and positive physical extent are required.');
  const dx = widthMeters/(n-1), dz = depthMeters/(n-1), slopes = [], slopeGrid = new Array(n*n).fill(0), histogram = new Array(SLOPE_BINS.length-1).fill(0);
  let min = Infinity, max = -Infinity;
  for(const h of heights){min=Math.min(min,h);max=Math.max(max,h);}
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
    const gx=(heights[y*n+x+1]-heights[y*n+x-1])/(2*dx), gz=(heights[(y+1)*n+x]-heights[(y-1)*n+x])/(2*dz);
    const slope=Math.atan(Math.hypot(gx,gz))*180/Math.PI; slopes.push(slope);slopeGrid[y*n+x]=slope;
    const bin=SLOPE_BINS.findIndex((upper,index)=>index>0&&slope<upper);
    histogram[bin<0?histogram.length-1:bin-1]++;
  }
  for(let x=0;x<n;x++){slopeGrid[x]=slopeGrid[n+x];slopeGrid[(n-1)*n+x]=slopeGrid[(n-2)*n+x];}
  for(let y=0;y<n;y++){slopeGrid[y*n]=slopeGrid[y*n+1];slopeGrid[y*n+n-1]=slopeGrid[y*n+n-2];}
  slopes.sort((a,b)=>a-b);
  const profile=heights.slice(Math.floor(n/2)*n, (Math.floor(n/2)+1)*n);
  return {min,max,relief:max-min,slopeMean:slopes.reduce((a,b)=>a+b,0)/slopes.length,slopeP90:slopes[Math.floor((slopes.length-1)*0.9)],slopeHistogram:histogram.map(count=>count/slopes.length),slopeBinEdges:SLOPE_BINS.slice(),slopeGrid,profile,profileRelative:profile.map(h=>h-min),validCount:heights.length,slopeSampleCount:slopes.length,gridSpacingMeters:{x:dx,z:dz},gradientBaselineMeters:{x:2*dx,z:2*dz},extentMeters:{x:widthMeters,z:depthMeters},comparisonEligible:comparisonStatus(null,data).scoreEligible,source:data.source};
}

export function compareTerrains(target, earth, weights = {}) {
  if(!comparisonStatus(null,target).scoreEligible||!comparisonStatus(null,earth).scoreEligible)throw new Error('This terrain window is excluded from ranking because its land coverage needs review (coastal bathymetry or coarse land-screen exclusion).');
  const spacing=Math.max(target.heights?target.widthMeters/(target.size-1):target.gridSpacingMeters?.x||500,earth.heights?earth.widthMeters/(earth.size-1):earth.gridSpacingMeters?.x||500);
  const a=target.heights?analyzeTerrain(resampleTerrain(target,spacing)):target,b=earth.heights?analyzeTerrain(resampleTerrain(earth,spacing)):earth;
  if(a.gridSpacingMeters?.x!==b.gridSpacingMeters?.x||a.gridSpacingMeters?.z!==b.gridSpacingMeters?.z||a.extentMeters?.x!==b.extentMeters?.x||a.extentMeters?.z!==b.extentMeters?.z)throw Error('Terrain comparisons require equal physical extents and grid spacing.');
  if(a.slopeHistogram?.length!==b.slopeHistogram?.length)throw new Error('Matched slope histogram bins are required.');
  const distance=0.5*a.slopeHistogram.reduce((sum,p,index)=>sum+Math.abs(p-b.slopeHistogram[index]),0);
  const reliefDistance=Math.min(1,Math.abs(Math.log((a.relief+1)/(b.relief+1)))/Math.log(4));
  const sw=Number.isFinite(weights.slope)?Math.max(0,weights.slope):0.65,rw=Number.isFinite(weights.relief)?Math.max(0,weights.relief):0.35,total=sw+rw;
  if(total===0)throw new Error('At least one terrain comparison weight must be positive.');
  const score=100*(1-(sw*distance+rw*reliefDistance)/total);
  const activeMethod=`Index = 100 × [1 − (${(sw/total).toFixed(6)} × slope-distribution total-variation distance + ${(rw/total).toFixed(6)} × normalized log relief difference)]. All windows use ${spacing.toLocaleString('en-US')} m sampling and ${(spacing*2).toLocaleString('en-US')} m gradient baselines.`;
  return {score:Math.round(score*10)/10,similarity:Math.round(score*10)/10,slopeDistance:distance,reliefDistance,components:[{id:'slope',name:'Slope distribution',score:100*(1-distance),weight:sw/total,target:a.slopeMean,earth:b.slopeMean,unit:'degrees'},{id:'relief',name:'Relative relief',score:100*(1-reliefDistance),weight:rw/total,target:a.relief,earth:b.relief,unit:'m'}],method:activeMethod,scope:'Terrain only',limitations:METHOD.limitations,unassessed:['Surface materials','Thermal equivalence (separate context records available)','Water or ice','Biology','Accessibility','Landing or base safety'],targetStats:a,earthStats:b};
}

/**
 * Exploration-task presets for the same terrain-only index. Weights are disclosed,
 * project-defined choices; they are not calibrated against field or mission results.
 * Thermal study keeps the default terrain weights: temperature never enters the index.
 */
export const TASK_PROFILES = Object.freeze({
  terrain: { label: 'Terrain exploration', weights: { slope: 0.65, relief: 0.35 }, measures: ['relief', 'slopeMean', 'slopeP90'],
    rationale: 'Balanced default: the mix of slopes and the overall relief both describe the shape of a landscape.',
    helps: ['Shortlist landscapes with a comparable slope mix and overall relief.', 'Compare cross-sections and slope ranges before choosing a field site.'],
    limits: ['A similar terrain shape does not imply the same geological process or materials.', 'Results depend on the 32 km window and where it is centered.'] },
  navigation: { label: 'Navigation training', weights: { slope: 0.85, relief: 0.15 }, measures: ['under10', 'atLeast20', 'slopeP90'],
    rationale: 'Route planning at this scale depends mostly on how much ground falls in each slope range, so slope distribution carries more weight than total relief.',
    helps: ['Practise route selection across a comparable mix of gentle and steep ground at kilometre scale.', 'Rehearse traverse planning and map reading on similar slope ranges.'],
    limits: ['A 500 m grid does not resolve rocks, loose soil or other rover-scale hazards.', 'Traction and stability differ under lunar or Martian gravity; moving through the 3D scene does not test mobility.'] },
  fieldwork: { label: 'Field operations', weights: { slope: 0.5, relief: 0.5 }, measures: ['under5', 'relief', 'slopeMean'],
    rationale: 'Field logistics depend on local steepness and on the elevation range crews and equipment must work across, so both measures are weighted equally.',
    helps: ['Plan crew or equipment movement across a comparable elevation range.', 'Rehearse sampling and instrument set-up on similarly sloped ground.'],
    limits: ['Access, permits, weather and safety at the Earth site are not assessed.', 'Vacuum, radiation, suits and life-support constraints are not reproduced on Earth.'] },
  thermal: { label: 'Thermal environment study', weights: { slope: 0.65, relief: 0.35 }, measures: ['relief', 'slopeMean'],
    rationale: 'The ranking keeps the default terrain weights. Surface temperature is reviewed as separate evidence and never enters the index.',
    helps: ['Shortlist sites by terrain first, then read each temperature record with its own statistic and time coverage.', 'Identify which thermal products exist for a site before planning equipment tests.'],
    limits: ['Earth daily means, lunar annual maxima and rover observations are not directly comparable.', 'No temperature-based ranking, ice detection or thermal-survival result is produced.'] },
});
export function taskProfile(id) { return TASK_PROFILES[id] ?? TASK_PROFILES.terrain; }
/** Shares of interior slope samples, read directly from the six-bin slope histogram. */
export function taskMeasures(stats) { const h = stats.slopeHistogram; return { under5: h[0] + h[1], under10: h[0] + h[1] + h[2], atLeast20: h[4] + h[5] }; }
