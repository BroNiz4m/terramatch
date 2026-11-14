/** Fetch small, geolocated windows from public DEM archives. No generated scientific heights. */
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SITES, analyzeTerrain } from '../dist/js/science.js';

const OUT = fileURLToPath(new URL('../dist/data/', import.meta.url));
const SIZE = 65, SPACING = 500, EXTENT = (SIZE - 1) * SPACING;
const date = new Date().toISOString();
const R_EARTH = 6371008.8, R_MARS = 3396000, R_MOON = 1737400;
const DEG = Math.PI / 180;
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const rounded = value => Math.round(value * 100) / 100;
const tileCache = new Map();
const fetchedSources = [];

async function get(url, headers = {}) {
  const response = await fetch(url, {headers, signal: AbortSignal.timeout(45000)});
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

async function range(url, start, end) {
  const response = await get(url, {Range: `bytes=${start}-${end}`});
  if (response.status !== 206) throw new Error(`Archive did not honor byte range: ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== end - start + 1) throw new Error(`Short range read: ${url}`);
  fetchedSources.push({url, byteRange:[start,end], bytes:buffer.length, sha256:hash(buffer), retrievedAt:date});
  return buffer;
}

function bilinear(read, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x-x0, ty = y-y0;
  return read(x0,y0)*(1-tx)*(1-ty)+read(x0+1,y0)*tx*(1-ty)+read(x0,y0+1)*(1-tx)*ty+read(x0+1,y0+1)*tx*ty;
}

async function loadHgt(latFloor, lonFloor) {
  const id = `${latFloor>=0?'N':'S'}${String(Math.abs(latFloor)).padStart(2,'0')}${lonFloor>=0?'E':'W'}${String(Math.abs(lonFloor)).padStart(3,'0')}`;
  if(!tileCache.has(id))tileCache.set(id,(async()=>{
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/skadi/${id.slice(0,3)}/${id}.hgt.gz`;
    const compressed = Buffer.from(await (await get(url)).arrayBuffer()), buffer=gunzipSync(compressed), size=Math.sqrt(buffer.length/2);
    if(!Number.isInteger(size))throw new Error(`Unexpected HGT dimensions ${id}`);
    const item={id,url,size,buffer,sha256:hash(compressed),nativeSpacingArcSeconds:3600/(size-1)};
    fetchedSources.push({url,bytes:compressed.length,sha256:item.sha256,retrievedAt:date});
    console.log(`HGT ${id}: ${size}×${size}, ${compressed.length} compressed bytes`);
    return item;
  })());
  return tileCache.get(id);
}

function gridBounds(lat,lon,radius) {
  const dlat=EXTENT/2/radius/DEG,dlon=dlat/Math.cos(lat*DEG);
  return {north:lat+dlat,south:lat-dlat,east:lon+dlon,west:lon-dlon};
}

