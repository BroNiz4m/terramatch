import {createHash} from 'node:crypto';

const N=65,EXTENT=32000,DEG=Math.PI/180,MARS_RADIUS=3396000,MOON_RADIUS=1737400;
const MOLA='https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg128/';
const LOLA='https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const wrap=lon=>((lon+180)%360+360)%360-180;
export function pdsField(label,key){const match=label.match(new RegExp('^\\s*'+key+'\\s*=\\s*([^\\r\\n]+)','m'));if(!match)throw Error('Missing PDS label field: '+key);return match[1].replace(/\s*<[^>]*>/,'').replace(/^"|"$/g,'').trim();}
function requireField(label,key,value){if(pdsField(label,key)!==String(value))throw Error(`Unexpected ${key} in planetary source label`);}
function interpolate(values,x,y){const u=x-Math.floor(x),v=y-Math.floor(y);return Math.round(((values[0]*(1-u)+values[1]*u)*(1-v)+(values[2]*(1-u)+values[3]*u)*v)*100)/100;}
function validSite(site){if(!Number.isFinite(site.lat)||!Number.isFinite(site.lon)||Math.abs(site.lat)>90||Math.abs(site.lon)>180)throw Error('Invalid planetary window center');}
function safeDN(value){if(value===-32768||value===32767)throw Error('Extreme source DN requires separate quality review; no replacement generated');return value;}

