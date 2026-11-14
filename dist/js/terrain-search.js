import {assessLandCoverage,DETAILED_MASK_SHA256} from './land-coverage.js';
import {isLand,landWindowCoverage} from './land-geometry.js';
export {isLand,landWindowCoverage} from './land-geometry.js';
/** Runtime Earth terrain search. Fetches public elevation data; never substitutes generated heights. */
import { SITES, analyzeTerrain, compareTerrains } from './science.js';

export const SEARCH_SOURCES = [
  {id:'terrarium',title:'Mapzen Terrain Tiles — Terrarium elevation',agency:'Mapzen / Tilezen / AWS; underlying source agencies',url:'https://registry.opendata.aws/terrain-tiles/',license:'Retain Mapzen / Tilezen and underlying provider credits; see the Tilezen Joerd attribution documentation.',note:'On-demand Earth terrain fetched from public mixed-source Terrarium PNG tiles in EPSG:3857. RGB channels encode elevations, not colors to infer from a map. Not pure NASA data; original source accuracy varies by region, and 500 m sampling does not imply new native detail.'},
  {id:'natural-earth',title:'Natural Earth 1:110m and 1:10m land polygons',agency:'Natural Earth',url:'https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/',license:'Public domain. Made with Natural Earth. Terms: https://www.naturalearthdata.com/about/terms-of-use/',note:'Coarse 1:110 million polygons screen centers and 25 window points. Bundled 1:10 million land polygons add a 65 × 65 point screen and coastline/window intersections before runtime ranking. These are map scales, not metre resolution; small water bodies and current shoreline conditions remain unresolved.'},
  {id:'open-meteo-geocoding',title:'Place search — Open-Meteo Geocoding API / GeoNames',agency:'Open-Meteo / GeoNames',url:'https://open-meteo.com/en/docs/geocoding-api',license:'Open-Meteo free API for non-commercial use; data CC BY 4.0; geographical data from GeoNames (CC BY 4.0). Commercial use requires reviewing the provider terms.',note:'Called only after a user submits a place-name search. Coordinates and globe selection work without geocoding. Search names are sent to the provider; returned places are geographic locations, not validated analogs.'},
];

