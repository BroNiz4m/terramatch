/** TerraMatch's reproducible terrain comparison. All terrain heights are sourced, not generated. */
export const SOURCES = [
  { id: 'mola', title: 'MGS MOLA MEGDR, 128 pixels per degree', agency: 'NASA / PDS Geosciences', url: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html', license: 'NASA planetary archive; cite MOLA science team and dataset.', note: 'Altimeter-derived gridded topography relative to the Mars areoid. Cells without observations can be interpolated. Native north–south spacing is approximately 463 m.' },
  { id: 'lola', title: 'LRO LOLA South Polar Digital Elevation Model', agency: 'NASA / PDS Geosciences', url: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm', license: 'NASA planetary archive; cite LOLA science team and dataset.', note: 'Lunar laser-altimeter terrain. Elevations relative to the 1,737.4 km lunar reference sphere. A polar projection is used for the south-pole subset.' },
  { id: 'srtm', title: 'Skadi elevation tiles — mixed-source terrain', agency: 'NASA / NGA / USGS / NOAA and other providers; Mapzen / AWS distribution', url: 'https://registry.opendata.aws/terrain-tiles/', license: 'Underlying providers have different conditions; retain Mapzen / Tilezen attribution and source credits.', note: 'Terrain data: USGS SRTM / GMTED2010 / 3DEP; NOAA ETOPO1; Copernicus EU-DEM. Distributed by Mapzen. Regional inputs can differ; these are not unmodified NASA Earthdata files.' },
  { id: 'srtm-nasa', title: 'NASA SRTM Global 1 arc second V003', agency: 'NASA / LP DAAC', url: 'https://doi.org/10.5067/MEaSUREs/SRTM/SRTMGL1.003', license: 'NASA open Earth science data.', note: 'Reference documentation for SRTM elevation. Near-global coverage is 60° N to 56° S. The app uses the openly distributed Skadi derivative and identifies that distinction.' },
  { id: 'jezero', title: 'Jezero Crater landing site', agency: 'NASA Science', url: 'https://science.nasa.gov/mars/mars-2020/jezero-crater/', license: 'NASA site image/data policies apply.', note: 'Mission context for a crater basin containing evidence of an ancient lake and delta. The app terrain score does not test mineralogy or past habitability.' },
  { id: 'earthdata', title: 'NASA Earthdata Search', agency: 'NASA', url: 'https://search.earthdata.nasa.gov/', license: 'Per-dataset conditions and citation requirements.', note: 'Challenge-supplied discovery portal. Temperature, mineralogy, ice and biology have not been measured by this app.' },
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
];

export const SITES = [
  { id: 'jezero', name: 'Jezero Crater', country: 'Mars', body: 'mars', lat: 18.38, lon: 77.58, category: 'Crater basin & ancient delta', description: 'A terrain study window around the Perseverance landing region, spanning basin floor and surrounding relief.', useCases: ['Terrain reconnaissance', 'Route planning practice', 'Crater-scale relief comparison'], limitations: ['The 500 m grid does not resolve rover-scale rocks or hazards.', 'MOLA cells can contain interpolation between altimeter tracks.', 'A terrain resemblance does not establish matching minerals or habitability.'], sourceIds: ['mola', 'jezero'], terrainFile: 'data/jezero-terrain.json', color: '#e9874a', image: 'assets/mars-surface.jpg' },
  { id: 'shackleton', name: 'Shackleton region', country: 'Moon', body: 'moon', lat: -89.67, lon: 129.78, category: 'South-polar crater terrain', description: 'A south-polar terrain window centered on Shackleton, for comparing crater-scale slope and relief.', useCases: ['Polar terrain reconnaissance', 'Crater relief comparison', 'Surface-navigation practice'], limitations: ['Terrain alone cannot determine illumination, permanent shadow, ice, landing safety or base suitability.', 'Earth does not reproduce lunar gravity, vacuum or radiation.', 'The robot and landing sequence are an exploration interface, not a flight dynamics model.'], sourceIds: ['lola', 'diviner', 'shackleton-location'], terrainFile: 'data/shackleton-terrain.json', color: '#b7bdcf', image: 'assets/moon-surface.jpg' },
  { id: 'wadi-rum', name: 'Wadi Rum', country: 'Jordan', body: 'earth', lat: 29.575, lon: 35.419, category: 'Arid sandstone valleys', description: 'Desert relief and exposed sandstone terrain offer a candidate environment for route-planning and field-operations exercises.', useCases: ['Navigation exercises', 'Arid field operations', 'Terrain-profile comparison'], limitations: ['Sandstone geology is not assumed to match Jezero minerals or lunar regolith.', 'Atmospheric pressure, gravity, weathering and biology differ.', 'Access, permissions and field safety have not been assessed.'], sourceIds: ['srtm', 'srtm-nasa', 'wadi-geology'], terrainFile: 'data/wadi-rum-terrain.json', color: '#eac58b', image: 'assets/wadi-rum.jpg' },
  { id: 'al-wahbah', name: 'Al Wahbah', country: 'Saudi Arabia', body: 'earth', lat: 22.900, lon: 41.138, category: 'Volcanic maar & surrounding plateau', description: 'A volcanic crater landscape considered as a candidate for comparing crater-form relief and terrain traverses.', useCases: ['Crater morphology exercises', 'Terrain navigation', 'Volcanic field reconnaissance'], limitations: ['A volcanic maar and an impact crater form through different processes.', 'A salt-covered floor is not evidence of lunar or Martian ice.', 'Candidate status is terrain-based; mineralogy and temperature are unassessed.'], sourceIds: ['srtm', 'srtm-nasa', 'wahbah-geology'], terrainFile: 'data/al-wahbah-terrain.json', color: '#d8bb97', image: 'assets/al-wahbah.jpg' },
  { id: 'lanzarote', name: 'Lanzarote', country: 'Spain', body: 'earth', lat: 28.995, lon: -13.740, category: 'Volcanic island terrain', description: 'A volcanic-island terrain window retained for visual inspection. Its 32 km window intersects the sea, so it is excluded from terrain ranking.', comparisonEligible: false, useCases: ['Volcanic terrain reconnaissance', 'Coastal-window sensitivity study'], limitations: ['Excluded from ranking: this window includes bathymetry and is not an inland-only terrain sample.', 'An established training environment, not a claimed new analog discovery.', 'Island climate, marine influence and atmosphere differ from planetary targets.', 'Material equivalence requires independent geological evidence.'], sourceIds: ['srtm', 'srtm-nasa'], terrainFile: 'data/lanzarote-terrain.json', color: '#a69886', image: 'assets/lanzarote.jpg' },
  { id: 'amboy', name: 'Amboy Crater', country: 'United States', body: 'earth', lat: 34.557, lon: -115.780, category: 'Basaltic cinder cone & lava field', description: 'An established terrestrial field-study setting in the Mojave Desert, included as a recognizable reference candidate.', useCases: ['Basaltic terrain studies', 'Instrument field practice', 'Terrain comparison baseline'], limitations: ['This is a known analog/field-study setting, not a newly discovered site.', 'Cinder-cone formation differs from impact-crater formation.', 'The coarse comparison does not resolve lava-surface hazards.'], sourceIds: ['srtm', 'srtm-nasa', 'amboy'], terrainFile: 'data/amboy-terrain.json', color: '#ad9c83', image: 'assets/amboy.jpg' },
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
  return {min,max,relief:max-min,slopeMean:slopes.reduce((a,b)=>a+b,0)/slopes.length,slopeP90:slopes[Math.floor((slopes.length-1)*0.9)],slopeHistogram:histogram.map(count=>count/slopes.length),slopeBinEdges:SLOPE_BINS.slice(),slopeGrid,profile,profileRelative:profile.map(h=>h-min),validCount:heights.length,slopeSampleCount:slopes.length,gridSpacingMeters:{x:dx,z:dz},gradientBaselineMeters:{x:2*dx,z:2*dz},extentMeters:{x:widthMeters,z:depthMeters},source:data.source};
}

export function compareTerrains(target, earth, weights = {}) {
  if(target.comparisonEligible===false||earth.comparisonEligible===false)throw new Error('This terrain window is excluded from ranking because it includes coastal bathymetry.');
  const a=target.heights?analyzeTerrain(target):target,b=earth.heights?analyzeTerrain(earth):earth;
  if(a.slopeHistogram?.length!==b.slopeHistogram?.length)throw new Error('Matched slope histogram bins are required.');
  const distance=0.5*a.slopeHistogram.reduce((sum,p,index)=>sum+Math.abs(p-b.slopeHistogram[index]),0);
  const reliefDistance=Math.min(1,Math.abs(Math.log((a.relief+1)/(b.relief+1)))/Math.log(4));
  const sw=Number.isFinite(weights.slope)?Math.max(0,weights.slope):0.65,rw=Number.isFinite(weights.relief)?Math.max(0,weights.relief):0.35,total=sw+rw;
  if(total===0)throw new Error('At least one terrain comparison weight must be positive.');
  const score=100*(1-(sw*distance+rw*reliefDistance)/total);
  const activeMethod=`Index = 100 × [1 − (${(sw/total).toFixed(6)} × slope-distribution total-variation distance + ${(rw/total).toFixed(6)} × normalized log relief difference)]. All windows use 500 m sampling and 1,000 m gradient baselines.`;
  return {score:Math.round(score*10)/10,similarity:Math.round(score*10)/10,slopeDistance:distance,reliefDistance,components:[{id:'slope',name:'Slope distribution',score:100*(1-distance),weight:sw/total,target:a.slopeMean,earth:b.slopeMean,unit:'degrees'},{id:'relief',name:'Relative relief',score:100*(1-reliefDistance),weight:rw/total,target:a.relief,earth:b.relief,unit:'m'}],method:activeMethod,scope:'Terrain only',limitations:METHOD.limitations,unassessed:['Surface materials','Temperature','Water or ice','Biology','Accessibility','Landing or base safety'],targetStats:a,earthStats:b};
}