// Global integer pixel addressing keeps interpolation continuous across all 90°/44° tiles.
export function molaCell(column,row){
  const worldWidth=360*128,worldHeight=176*128;
  if(!Number.isInteger(column)||!Number.isInteger(row)||row<0||row>=worldHeight)throw Error('MOLA 128 ppd interpolation support outside 88° S–88° N');
  const c=((column%worldWidth)+worldWidth)%worldWidth,tileColumn=Math.floor(c/11520),tileRow=Math.floor(row/5632),north=[88,44,0,-44][tileRow];
  return {tile:`${String(Math.abs(north)).padStart(2,'0')}${north<0?'s':'n'}${String(tileColumn*90).padStart(3,'0')}hb`,x:c%11520,y:row%5632,north,west:tileColumn*90};
}
export async function fetchMarsTerrain(site,{readLabel,readRange,now=new Date().toISOString()}={}){
  validSite(site);
  const dlat=EXTENT/2/MARS_RADIUS/DEG,dlon=dlat/Math.cos(site.lat*DEG),bounds={north:site.lat+dlat,south:site.lat-dlat,west:site.lon-dlon,east:site.lon+dlon};
  const points=[],tiles=new Map();
  for(let row=0;row<N;row++)for(let col=0;col<N;col++){
    const lat=bounds.north-row/(N-1)*(bounds.north-bounds.south),lon=bounds.west+col/(N-1)*(bounds.east-bounds.west);
    const x=((lon+360)%360)*128-.5,y=(88-lat)*128-.5,a=Math.floor(x),b=Math.floor(y),cells=[[a,b],[a+1,b],[a,b+1],[a+1,b+1]].map(([c,r])=>molaCell(c,r));
    for(const cell of cells){if(!tiles.has(cell.tile))tiles.set(cell.tile,{...cell,minRow:cell.y,maxRow:cell.y});const tile=tiles.get(cell.tile);tile.minRow=Math.min(tile.minRow,cell.y);tile.maxRow=Math.max(tile.maxRow,cell.y);}
    points.push({x,y,cells});
  }
  const files=[];
  for(const tile of tiles.values())for(const kind of ['t','c']){
    const product=`meg${kind}${tile.tile}`,url=MOLA+product+'.img',labelUrl=url.replace('.img','.lbl'),label=await readLabel(labelUrl);
    requireField(label,'LINES',5632);requireField(label,'LINE_SAMPLES',11520);requireField(label,'MAP_RESOLUTION','128.0');requireField(label,'POSITIVE_LONGITUDE_DIRECTION','EAST');requireField(label,'COORDINATE_SYSTEM_NAME','PLANETOCENTRIC');
    requireField(label,'SAMPLE_BITS',kind==='t'?16:8);requireField(label,'SAMPLE_TYPE',kind==='t'?'MSB_INTEGER':'UNSIGNED_INTEGER');
    if(+pdsField(label,'WESTERNMOST_LONGITUDE')!==tile.west||+pdsField(label,'MAXIMUM_LATITUDE')!==tile.north)throw Error('MOLA tile bounds disagree with its label');
    const bytesPerPixel=kind==='t'?2:1,start=tile.minRow*11520*bytesPerPixel,end=(tile.maxRow+1)*11520*bytesPerPixel-1,buffer=await readRange(url,start,end);
    if(buffer.length!==end-start+1)throw Error('Incomplete MOLA source strip');
    tile[kind]=buffer;
    const provenance={kind:kind==='t'?'topography':'observation-counts',productId:pdsField(label,'PRODUCT_ID'),productVersion:pdsField(label,'PRODUCT_VERSION_ID'),url,labelUrl,labelSha256:hash(label),byteRange:[start,end],bytes:buffer.length,sha256:hash(buffer),retrievedAt:now,observationStart:pdsField(label,'START_TIME'),observationStop:pdsField(label,'STOP_TIME')};
    files.push(provenance);
  }
  const support=new Map();let anyZero=0,allZero=0;
  const heights=points.map(point=>{
    const counts=[],values=point.cells.map(cell=>{const tile=tiles.get(cell.tile),index=(cell.y-tile.minRow)*11520+cell.x,count=tile.c[index];counts.push(count);support.set(`${cell.tile}:${cell.x}:${cell.y}`,count);return safeDN(tile.t.readInt16BE(index*2));});
    if(counts.some(n=>n===0))anyZero++;if(counts.every(n=>n===0))allZero++;
    return interpolate(values,point.x,point.y);
  });
  const supportValues=[...support.values()],topography=files.filter(f=>f.kind==='topography');
  const observationSupport={status:'counts-inspected',uniqueSourceCells:supportValues.length,zeroCountCells:supportValues.filter(n=>n===0).length,minCount:Math.min(...supportValues),maxCount:Math.max(...supportValues),gridSamplesWithAnyZeroCountCorner:anyZero,gridSamplesWithAllZeroCountCorners:allZero,gridSampleCount:N*N,files:files.filter(f=>f.kind==='observation-counts'),note:'Counts describe native source bins, not direct measurements at each output sample. Zero-count bins retain archived interpolated heights. Counts are not accuracy or analog-confidence percentages.'};
  return {bounds,heights,projection:{type:'local-equirectangular',radiusMeters:MARS_RADIUS,centerLat:site.lat,centerLon:site.lon,wrapLongitude:true},source:{id:'mola',title:`MGS MOLA MEGDR ${topography.map(f=>f.productId.replace('.IMG','')).join(' + ')}, 128 pixels per degree`,url:topography[0].url,labelUrl:topography[0].labelUrl,labelSha256:topography[0].labelSha256,sha256ByteRange:topography.length===1?topography[0].sha256:null,byteRange:topography.length===1?topography[0].byteRange:null,files,nativeResolutionMetersApprox:463,datum:'Topography relative to the Mars areoid, IAU2000 planetocentric coordinates, east-positive longitude.',sampling:'Pixel-center-correct bilinear sampling of the native 128 ppd MOLA grids at 500 m local projected spacing, including tile/seam support.',observationSupport,caveat:'Native cells without altimeter returns are interpolated in the source; track gaps can reach 12 km. Posting is not effective measurement accuracy. This is not a rover-scale hazard map.'}};
}