const TILE_BASE='https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const DETAILED_MASK_URL=new URL('../data/land-mask-10m.geojson',import.meta.url).href;
const MASK_URL=new URL('../data/land-mask.geojson',import.meta.url).href;
const R=6371008.8,WEB_MERCATOR_RADIUS=6378137,DEG=Math.PI/180,SIZE=65,SPACING=500,EXTENT=32000;
const TILE_CACHE_LIMIT=48,MAX_FETCHES=4;
const tileCache=new Map();
let cachedMask=null,maskProvenance=null,cachedDetailed=null,detailedProvenance=null,activeFetches=0;
const fetchWaiters=[];
const wrapLon=lon=>((lon+180)%360+360)%360-180;
const abortError=()=>new DOMException('Terrain search cancelled.','AbortError');
function checkAbort(signal){if(signal?.aborted)throw signal.reason instanceof Error?signal.reason:abortError();}
function isAbort(error,signal){return signal?.aborted||error?.name==='AbortError';}
function emit(callback,event){if(callback)callback(event);}
function finiteNumber(value,label){if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be a finite number.`);return value;}
function validateCenter(lat,lon){finiteNumber(lat,'Latitude');finiteNumber(lon,'Longitude');if(lat < -84||lat > 84)throw new RangeError('Terrain search supports latitude from 84° S to 84° N.');if(lon < -180||lon > 180)throw new RangeError('Longitude must be between −180° and 180°.');return {lat:Object.is(lat,-0)?0:lat,lon:wrapLon(lon)};}
function linkedSignal(signal,timeout=25000){return AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(timeout)]);}

async function fetchSlot(signal,task){
  checkAbort(signal);
  if(activeFetches<MAX_FETCHES)activeFetches++;
  else await new Promise((resolve,reject)=>{
    const waiter={resolve,reject,signal,onAbort:null};
    waiter.onAbort=()=>{const i=fetchWaiters.indexOf(waiter);if(i>=0)fetchWaiters.splice(i,1);reject(abortError());};
    signal?.addEventListener('abort',waiter.onAbort,{once:true});fetchWaiters.push(waiter);
  });
  try{checkAbort(signal);return await task();}finally{
    activeFetches--;
    while(fetchWaiters.length){const waiter=fetchWaiters.shift();waiter.signal?.removeEventListener('abort',waiter.onAbort);if(waiter.signal?.aborted){waiter.reject(abortError());continue;}activeFetches++;waiter.resolve();break;}
  }
}

const CRC_TABLE=Uint32Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(bytes,start,end){let crc=0xffffffff;for(let i=start;i<end;i++)crc=CRC_TABLE[(crc^bytes[i])&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}

/** Decode non-interlaced 8-bit RGB/RGBA PNG without canvas or colour-profile conversion. */
export async function decodePNG(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  const signature=[137,80,78,71,13,10,26,10];
  if(bytes.length<33||signature.some((value,i)=>bytes[i]!==value))throw new Error('Invalid PNG signature.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),idat=[];
  let offset=8,width=0,height=0,channels=0,seenHeader=false,seenEnd=false;
  while(offset+12<=bytes.length){
    const length=view.getUint32(offset),type=String.fromCharCode(...bytes.subarray(offset+4,offset+8)),start=offset+8,end=start+length;
    if(length>16*1024*1024||end+4>bytes.length)throw new Error('Truncated or oversized PNG chunk.');
    if(crc32(bytes,offset+4,end)!==view.getUint32(end))throw new Error(`PNG ${type} checksum failed.`);
    if(!seenHeader&&type!=='IHDR')throw new Error('PNG header must be first.');
    if(type==='IHDR'){
      if(seenHeader||length!==13)throw new Error('Invalid PNG header.');
      seenHeader=true;width=view.getUint32(start);height=view.getUint32(start+4);
      const depth=bytes[start+8],colour=bytes[start+9];channels=colour===2?3:colour===6?4:0;
      if(!width||!height||width>1024||height>1024||depth!==8||!channels||bytes[start+10]!==0||bytes[start+11]!==0||bytes[start+12]!==0)throw new Error('PNG must be non-interlaced 8-bit RGB or RGBA, at most 1024×1024.');
    }else if(type==='IDAT')idat.push(bytes.subarray(start,end));
    else if(type==='IEND'){seenEnd=true;break;}
    else if(type[0]===type[0].toUpperCase())throw new Error(`Unsupported critical PNG chunk: ${type}.`);
    offset=end+4;
  }
  if(!seenEnd||!idat.length)throw new Error('PNG image data or end chunk is missing.');
  if(typeof DecompressionStream!=='function')throw new Error('This browser needs DecompressionStream support to decode elevation PNGs.');
  const stream=new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw=new Uint8Array(await new Response(stream).arrayBuffer()),stride=width*channels;
  if(raw.length!==(stride+1)*height)throw new Error('Unexpected decompressed PNG size.');
  const pixels=new Uint8Array(stride*height);
  for(let row=0;row<height;row++){
    const filter=raw[row*(stride+1)],line=row*stride,previous=line-stride;
    if(filter>4)throw new Error('Unsupported PNG filter.');
    for(let x=0;x<stride;x++){
      const value=raw[row*(stride+1)+1+x],a=x>=channels?pixels[line+x-channels]:0,b=row?pixels[previous+x]:0,c=row&&x>=channels?pixels[previous+x-channels]:0;
      pixels[line+x]=(value+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;
    }
  }
  return {width,height,channels,pixels};
}

/** Terrarium height in metres = R×256 + G + B/256 − 32768. */
export async function decodeTerrarium(input){
  const image=input?.pixels?input:await decodePNG(input),{width,height,channels,pixels}=image;
  if(![3,4].includes(channels)||pixels.length!==width*height*channels)throw new Error('Invalid decoded Terrarium image.');
  const heights=new Float64Array(width*height);
  for(let i=0;i<heights.length;i++){
    const p=i*channels;if(channels===4&&pixels[p+3]!==255)throw new Error('Terrarium tile contains transparent/no-data pixels.');
    heights[i]=pixels[p]*256+pixels[p+1]+pixels[p+2]/256-32768;
  }
  return {width,height,heights};
}

async function sha256(bytes){if(!globalThis.crypto?.subtle)throw new Error('Secure-context SHA-256 support is required. Open TerraMatch over HTTPS or localhost.');const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');}

async function getTile(z,x,y,signal){
  checkAbort(signal);const n=2**z;x=((x%n)+n)%n;y=Math.max(0,Math.min(n-1,y));const key=`${z}/${x}/${y}`;
  if(tileCache.has(key)){const value=tileCache.get(key);tileCache.delete(key);tileCache.set(key,value);return value;}
  // Cache only successfully decoded values. Each caller owns its fetch signal, never a shared in-flight promise.
  return fetchSlot(signal,async()=>{
    checkAbort(signal);if(tileCache.has(key))return tileCache.get(key);
    const url=`${TILE_BASE}/${key}.png`,response=await fetch(url,{signal:linkedSignal(signal),mode:'cors'});
    if(!response.ok)throw new Error(`Elevation tile request failed (${response.status}): ${key}`);
    const buffer=await response.arrayBuffer();checkAbort(signal);
    const [image,digest]=await Promise.all([decodeTerrarium(buffer),sha256(buffer)]);
    if(image.width!==256||image.height!==256)throw new Error('Expected a 256×256 Terrarium tile.');
    checkAbort(signal);const tile={...image,z,x,y,url,sha256:digest,retrievedAt:new Date().toISOString(),bytes:buffer.byteLength};
    tileCache.set(key,tile);while(tileCache.size>TILE_CACHE_LIMIT)tileCache.delete(tileCache.keys().next().value);return tile;
  });
}

export function clearSearchCaches(){tileCache.clear();cachedMask=null;maskProvenance=null;cachedDetailed=null;detailedProvenance=null;}

export async function loadLandMask({signal,landmask}={}){
  checkAbort(signal);if(landmask)return landmask;if(cachedMask)return cachedMask;
  const response=await fetch(MASK_URL,{signal:linkedSignal(signal)});if(!response.ok)throw new Error(`Land-mask data unavailable (${response.status}).`);
  const buffer=await response.arrayBuffer(),parsed=JSON.parse(new TextDecoder().decode(buffer));
  if(!['FeatureCollection','Feature','Polygon','MultiPolygon','GeometryCollection'].includes(parsed?.type))throw new Error('Invalid land-mask GeoJSON.');
  const digest=await sha256(buffer);checkAbort(signal);cachedMask=parsed;maskProvenance={url:MASK_URL,sha256:digest,retrievedAt:new Date().toISOString()};return parsed;
}

export async function loadDetailedLandMask({signal,detailedLandmask}={}){
  checkAbort(signal);if(detailedLandmask!==undefined)return detailedLandmask;if(cachedDetailed)return cachedDetailed;
  const response=await fetch(DETAILED_MASK_URL,{signal:linkedSignal(signal)});if(!response.ok)throw new Error('Detailed coastline data unavailable ('+response.status+').');
  const buffer=await response.arrayBuffer(),digest=await sha256(buffer);if(digest!==DETAILED_MASK_SHA256)throw new Error('Detailed coastline data failed its source hash check.');
  const parsed=JSON.parse(new TextDecoder().decode(buffer));if(parsed.type!=='FeatureCollection'||!parsed.features?.length)throw new Error('Invalid detailed coastline polygons.');
  checkAbort(signal);cachedDetailed=parsed;detailedProvenance={url:DETAILED_MASK_URL,sha256:digest,retrievedAt:new Date().toISOString(),scale:'1:10 million',credit:'Made with Natural Earth',license:'Public domain'};return parsed;
}
export async function screenEarthWindow(bounds,{signal,landmask,detailedLandmask}={}){
  const mask=await loadLandMask({signal,landmask}),coarse=landWindowCoverage(bounds,mask);let detailed=null,error=null;
  try{detailed=await loadDetailedLandMask({signal,detailedLandmask});}catch(e){if(isAbort(e,signal))throw e;error=e.message;}
  const source=detailed===cachedDetailed&&detailed?detailedProvenance:detailed?{provided:true,sha256:await sha256(new TextEncoder().encode(JSON.stringify(detailed))),note:'Caller-provided detailed polygons.'}:null;
  return {mask,coarse,assessment:assessLandCoverage(bounds,coarse,detailed,source,error)};
}
export async function recheckSearchWindow(record,options={}){
  const copy=structuredClone(record),{coarse,assessment}=await screenEarthWindow(copy.data.bounds,options),eligible=assessment.status==='screened-land';
  const prior=copy.data.source.landScreening;
  if(!copy.data.source.previousLandScreening&&prior)copy.data.source.previousLandScreening=prior;
  copy.data.source.landScreening=coarse;copy.data.source.coverageAssessment=assessment;copy.data.comparisonEligible=eligible;copy.site.comparisonEligible=eligible;copy.data.coverageRecheckRequired=false;
  return copy;
}

function windowBounds(lat,lon){const dlat=EXTENT/2/R/DEG,dlon=dlat/Math.cos(lat*DEG),west=lon-dlon,east=lon+dlon;return {north:lat+dlat,south:lat-dlat,west,east,crossesAntimeridian:west < -180||east>180};}
export function parseCoordinates(text){
  if(typeof text!=='string')return null;
  const value=text.trim(),number='([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))';
  const match=value.match(new RegExp(`^${number}\\s*°?\\s*([NS])?\\s*(?:,|;|\\s+)\\s*${number}\\s*°?\\s*([EW])?$`,'i'));
  if(!match){if(/^[+\-.\d\s,;°NSEW]+$/i.test(value)&&/\d/.test(value))throw new RangeError('Enter coordinates as latitude, longitude, for example 29.575, 35.419.');return null;}
  let lat=Number(match[1]),lon=Number(match[3]);const ns=match[2]?.toUpperCase(),ew=match[4]?.toUpperCase();
  if(ns){if(ns==='N'&&lat<0)throw new RangeError('Negative latitude conflicts with N.');lat=ns==='S'?-Math.abs(lat):Math.abs(lat);}
  if(ew){if(ew==='E'&&lon<0)throw new RangeError('Negative longitude conflicts with E.');lon=ew==='W'?-Math.abs(lon):Math.abs(lon);}
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat>90||lon < -180||lon>180)throw new RangeError('Latitude must be between −90° and 90°, longitude between −180° and 180°.');
  return {lat:Object.is(lat,-0)?0:lat,lon:wrapLon(lon)};
}

export async function findPlaces(query,{signal}={}){
  checkAbort(signal);const text=String(query??'').trim().slice(0,160);if(text.length<2)return [];
  const coordinates=parseCoordinates(text);if(coordinates)return [{...coordinates,name:`${coordinates.lat.toFixed(5)}, ${coordinates.lon.toFixed(5)}`,country:'Coordinates',source:'coordinates'}];
  const normalized=text.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const local=SITES.filter(site=>site.body==='earth'&&`${site.name} ${site.country}`.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(normalized)).map(site=>({name:site.name,country:site.country,lat:site.lat,lon:site.lon,source:'TerraMatch reference catalogue',siteId:site.id}));
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=5&language=en&format=json`;
  let remote=[];
  try{
    const response=await fetch(url,{signal:linkedSignal(signal),mode:'cors'});if(!response.ok)throw new Error(`Place search unavailable (${response.status}).`);
    const body=await response.json();if(body.error)throw new Error(body.reason||'Place search failed.');
    remote=(body.results??[]).filter(place=>Number.isFinite(place.latitude)&&Number.isFinite(place.longitude)&&Math.abs(place.latitude)<=84).map(place=>({name:place.name,country:place.country??'',admin1:place.admin1??'',lat:place.latitude,lon:wrapLon(place.longitude),source:'Open-Meteo / GeoNames',geocodingId:place.id}));
  }catch(error){if(isAbort(error,signal)||!local.length)throw error;}
  const seen=new Set();return [...local,...remote].filter(place=>{const key=`${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8);
}

function normalizeBounds(bounds,{allowWindowLatitude=false}={}){
  if(!bounds)throw new TypeError('Search bounds are required.');
  const north=finiteNumber(bounds.north,'North bound'),south=finiteNumber(bounds.south,'South bound');let west=finiteNumber(bounds.west,'West bound'),east=finiteNumber(bounds.east,'East bound');
  const limit=allowWindowLatitude?85:84;if(north<=south||north>limit||south < -limit)throw new RangeError(`Bounds must have north > south and stay within ±${limit}° latitude.`);
  while(east<=west)east+=360;if(east-west>360+1e-8)throw new RangeError('Longitude bounds cannot span more than 360°.');
  const span=east-west;west=wrapLon(west);east=west+span;return {north,south,west,east,crossesAntimeridian:east>180};
}

/** Deterministic, spatially distributed grid sampling; bounded scan, not an exhaustive global search. */
export function generateSearchCenters(bounds,{stepDegrees=2,maxCandidates=24}={},landmask){
  const b=normalizeBounds(bounds);finiteNumber(stepDegrees,'Grid step');finiteNumber(maxCandidates,'Candidate limit');if(stepDegrees<=0||stepDegrees>180)throw new RangeError('Grid step must be > 0 and at most 180 degrees.');if(maxCandidates<1||maxCandidates>48)throw new RangeError('Candidate limit must be between 1 and 48.');
  const rows=Math.max(1,Math.ceil((b.north-b.south)/stepDegrees)),cols=Math.max(1,Math.ceil((b.east-b.west)/stepDegrees)),gridCells=rows*cols,probeCount=Math.min(gridCells,40000),eligible=[],seen=new Set();
  if(!Number.isSafeInteger(gridCells))throw new RangeError('Grid step is too small for these search bounds.');
  for(let k=0;k<probeCount;k++){
    const index=Math.floor((k+0.5)*gridCells/probeCount),row=Math.floor(index/cols),col=index%cols,lat=b.south+(row+0.5)*(b.north-b.south)/rows,lon=wrapLon(b.west+(col+0.5)*(b.east-b.west)/cols),key=`${lat.toFixed(5)},${lon.toFixed(5)}`;
    if(!seen.has(key)&&(!landmask||isLand(lon,lat,landmask))){seen.add(key);eligible.push({lat,lon});}
  }
  const count=Math.min(Math.floor(maxCandidates),eligible.length),centers=[];
  for(let i=0;i<count;i++)centers.push(eligible[Math.floor((i+0.5)*eligible.length/count)]);
  centers.metadata={bounds:b,stepDegrees,actualLatitudeStep:(b.north-b.south)/rows,actualLongitudeStep:(b.east-b.west)/cols,gridCells,probedCells:probeCount,landCenters:eligible.length,selected:count,selection:'Spatially distributed subset of a latitude/longitude grid; center-land screening only. Not exhaustive.'};
  return centers;
}

function globalPixel(lat,lon,z){const scale=256*2**z,x=(lon+180)/360*scale,y=(1-Math.asinh(Math.tan(lat*DEG))/Math.PI)/2*scale;return {x:x-0.5,y:y-0.5};}
function tilePixel(x,y,z){const world=256*2**z;x=((x%world)+world)%world;y=Math.max(0,Math.min(world-1,y));return {key:`${z}/${Math.floor(x/256)}/${Math.floor(y/256)}`,x:x%256,y:y%256};}
function customId(lat,lon){const part=value=>value.toFixed(5).replace('-','m').replace('.','p');return `custom-${part(lat)}-${part(lon)}`;}

export async function loadEarthWindow({lat,lon,name,country='',origin='manual',signal,onProgress,landmask,detailedLandmask}={}){
  ({lat,lon}=validateCenter(lat,lon));checkAbort(signal);if(!['manual','automatic'].includes(origin))throw new RangeError('Search origin must be manual or automatic.');
  // Stable, metre-level coordinate identity independent of user-supplied place names.
  lat=Number(lat.toFixed(5));lon=wrapLon(Number(lon.toFixed(5)));const id=customId(lat,lon),bounds=windowBounds(lat,lon);
  emit(onProgress,{phase:'landmask',stage:'landmask',loaded:0,total:1,message:'Checking the 32 km window against coarse and detailed coastline polygons.'});
  const {mask,coarse:coverage,assessment}=await screenEarthWindow(bounds,{signal,landmask,detailedLandmask}),eligible=assessment.status==='screened-land';
  const zoom=Math.max(0,Math.min(14,Math.ceil(Math.log2(2*Math.PI*WEB_MERCATOR_RADIUS*Math.cos(lat*DEG)/(256*200)))));
  const pixels=[],keys=new Set();
  for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){
    const sampleLat=bounds.north+(bounds.south-bounds.north)*row/(SIZE-1),sampleLon=bounds.west+(bounds.east-bounds.west)*col/(SIZE-1),point=globalPixel(sampleLat,sampleLon,zoom);pixels.push(point);
    const x=Math.floor(point.x),y=Math.floor(point.y);for(const dx of [0,1])for(const dy of [0,1])keys.add(tilePixel(x+dx,y+dy,zoom).key);
  }
  let loaded=0;const tiles=new Map(),windowController=new AbortController(),windowSignal=signal?AbortSignal.any([signal,windowController.signal]):windowController.signal;
  emit(onProgress,{phase:'tiles',stage:'tiles',loaded,total:keys.size,message:`Loading ${keys.size} elevation tiles.`});
  try{await Promise.all([...keys].map(async key=>{const [z,x,y]=key.split('/').map(Number),tile=await getTile(z,x,y,windowSignal);tiles.set(key,tile);loaded++;emit(onProgress,{phase:'tiles',stage:'tiles',loaded,total:keys.size,message:`Elevation tiles ${loaded}/${keys.size}`});}));}
  catch(error){windowController.abort();throw error;}
  checkAbort(signal);const heights=[];
  const read=(x,y)=>{const p=tilePixel(x,y,zoom),tile=tiles.get(p.key);if(!tile)throw new Error('Missing elevation tile at window seam.');return tile.heights[p.y*256+p.x];};
  for(const point of pixels){const x=Math.floor(point.x),y=Math.floor(point.y),tx=point.x-x,ty=point.y-y;const h=(read(x,y)*(1-tx)+read(x+1,y)*tx)*(1-ty)+(read(x,y+1)*(1-tx)+read(x+1,y+1)*tx)*ty;heights.push(Math.round(h*100)/100);}
  const retrievedAt=new Date().toISOString(),label=(String(name??'').trim()||`Earth ${lat.toFixed(3)}°, ${lon.toFixed(3)}°`).replace(/\s+/g,' ').slice(0,100);
  const nativePixelSpacing=2*Math.PI*WEB_MERCATOR_RADIUS*Math.cos(lat*DEG)/(256*2**zoom);
  const limitation='Coarse elevation cannot resolve individual rocks or robot-scale hazards; terrain resemblance does not establish material, thermal, biological or operational equivalence.';
  const coastal=assessment.reason||'Coverage review required before terrain ranking.';
  const site={id,name:label,country:String(country).slice(0,100)||'Earth',body:'earth',lat,lon,category:origin==='automatic'?'Automatically sampled terrain window':'Manually selected terrain window',description:`A newly retrieved 32 km Earth elevation window centered at ${lat.toFixed(5)}°, ${lon.toFixed(5)}°. ${eligible?'Passed the coarse and detailed coastline screens; small water bodies and current field conditions remain unverified.':coastal}`,origin,comparisonEligible:eligible,sourceIds:['terrarium','natural-earth'],useCases:['Terrain reconnaissance','Slope and relief comparison','Field-training candidate assessment'],limitations:[limitation,...(!eligible?[coastal]:[]),'Land access, permits, environmental protection and field safety have not been assessed.'],terrainFile:null,dataFile:`runtime:${id}`,color:'#dfba85',image:null};
  const source={id:'terrarium',title:'Mapzen / Tilezen Terrarium mixed-source elevation tiles',url:'https://registry.opendata.aws/terrain-tiles/',formatUrl:'https://github.com/tilezen/joerd/blob/master/docs/formats.md',attributionUrl:'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',files:[...tiles.values()].map(tile=>({url:tile.url,sha256:tile.sha256,bytes:tile.bytes,retrievedAt:tile.retrievedAt,z:tile.z,x:tile.x,y:tile.y})),zoom,nativePixelSpacingMetersAtCenter:nativePixelSpacing,nativeResolutionMetersApprox:nativePixelSpacing,datum:'Source-dependent mixed DEM heights in metres; Web Mercator tile positioning (EPSG:3857). Consult original datasets for vertical datum and accuracy.',sampling:'Direct RGB Terrarium decode without colour conversion; pixel-center-correct bilinear samples across tile seams into a 500 m grid.',landScreening:coverage,coverageAssessment:assessment,landMask:mask===cachedMask?maskProvenance:{provided:true,note:'Caller-provided GeoJSON land mask.'},caveat:'Mixed elevation sources may include SRTM, USGS 3DEP/GMTED2010, Copernicus EU-DEM and NOAA bathymetry. Tile pixel spacing is not guaranteed source accuracy or effective resolution. Negative elevations are retained and are not used as an ocean classifier.'};
  const data={schemaVersion:1,siteId:id,name:label,body:'earth',center:{lat,lon},comparisonEligible:site.comparisonEligible,size:SIZE,widthMeters:EXTENT,depthMeters:EXTENT,gridSpacingMeters:SPACING,orientation:'Rows decrease latitude; columns increase continuous/unwrapped longitude.',units:'meters',origin,retrievedAt,bounds,projection:{type:'local-equirectangular',radiusMeters:R,centerLat:lat,centerLon:lon,wrapLongitude:true},heights,source};
  const stats=analyzeTerrain(data);data.summary={min:stats.min,max:stats.max,relief:stats.relief,slopeMean:stats.slopeMean,slopeP90:stats.slopeP90,slopeHistogram:stats.slopeHistogram,validCount:stats.validCount};
  emit(onProgress,{phase:'complete',stage:'complete',loaded:keys.size,total:keys.size,message:eligible?'Terrain window loaded and analyzed.':'Terrain loaded; coverage review is required before ranking.'});
  return {site,data,stats};
}

export async function scanEarthRegion({bounds,stepDegrees=2,maxCandidates=24,targetTerrain,weights,signal,onProgress,onResult,landmask,detailedLandmask}={}){
  if(!targetTerrain?.heights)throw new TypeError('A loaded planetary target terrain is required for automatic comparison.');
  const b=normalizeBounds(bounds),results=[],excluded=[],coverage={bounds:b,attempted:0,planned:0,completed:0,failed:0,excluded:0,stepDegrees,cancelled:false,failures:[],method:'Bounded grid sampling of new Earth coordinates; not an exhaustive global search.'};
  try{
    checkAbort(signal);emit(onProgress,{phase:'landmask',stage:'landmask',...coverage,message:'Preparing coarse land screening.'});
    const mask=await loadLandMask({signal,landmask}),centers=generateSearchCenters(b,{stepDegrees,maxCandidates},mask);coverage.planned=centers.length;coverage.sampling=centers.metadata;
    let detailed=null;try{detailed=await loadDetailedLandMask({signal,detailedLandmask});}catch(e){if(isAbort(e,signal))throw e;}

    for(const center of centers){
      checkAbort(signal);coverage.attempted++;emit(onProgress,{phase:'scan',stage:'scan',...coverage,current:center,message:`Analyzing terrain window ${coverage.attempted}/${coverage.planned}.`});
      try{
        const item=await loadEarthWindow({...center,name:`Earth ${center.lat.toFixed(3)}°, ${center.lon.toFixed(3)}°`,origin:'automatic',signal,landmask:mask,detailedLandmask:detailed,onProgress:tileProgress=>emit(onProgress,{phase:'scan',stage:'scan',...coverage,current:center,tileProgress,message:tileProgress.message})});
        coverage.completed++;
        if(!item.site.comparisonEligible){coverage.excluded++;const review={...item,reason:item.data.source.coverageAssessment.reason};excluded.push(review);emit(onResult,review);}
        else{const result={...item,comparison:compareTerrains(targetTerrain,item.data,weights)};results.push(result);emit(onResult,result);}
      }catch(error){if(isAbort(error,signal))throw error;coverage.failed++;coverage.failures.push({...center,message:error.message});}
    }
  }catch(error){if(isAbort(error,signal))coverage.cancelled=true;else throw error;}
  results.sort((a,b)=>b.comparison.score-a.comparison.score||a.site.id.localeCompare(b.site.id));
  emit(onProgress,{phase:coverage.cancelled?'cancelled':'complete',stage:coverage.cancelled?'cancelled':'complete',...coverage,message:coverage.cancelled?'Search cancelled; completed results are retained.':`${results.length} eligible windows compared; ${coverage.excluded} excluded; ${coverage.failed} failed.`});
  return {results,excluded,coverage};
}
