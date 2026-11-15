import {analyzeTerrain,compareTerrains,resampleTerrain} from './science.js';
import {loadEarthWindow,loadLandMask,loadDetailedLandMask,generateSearchCenters} from './terrain-search.js';
import {comparisonStatus} from './comparison-status.js';

const ROOT=new URL('../data/search-atlas/',import.meta.url),DEG=Math.PI/180;
const manifestCache={value:null},tileCache=new Map(),indexCache=new Map();
const abort=signal=>{if(signal?.aborted)throw signal.reason||new DOMException('Search cancelled.','AbortError');};
const wrap=lon=>((lon+180)%360+360)%360-180;
export const PAIR_METHOD={extentMeters:32000,gridSpacingMeters:2000,gradientBaselineMeters:4000,scope:'Regional terrain only',note:'2 km output spacing, 4 km gradient baselines. Source accuracy varies; not rover-scale terrain or a probability of suitability.'};
export const PAIR_SOURCES=[{id:'planetary-search-atlas',title:'Global NASA MOLA / LOLA numeric search atlas',agency:'NASA / PDS; lossless browser tiles prepared by TerraMatch',url:'https://pds-geosciences.wustl.edu/',license:'Cite MOLA and LOLA science teams and original archive products.',note:'MOLA 32 ppd and LOLA 16 ppd numeric elevations are repackaged without changing DN values. Search index: 6,000 centers per body, 3° steps, 73.5°S–73.5°N. Arbitrary windows supported within 75°S–75°N. Comparisons use 32 km extents, 2 km spacing and 4 km gradients. Coordinates indexed are a bounded sample, not every possible location.'}];
async function checkedFile(file,expected,{signal,fetchImpl=fetch}={}){
 abort(signal);const response=await fetchImpl(new URL(file,ROOT),{signal});if(!response.ok)throw Error('Planetary source tile unavailable ('+response.status+').');
 const bytes=new Uint8Array(await response.arrayBuffer());const digest=await crypto.subtle.digest('SHA-256',bytes);const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hex!==expected)throw Error('Planetary source integrity check failed. No replacement terrain was generated.');
 return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