export function polarWindow(site){
  validSite(site);
  const rho=2*MOON_RADIUS*Math.tan((Math.PI/2+site.lat*DEG)/2),x=rho*Math.sin(site.lon*DEG),y=rho*Math.cos(site.lon*DEG);
  const p={type:'south-polar-stereographic',radiusMeters:MOON_RADIUS,centerLat:site.lat,centerLon:site.lon,centralMeridian:0,xWest:x-EXTENT/2,xEast:x+EXTENT/2,yNorth:y+EXTENT/2,ySouth:y-EXTENT/2};
  const corners=[[p.xWest,p.yNorth],[p.xEast,p.yNorth],[p.xWest,p.ySouth],[p.xEast,p.ySouth]],nearX=Math.max(p.xWest,Math.min(0,p.xEast)),nearY=Math.max(p.ySouth,Math.min(0,p.yNorth)),minR=Math.hypot(nearX,nearY),maxR=Math.max(...corners.map(([a,b])=>Math.hypot(a,b)));
  const latitude=r=>-90+2*Math.atan(r/(2*MOON_RADIUS))/DEG,bounds={north:latitude(maxR),south:latitude(minR),west:-180,east:180};
  if(minR>0){const lons=corners.map(([a,b])=>((Math.atan2(a,b)/DEG)+360)%360).sort((a,b)=>a-b);let gap=-1,index=0;for(let i=0;i<lons.length;i++){const size=(i===lons.length-1?lons[0]+360:lons[i+1])-lons[i];if(size>gap){gap=size;index=i;}}const start=lons[(index+1)%lons.length];bounds.west=wrap(start);bounds.east=bounds.west+360-gap;bounds.crossesAntimeridian=bounds.east>180;}
  if(bounds.north>-75)throw Error('Lunar window extends outside the LDEM_75S valid latitude domain');
  return {projection:p,bounds};
}
export async function fetchMoonTerrain(site,{readLabel,readRange,now=new Date().toISOString()}={}){
  const {projection:p,bounds}=polarWindow(site),url=LOLA+'ldem_75s_240m.img',labelUrl=url.replace('.img','.lbl'),label=await readLabel(labelUrl);
  for(const [key,value] of Object.entries({LINES:3812,LINE_SAMPLES:3812,SAMPLE_TYPE:'LSB_INTEGER',SAMPLE_BITS:16,SCALING_FACTOR:0.5,MAP_SCALE:240,LINE_PROJECTION_OFFSET:1905.5,SAMPLE_PROJECTION_OFFSET:1905.5,COORDINATE_SYSTEM_NAME:'MEAN EARTH/POLAR AXIS OF DE421'}))requireField(label,key,value);
  const points=[];
  for(let row=0;row<N;row++)for(let col=0;col<N;col++){const x=1905.5+(p.xWest+col*500)/240,y=1905.5-(p.yNorth-row*500)/240;if(Math.floor(x)<0||Math.floor(x)+1>=3812||Math.floor(y)<0||Math.floor(y)+1>=3812)throw Error('Lunar interpolation support is outside source raster');points.push({x,y});}
  const rowMin=Math.min(...points.map(v=>Math.floor(v.y))),rowMax=Math.max(...points.map(v=>Math.floor(v.y)+1)),start=rowMin*3812*2,end=(rowMax+1)*3812*2-1,buffer=await readRange(url,start,end);
  if(buffer.length!==end-start+1)throw Error('Incomplete LOLA source strip');
  const heights=points.map(({x,y})=>{const a=Math.floor(x),b=Math.floor(y),values=[[a,b],[a+1,b],[a,b+1],[a+1,b+1]].map(([c,r])=>safeDN(buffer.readInt16LE(((r-rowMin)*3812+c)*2))*.5);return interpolate(values,x,y);});
  return {bounds,heights,projection:p,source:{id:'lola',title:'LRO LOLA LDEM_75S_240M, V2.0',url,labelUrl,labelSha256:hash(label),sha256ByteRange:hash(buffer),byteRange:[start,end],bytes:buffer.length,retrievedAt:now,productVersion:pdsField(label,'PRODUCT_VERSION_ID'),observationStart:pdsField(label,'START_TIME'),observationStop:pdsField(label,'STOP_TIME'),nativeResolutionMetersApprox:240,datum:'Radial height relative to a 1,737,400 m sphere, DE421 mean Earth/polar axis frame.',sampling:'Bilinear source-pixel-center sampling in south-polar stereographic coordinates at 500 m projected intervals; little-endian signed DN × 0.5 m.',observationSupport:{status:'not-verified',note:'LOLA gridding interpolates tracks. No separate per-cell observation-count or uncertainty layer was acquired.'},caveat:'Projected spacing is not exact geodesic spacing away from the pole. Source ground tracks are interpolated. No illumination, permanent-shadow, ice or landing-safety analysis is implied.'}};
}
