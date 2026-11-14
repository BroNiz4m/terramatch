/** Bundled, source-derived planetary SURFACE thermal context. Not an air-temperature model. */
export const PLANETARY_THERMAL_SOURCES = [
  {id:'diviner-thermal',title:'LRO Diviner South Polar Resource Product: temp_max',agency:'NASA / UCLA / PDS Geosciences',url:'https://pds-geosciences.wustl.edu/missions/lro/diviner.htm',license:'NASA PDS archive; cite the Diviner product and Paige et al. 2010.',note:'Annual maximum temperature calculated at the surface from thermal-model fits to Diviner observations. temp_avg is a modeled temperature at 2 cm depth and is not used.'},
  {id:'meda-thermal',title:'Mars 2020 MEDA TIRS calibrated ground brightness temperature',agency:'NASA / CAB / PDS Atmospheres',url:'https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html',license:'NASA PDS archive; MEDA DOI 10.17189/1522849.',note:'Historical calibrated P04 rover-local thermal-infrared surface observations. Limited sol/time sampling and incomplete advisory quality flags apply. Not air temperature or a crater-wide thermal raster.'},
];
const cache=new Map();
const wrapLon=value=>((value+180)%360+360)%360-180;
export function validatePlanetaryThermal(record){
  if(!record||typeof record.available!=='boolean')throw new Error('Invalid planetary thermal availability record.');
  if(!record.available)return record;
  if(record.unit!=='K'||record.quantity!=='surface-temperature'||!record.source?.url||record.comparability?.scoreEligible!==false)throw new Error('Planetary thermal provenance or quantity is invalid.');
  const summary=record.summary;if(!summary||![summary.minK,summary.maxK,summary.meanK].every(value=>Number.isFinite(value)&&value>0)||summary.minK>summary.meanK||summary.meanK>summary.maxK||!Number.isInteger(summary.validCount)||summary.validCount<1)throw new Error('Invalid planetary thermal summary.');
  if(record.raster){const r=record.raster;if(!Number.isInteger(r.size)||r.size<2||r.size>513||r.valuesK?.length!==r.size*r.size||!r.valuesK.every(value=>Number.isFinite(value)&&value>0))throw new Error('Incomplete planetary thermal raster.');}
  else if(!record.series?.length||!record.series.every(item=>item.valueK===null||(Number.isFinite(item.valueK)&&item.valueK>0))||!record.series.some(item=>Number.isFinite(item.valueK)&&item.valueK>0))throw new Error('Incomplete planetary thermal time series.');
  return record;
}
export async function loadPlanetaryThermal(site,{signal}={}){
  const id=typeof site==='string'?site:site?.id;
  if(!['shackleton','jezero'].includes(id))return {available:false,status:'unavailable',siteId:id??null,reason:'No source-derived planetary thermal product is bundled for this target. Temperature is unavailable here; Jezero rover observations and the Shackleton raster are not reused.'};
  if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
  if(cache.has(id))return cache.get(id);
  const url=new URL(`../data/${id}-thermal.json`,import.meta.url),response=await fetch(url,{signal});
  if(!response.ok)throw new Error(`Planetary thermal record unavailable (${response.status}).`);
  const record=validatePlanetaryThermal(await response.json());if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');cache.set(id,record);return record;
}
/** Nearest sampled facet. Rover point-series deliberately return null: they are not a spatial map. */
export function samplePlanetaryThermal(record,lat,lon){
  if(!record?.available||!record.raster||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  const r=record.raster,p=r.projection;let u,v;
  if(p?.type==='south-polar-stereographic'){
    const rho=2*p.radiusMeters*Math.tan((Math.PI/2+lat*Math.PI/180)/2),x=rho*Math.sin(lon*Math.PI/180),y=rho*Math.cos(lon*Math.PI/180);
    u=(x-p.xWest)/(p.xEast-p.xWest);v=(p.yNorth-y)/(p.yNorth-p.ySouth);
  }else{
    const b=r.bounds;let unwrapped=wrapLon(lon);while(unwrapped<b.west)unwrapped+=360;u=(unwrapped-b.west)/(b.east-b.west);v=(b.north-lat)/(b.north-b.south);
  }
  if(u < -1e-8||u>1+1e-8||v < -1e-8||v>1+1e-8)return null;
  const col=Math.round(Math.max(0,Math.min(1,u))*(r.size-1)),row=Math.round(Math.max(0,Math.min(1,v))*(r.size-1)),index=row*r.size+col,valueK=r.valuesK[index];
  return {available:true,valueK,valueC:valueK-273.15,method:'Nearest grid sample of an actual Diviner thermal-model facet; annual surface maximum.',statistic:record.statistic,sourceDistanceMeters:r.sourceDistancesMeters?.[index]??null,sourceRecord:r.sourceRecords?.[index]??null,row,col};
}

export function planetaryThermalContext(record){
  if(!record?.available)return record?.reason??'Planetary thermal context unavailable.';
  return `${record.source.title}. ${record.temporal.label}. ${record.comparability.reason}`;
}