export async function loadSearchAtlas({signal,fetchImpl=fetch}={}){
 if(manifestCache.value&&!fetchImpl.testOnly)return manifestCache.value;
 const response=await fetchImpl(new URL('manifest.json',ROOT),{signal});if(!response.ok)throw Error('The planetary search atlas is unavailable.');const value=await response.json();
 if(value.version!=='planetary-search-atlas-v1'||!value.bodies?.mars||!value.bodies?.moon||value.method?.gridSpacingMeters!==2000)throw Error('Unsupported planetary search atlas.');
 for(const [body,ppd]of [['mars',32],['moon',16]]){const p=value.bodies[body];if(p.body!==body||p.pixelsPerDegree!==ppd||p.width!==ppd*360||p.height!==ppd*180||p.tileSize!==ppd*20||p.scale!==(body==='moon'?.5:1)||!p.source?.sha256||p.index?.count!==6000)throw Error('Invalid planetary source registration.');}
 manifestCache.value=value;return value;
}
export function decodeAtlasTile(bytes,size){
 if(bytes.byteLength!==size*size*2)throw Error('Incomplete planetary tile.');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),values=new Int16Array(size*size);
 for(let y=0;y<size;y++){let previous=0;for(let x=0;x<size;x++){const i=y*size+x;previous=((previous+view.getInt16(i*2,true)+32768)&65535)-32768;values[i]=previous;}}
 return values;
}
async function getTile(p,tx,ty,options){
 const key=p.body+'/'+ty+'-'+tx;if(tileCache.has(key))return tileCache.get(key);const meta=p.tiles[ty+'-'+tx];if(!meta)throw Error('Source window extends outside the numeric atlas.');
 const bytes=await checkedFile(meta.file,meta.sha256,options),values=decodeAtlasTile(bytes,p.tileSize);
 tileCache.set(key,{values,meta});if(tileCache.size>32)tileCache.delete(tileCache.keys().next().value);return {values,meta};
}
export async function loadPlanetaryIndex(body,options={}){
 const atlas=options.atlas||await loadSearchAtlas(options),p=atlas.bodies[body];if(!p)throw Error('Choose Moon or Mars.');
 if(indexCache.has(body))return indexCache.get(body);const bytes=await checkedFile(p.index.file,p.index.sha256,options),index=JSON.parse(new TextDecoder().decode(bytes));
 if(index.length!==6000||!index.every(v=>Number.isFinite(v.lat)&&Number.isFinite(v.lon)&&Number.isFinite(v.relief)&&v.relief>=0&&Number.isFinite(v.slopeMean)&&Array.isArray(v.slopeHistogram)&&v.slopeHistogram.length===6&&v.slopeHistogram.every(n=>Number.isFinite(n)&&n>=0)&&Math.abs(v.slopeHistogram.reduce((a,b)=>a+b,0)-1)<1e-8))throw Error('Invalid numeric search index.');
 indexCache.set(body,index);return index;
}
export async function loadPlanetaryWindow({body,lat,lon,signal,atlas,fetchImpl=fetch}={}){
 if(!['moon','mars'].includes(body)||!Number.isFinite(lat)||Math.abs(lat)>75||!Number.isFinite(lon)||Math.abs(lon)>180)throw Error('Planetary coordinate search supports 75°S–75°N and 180°W–180°E.');
 atlas=atlas||await loadSearchAtlas({signal,fetchImpl});const p=atlas.bodies[body];lon=wrap(lon);
 const half=16000/p.radiusMeters/DEG,dlon=half/Math.cos(lat*DEG),bounds={north:lat+half,south:lat-half,west:lon-dlon,east:lon+dlon},points=[],needed=new Map();
 for(let row=0;row<17;row++)for(let col=0;col<17;col++){
  const x=((bounds.west+col/16*dlon*2+360)%360)*p.pixelsPerDegree-.5,y=(90-bounds.north+row/16*half*2)*p.pixelsPerDegree-.5,a=Math.floor(x),b=Math.floor(y);
  const cells=[[a,b],[a+1,b],[a,b+1],[a+1,b+1]].map(([xx,yy])=>{xx=((xx%p.width)+p.width)%p.width;if(yy<0||yy>=p.height)throw Error('Missing polar source support.');const tx=Math.floor(xx/p.tileSize),ty=Math.floor(yy/p.tileSize),key=ty+'-'+tx;needed.set(key,{tx,ty});return{key,x:xx%p.tileSize,y:yy%p.tileSize};});points.push({u:x-a,v:y-b,cells});
 }
 const loaded=new Map();for(const[key,{tx,ty}]of needed){abort(signal);loaded.set(key,await getTile(p,tx,ty,{signal,fetchImpl}));}
 const heights=points.map(({u,v,cells})=>{const z=cells.map(c=>{const dn=loaded.get(c.key).values[c.y*p.tileSize+c.x];if(dn===-32768||dn===32767)throw Error('Source no-data sentinel; candidate withheld.');return dn*p.scale;});return(z[0]*(1-u)+z[1]*u)*(1-v)+(z[2]*(1-u)+z[3]*u)*v;});
 const coordinate=Math.abs(lat).toFixed(3)+'°'+(lat<0?'S':'N')+', '+Math.abs(lon).toFixed(3)+'°'+(lon<0?'W':'E'),label=(body==='moon'?'Lunar':'Martian')+' area · '+coordinate,id='survey-'+body+'-'+lat.toFixed(5).replace('-','m')+'-'+lon.toFixed(5).replace('-','m');
 const site={id,name:label,country:body==='moon'?'Moon':'Mars',body,lat,lon,origin:'automatic',category:'Coordinate-derived regional terrain',sourceIds:[p.id,'planetary-search-atlas'],description:'32 × 32 km regional terrain from the original '+p.product+' numeric DEM. Coordinates were selected by the search, not from the reference-site dropdown.',useCases:['Regional terrain reconnaissance and observation planning'],limitations:[PAIR_METHOD.note,p.caveat,'Planetary atmospheric conditions, gravity, illumination and materials are not matched. Prior analog use is unverified.'],color:body==='moon'?'#b6beca':'#e9874a'};
 const data={schemaVersion:1,siteId:id,name:label,body,center:{lat,lon},size:17,widthMeters:32000,depthMeters:32000,gridSpacingMeters:2000,units:'meters',origin:'automatic',heights,bounds,projection:{type:'local-equirectangular',radiusMeters:p.radiusMeters,centerLat:lat,centerLon:lon,wrapLongitude:true},source:{id:p.id,title:p.product+' · '+p.pixelsPerDegree+' pixels per degree',url:p.source.url,datum:p.datum,files:[...loaded.values()].map(t=>({url:new URL(t.meta.file,ROOT).href,sha256:t.meta.sha256,bytes:t.meta.bytes})),originalSource:p.source,nativeResolutionMetersApprox:p.radiusMeters*DEG/p.pixelsPerDegree,sampling:'Pixel-center bilinear interpolation from original numeric source cells into a 17 × 17 local 2 km grid. No generated heights.',observationSupport:{status:'not-verified',note:p.caveat},caveat:p.caveat}};
 return {site,data,stats:analyzeTerrain(data)};
}
export function conditionMatches(stats,condition){if(condition==='gentle')return stats.slopeMean<=2;if(condition==='rugged')return stats.relief>=500&&stats.slopeMean>=1;return true;}
export function shortlistPairs(earthRecords,indexes,{weights={slope:.65,relief:.35},condition='balanced',limit=12}={}){
 const candidates=[];for(const earth of earthRecords){if(!comparisonStatus(earth.site,earth.data).scoreEligible)continue;const grid=resampleTerrain(earth.data,2000),stats=analyzeTerrain(grid);if(!conditionMatches(stats,condition))continue;
  for(const[body,index]of Object.entries(indexes)){const ranked=index.filter(p=>conditionMatches(p,condition)).map(p=>({body,lat:p.lat,lon:p.lon,earth,comparison:compareTerrains({...p,gridSpacingMeters:{x:2000,z:2000},gradientBaselineMeters:{x:4000,z:4000},extentMeters:{x:32000,z:32000}},stats,weights)})).sort((a,b)=>b.comparison.score-a.comparison.score||a.lat-b.lat||a.lon-b.lon);candidates.push(...ranked.slice(0,2));}
 }
 candidates.sort((a,b)=>b.comparison.score-a.comparison.score||a.body.localeCompare(b.body)||a.lat-b.lat||a.lon-b.lon);const result=[],used=new Set(),earthCount=new Map();
 // Reserve results for both bodies when requested; do not let one body hide the other.
 for(const body of Object.keys(indexes))for(const p of candidates.filter(p=>p.body===body)){const key=p.earth.site.id+'/'+body+'/'+p.lat+'/'+p.lon;if(used.has(key)||(earthCount.get(p.earth.site.id)||0)>=4)continue;used.add(key);earthCount.set(p.earth.site.id,(earthCount.get(p.earth.site.id)||0)+1);result.push(p);if(result.filter(r=>r.body===body).length>=Math.ceil(limit/Object.keys(indexes).length))break;}
 return result.sort((a,b)=>b.comparison.score-a.comparison.score).slice(0,limit);
}
export async function searchLocationPairs({bodies=['moon','mars'],condition='balanced',earthBounds={west:-180,east:180,south:-70,north:70},budget=12,weights={slope:.65,relief:.35},signal,onProgress,onEarth,onPair,dependencies={}}={}){
 if(!bodies.length||bodies.some(b=>!['moon','mars'].includes(b))||!['balanced','gentle','rugged'].includes(condition)||![6,12,24].includes(Number(budget)))throw Error('Invalid search settings.');
 const deps={loadSearchAtlas,loadPlanetaryIndex,loadPlanetaryWindow,loadLandMask,loadDetailedLandMask,loadEarthWindow,generateSearchCenters,...dependencies},earthRecords=[],pairs=[],coverage={type:'earth-planet-pair-search',startedAt:new Date().toISOString(),bodies:[...new Set(bodies)],condition,weights:{...weights},earthBounds,earthPlanned:0,earthCompleted:0,earthExcluded:0,earthFailed:0,planetaryIndexed:{},pairFailures:[],earthFailures:[],earthCenters:[],cancelled:false,exhaustive:false,method:PAIR_METHOD};
 const report=(message,fraction)=>onProgress?.({message,fraction,...coverage});
 try{
  abort(signal);report('Loading NASA planetary search indexes…',.02);const atlas=await deps.loadSearchAtlas({signal}),indexes={};for(const body of coverage.bodies){indexes[body]=await deps.loadPlanetaryIndex(body,{signal,atlas});coverage.planetaryIndexed[body]=indexes[body].length;}
  const landmask=await deps.loadLandMask({signal}),detailedLandmask=await deps.loadDetailedLandMask({signal});const centers=deps.generateSearchCenters(earthBounds,{stepDegrees:5,maxCandidates:Number(budget)},landmask);coverage.earthPlanned=centers.length;coverage.earthSampling=centers.metadata||null;
  for(const center of centers){abort(signal);report('Reading Earth terrain '+(coverage.earthCompleted+coverage.earthFailed+1)+' / '+centers.length+'…',.1+.55*(coverage.earthCompleted+coverage.earthFailed)/Math.max(1,centers.length));
   try{const record=await deps.loadEarthWindow({...center,origin:'automatic',signal,landmask,detailedLandmask});abort(signal);coverage.earthCompleted++;coverage.earthCenters.push({lat:record.site.lat,lon:record.site.lon,id:record.site.id,eligible:comparisonStatus(record.site,record.data).scoreEligible});if(!comparisonStatus(record.site,record.data).scoreEligible)coverage.earthExcluded++;else earthRecords.push(record);onEarth?.(record);}catch(error){abort(signal);coverage.earthFailed++;coverage.earthFailures.push({...center,message:error.message});}
  }
  const shortlist=shortlistPairs(earthRecords,indexes,{weights,condition});coverage.shortlisted=shortlist.length;
  for(const [i,item]of shortlist.entries()){abort(signal);report('Checking '+item.body+' terrain and pair '+(i+1)+' / '+shortlist.length+'…',.65+.34*i/Math.max(1,shortlist.length));try{
   const planetary=await deps.loadPlanetaryWindow({body:item.body,lat:item.lat,lon:item.lon,signal,atlas});abort(signal);const comparison=compareTerrains(planetary.data,item.earth.data,weights);const pair={id:planetary.site.id+'--'+item.earth.site.id,target:planetary,earth:item.earth,comparison,weights:{...weights},method:PAIR_METHOD,novelty:'unverified',origin:'automatic-pair-search'};pairs.push(pair);pairs.sort((a,b)=>b.comparison.score-a.comparison.score);onPair?.(pair);
  }catch(error){abort(signal);coverage.pairFailures.push({body:item.body,lat:item.lat,lon:item.lon,message:error.message});}}
 }catch(error){if(signal?.aborted||error.name==='AbortError')coverage.cancelled=true;else{error.partial={pairs,earthRecords,coverage};throw error;}}
 coverage.finishedAt=new Date().toISOString();coverage.pairCount=pairs.length;report(coverage.cancelled?'Search cancelled. Completed pairs are kept.':pairs.length?'Search complete. Inspect the evidence for each candidate pair.':'No comparable pair found in this sample. Try another condition or Earth region.',1);return{pairs,earthRecords,coverage};
}