async function earth(site) {
  const bounds=gridBounds(site.lat,site.lon,R_EARTH),tiles=new Map();
  const requests=[];
  for(let lat=Math.floor(bounds.south);lat<=Math.floor(bounds.north);lat++)for(let lon=Math.floor(bounds.west);lon<=Math.floor(bounds.east);lon++)requests.push(loadHgt(lat,lon).then(tile=>tiles.set(`${lat},${lon}`,tile)));
  await Promise.all(requests);
  const heights=[];
  for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){
    const lat=bounds.north+(bounds.south-bounds.north)*row/(SIZE-1),lon=bounds.west+(bounds.east-bounds.west)*col/(SIZE-1),latFloor=Math.floor(lat),lonFloor=Math.floor(lon),tile=tiles.get(`${latFloor},${lonFloor}`);
    const x=(lon-lonFloor)*(tile.size-1),y=(latFloor+1-lat)*(tile.size-1);
    const h=bilinear((a,b)=>{
      a=Math.min(tile.size-1,Math.max(0,a));b=Math.min(tile.size-1,Math.max(0,b));
      const v=tile.buffer.readInt16BE((b*tile.size+a)*2);
      if(v===-32768)throw new Error(`No-data encountered in ${site.id}; no synthetic filling is allowed.`);
      return v;
    },x,y);
    heights.push(rounded(h));
  }
  return {bounds,heights,projection:{type:'local-equirectangular',radiusMeters:R_EARTH,centerLat:site.lat,centerLon:site.lon},source:{id:'srtm',title:'Skadi terrain tile (SRTM and other elevation sources)',url:'https://registry.opendata.aws/terrain-tiles/',files:[...tiles.values()].map(t=>({url:t.url,sha256:t.sha256,nativeSpacingArcSeconds:t.nativeSpacingArcSeconds})),nativeResolutionMetersApprox:30,datum:'Earth elevation in metres from the Skadi HGT derivative; consult underlying source documentation',sampling:'Bilinear sample of native HGT grid at 500 m projected spacing; no invented height detail.',caveat:site.id==='amboy'?'US Skadi tiles can use USGS 3DEP/NED rather than SRTM; this is not labelled as pure NASA data.':site.id==='lanzarote'?'This island window intersects coastal/ocean terrain; the terrain score is sensitive to the window and is not an inland-only assessment.':'Distribution tiles can combine underlying sources; the source is identified as Skadi, not an unmodified Earthdata product.'}};
}

async function mars(site) {
  const url='https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg128/megt44n000hb.img',labelUrl=url.replace('.img','.lbl');
  const label=await(await get(labelUrl)).text();
  if(!label.includes('LINE_SAMPLES                 = 11520')||!label.includes('SAMPLE_TYPE                  = MSB_INTEGER'))throw new Error('Unexpected MOLA label schema');
  const bounds=gridBounds(site.lat,site.lon,R_MARS),ppd=128,cols=11520;
  const rowAt=lat=>(44-lat)*ppd-0.5,colAt=lon=>lon*ppd-0.5;
  const rowMin=Math.floor(rowAt(bounds.north)),rowMax=Math.ceil(rowAt(bounds.south));
  const start=rowMin*cols*2,end=(rowMax+1)*cols*2-1,buffer=await range(url,start,end),heights=[];
  for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){
    const lat=bounds.north+(bounds.south-bounds.north)*row/(SIZE-1),lon=bounds.west+(bounds.east-bounds.west)*col/(SIZE-1);
    heights.push(rounded(bilinear((x,y)=>buffer.readInt16BE(((y-rowMin)*cols+x)*2),colAt(lon),rowAt(lat))));
  }
  return {bounds,heights,projection:{type:'local-equirectangular',radiusMeters:R_MARS,centerLat:site.lat,centerLon:site.lon},source:{id:'mola',title:'MGS MOLA MEGDR MEGT44N000HB, 128 pixels per degree',url,labelUrl,sha256ByteRange:hash(buffer),byteRange:[start,end],nativeResolutionMetersApprox:463,datum:'Topography relative to Mars areoid (GMM3 model), IAU2000 planetocentric coordinates',sampling:'Bilinear sample of 1/128 degree MOLA grid at 500 m local spacing.',caveat:'Cells without altimeter returns are interpolated in the source. Some source-track gaps can reach 12 km. This grid is not a rover-scale hazard map.'}};
}

async function moon(site) {
  const url='https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img',labelUrl=url.replace('.img','.lbl');
  const label=await(await get(labelUrl)).text();
  if(!label.includes('LSB_INTEGER')||!label.includes('SCALING_FACTOR        = 0.5'))throw new Error('Unexpected LOLA label schema');
  const cols=3812,scale=240,offset=1905.5,rho=2*R_MOON*Math.tan((Math.PI/2+site.lat*DEG)/2),centerX=rho*Math.sin(site.lon*DEG),centerY=rho*Math.cos(site.lon*DEG);
  const xWest=centerX-EXTENT/2,xEast=centerX+EXTENT/2,yNorth=centerY+EXTENT/2,ySouth=centerY-EXTENT/2;
  const colAt=x=>offset+x/scale,rowAt=y=>offset-y/scale;
  const rowMin=Math.floor(rowAt(yNorth)),rowMax=Math.ceil(rowAt(ySouth));
  const start=rowMin*cols*2,end=(rowMax+1)*cols*2-1,buffer=await range(url,start,end),heights=[];
  for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){
    const x=xWest+EXTENT*col/(SIZE-1),y=yNorth-EXTENT*row/(SIZE-1);
    heights.push(rounded(bilinear((a,b)=>buffer.readInt16LE(((b-rowMin)*cols+a)*2)*0.5,colAt(x),rowAt(y))));
  }
  const furthest=Math.max(...[[xWest,yNorth],[xEast,yNorth],[xWest,ySouth],[xEast,ySouth]].map(([x,y])=>Math.hypot(x,y)));
  return {bounds:{north:-90+2*Math.atan(furthest/(2*R_MOON))/DEG,south:-90,east:180,west:-180},heights,projection:{type:'south-polar-stereographic',radiusMeters:R_MOON,centerLat:site.lat,centerLon:site.lon,centralMeridian:0,xWest,xEast,yNorth,ySouth},source:{id:'lola',title:'LRO LOLA LDEM_75S_240M, V2.0',url,labelUrl,sha256ByteRange:hash(buffer),byteRange:[start,end],nativeResolutionMetersApprox:240,datum:'Height relative to 1,737,400 m lunar sphere; DE421 mean Earth/polar axis frame',sampling:'Bilinear sample in lunar south-polar stereographic coordinates at 500 m spacing; label specifies little-endian signed16 DN × 0.5 metres.',caveat:'Source ground tracks are interpolated using GMT surface. Grid axes are projected X/Y, not global north/east. Illumination, shadows and ice have not been calculated.'}};
}

await mkdir(OUT,{recursive:true});
const selected=process.argv.slice(2),sites=selected.length?SITES.filter(site=>selected.includes(site.id)):SITES;
for(const site of sites){
  console.log(`Preparing ${site.id}…`);
  const result=await(site.body==='mars'?mars(site):site.body==='moon'?moon(site):earth(site));
  const data={schemaVersion:1,siteId:site.id,name:site.name,body:site.body,center:{lat:site.lat,lon:site.lon},comparisonEligible:site.comparisonEligible!==false,size:SIZE,widthMeters:EXTENT,depthMeters:EXTENT,gridSpacingMeters:SPACING,orientation:'Rows follow decreasing projected northing; columns follow increasing easting.',units:'meters',retrievedAt:date,...result};
  const stats=analyzeTerrain(data);
  data.summary={min:rounded(stats.min),max:rounded(stats.max),relief:rounded(stats.relief),slopeMean:rounded(stats.slopeMean),slopeP90:rounded(stats.slopeP90),slopeHistogram:stats.slopeHistogram,validCount:stats.validCount};
  await writeFile(`${OUT}${site.id}-terrain.json`,JSON.stringify(data));
  console.log(`${site.id}: range ${stats.min.toFixed(1)}..${stats.max.toFixed(1)}m, relief ${stats.relief.toFixed(1)}m, mean slope ${stats.slopeMean.toFixed(2)}°`);
}
const available=[];
for(const file of (await readdir(OUT)).filter(file=>file.endsWith('-terrain.json'))){
  const data=JSON.parse(await readFile(`${OUT}${file}`,'utf8'));
  available.push({file,siteId:data.siteId,retrievedAt:data.retrievedAt,center:data.center,source:data.source});
}
await writeFile(`${OUT}retrieval-manifest.json`,JSON.stringify({generatedAt:date,datasets:available,networkRequestsDuringThisRun:fetchedSources},null,2));
