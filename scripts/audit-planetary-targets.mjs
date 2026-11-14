/** Bounded source audit only. Never writes application data or the target catalogue. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {analyzeTerrain,terrainCoordinates} from '../dist/js/science.js';

const OUT=new URL('../research/planetary-target-audit-2026-11-15/',import.meta.url);
const MOLA='https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg128/';
const LOLA='https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/';
const SIZE=65,EXTENT=32000,SPACING=500,DEG=Math.PI/180;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const wrap=lon=>((lon+180)%360+360)%360-180;
const labels=new Map(),requests=[];
const candidates=[
  {id:'cabeus-center',name:'Cabeus crater-center window',body:'moon',lat:-85.33,lon:-42.13,radius:1737400,
    coordinateSource:'https://planetarynames.wr.usgs.gov/Feature/953',
    coordinateNote:'Rounded Gazetteer crater center, not the LCROSS impact coordinate or an approved base site.'},
  {id:'nobile-center',name:'Nobile crater-center window',body:'moon',lat:-85.28,lon:53.27,radius:1737400,
    coordinateSource:'https://planetarynames.wr.usgs.gov/Feature/4321',
    coordinateNote:'Rounded Gazetteer crater center, not the western-rim region in the historical 2021 VIPER announcement.'},
  {id:'gale-bradbury',name:'Gale / Bradbury Landing window',body:'mars',lat:-4.5895,lon:137.4417,radius:3396000,
    coordinateSource:'https://doi.org/10.1002/2014JE004622',
    coordinateNote:'Published historical Curiosity landing coordinate; not the current rover position or the center of the entire Gale crater.'},
  {id:'eberswalde-delta',name:'Eberswalde delta-area window',body:'mars',lat:-23.8,lon:-33.7,radius:3396000,
    coordinateSource:'https://www.uahirise.org/dtm/dtm.php?ID=PSP_001336_1560',
    coordinateNote:'Project study-window center uses the HiRISE DTM page approximate center -23.8 degrees, 326.3 degrees E, normalized to -33.7 degrees. HiRISE pixels are not ingested; this audit uses MOLA.'}
];

async function get(url,{start,end}={}){
  const limit=4*1024*1024,headers=start===undefined?{}:{Range:`bytes=${start}-${end}`};
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`${response.status}: ${url}`);
  if(start!==undefined){
    assert.equal(response.status,206,'Server must honor the byte range');
    const contentRange=response.headers.get('content-range');
    assert.ok(contentRange?.startsWith(`bytes ${start}-${end}/`),'Exact Content-Range required');
  }
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>limit)throw Error('Audit response exceeds 4 MiB bound');chunks.push(chunk.value);}}
  finally{await reader.cancel();}
  const buffer=Buffer.concat(chunks);
  if(start!==undefined)assert.equal(buffer.length,end-start+1);
  const provenance={url,status:response.status,byteRange:start===undefined?null:[start,end],contentRange:response.headers.get('content-range'),bytes:buffer.length,sha256:sha(buffer),retrievedAt:new Date().toISOString()};
  requests.push(provenance);return {buffer,provenance};
}
function field(label,key){const match=label.match(new RegExp('^\\s*'+key+'\\s*=\\s*([^\\r\\n]+)','m'));assert.ok(match,`Label missing ${key}`);return match[1].replace(/\s*<[^>]*>/,'').replace(/^"|"$/g,'').trim();}
async function label(url){
  if(!labels.has(url)){
    const result=await get(url),name=url.split('/').at(-1);
    await writeFile(new URL(name,OUT),result.buffer);
    labels.set(url,{...result,text:result.buffer.toString('utf8'),localFile:name});
  }
  return labels.get(url);
}
function bilinear(read,x,y){const a=Math.floor(x),b=Math.floor(y),tx=x-a,ty=y-b;return (read(a,b)*(1-tx)+read(a+1,b)*tx)*(1-ty)+(read(a,b+1)*(1-tx)+read(a+1,b+1)*tx)*ty;}
function extent(s){const dlat=EXTENT/2/s.radius/DEG,dlon=dlat/Math.cos(s.lat*DEG);return {north:s.lat+dlat,south:s.lat-dlat,west:s.lon-dlon,east:s.lon+dlon};}
function spatialCheck(data,site){
  for(const [u,v] of [[0,0],[0,1],[1,0],[1,1],[.5,.5],[.25,.75]]){
    const p=terrainCoordinates(data,u,v);
    if(site.body==='mars'){
      assert.ok(Math.abs(p.lat-(data.bounds.north+(data.bounds.south-data.bounds.north)*v))<1e-9);
      assert.ok(Math.abs(wrap(p.lon-(data.bounds.west+(data.bounds.east-data.bounds.west)*u)))<1e-9);
    }else{
      const rho=2*site.radius*Math.tan((Math.PI/2+p.lat*DEG)/2);
      const x=rho*Math.sin(p.lon*DEG),y=rho*Math.cos(p.lon*DEG);
      assert.ok(Math.abs(x-(data.projection.xWest+u*EXTENT))<1e-6);
      assert.ok(Math.abs(y-(data.projection.yNorth-v*EXTENT))<1e-6);
    }
  }
  const center=terrainCoordinates(data,.5,.5);assert.ok(Math.abs(center.lat-site.lat)<1e-9);assert.ok(Math.abs(wrap(center.lon-site.lon))<1e-9);
}
async function extract(site){
  const isMoon=site.body==='moon';let url,cols,lines,points=[],projection,bounds;
  if(isMoon){
    url=LOLA+'ldem_75s_240m.img';cols=lines=3812;
    const rho=2*site.radius*Math.tan((Math.PI/2+site.lat*DEG)/2),cx=rho*Math.sin(site.lon*DEG),cy=rho*Math.cos(site.lon*DEG);
    projection={type:'south-polar-stereographic',radiusMeters:site.radius,centerLat:site.lat,centerLon:site.lon,centralMeridian:0,xWest:cx-EXTENT/2,xEast:cx+EXTENT/2,yNorth:cy+EXTENT/2,ySouth:cy-EXTENT/2};
    const coords=[];
    for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){
      const x=projection.xWest+col*SPACING,y=projection.yNorth-row*SPACING;
      const lat=-90+2*Math.atan(Math.hypot(x,y)/(2*site.radius))/DEG,lon=Math.atan2(x,y)/DEG;
      assert.ok(lat<=-75,'Window outside the polar product valid latitude');coords.push({lat,lon});points.push({x:1905.5+x/240,y:1905.5-y/240});
    }
    bounds={north:Math.max(...coords.map(p=>p.lat)),south:Math.min(...coords.map(p=>p.lat)),west:Math.min(...coords.map(p=>p.lon)),east:Math.max(...coords.map(p=>p.lon))};
  }else{
    bounds=extent(site);const lon360=(site.lon+360)%360,west=Math.floor(lon360/90)*90,north=site.lat>=0?44:0;
    assert.equal(north,0,'This bounded shortlist uses southern equatorial tiles');
    const tile=`megt00n${String(west).padStart(3,'0')}hb`;url=MOLA+tile+'.img';cols=11520;lines=5632;
    projection={type:'local-equirectangular',radiusMeters:site.radius,centerLat:site.lat,centerLon:site.lon};
    for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){
      const lat=bounds.north-row/(SIZE-1)*(bounds.north-bounds.south),lon=(bounds.west+col/(SIZE-1)*(bounds.east-bounds.west)+360)%360;
      points.push({x:(lon-west)*128-.5,y:(north-lat)*128-.5});
    }
  }
  const metadata=await label(url.replace('.img','.lbl')),text=metadata.text;
  assert.equal(+field(text,'LINES'),lines);assert.equal(+field(text,'LINE_SAMPLES'),cols);assert.equal(+field(text,'SAMPLE_BITS'),16);
  assert.equal(field(text,'SAMPLE_TYPE'),isMoon?'LSB_INTEGER':'MSB_INTEGER');
  if(isMoon){assert.equal(+field(text,'SCALING_FACTOR'),.5);assert.equal(+field(text,'MAP_SCALE'),240);assert.equal(+field(text,'LINE_PROJECTION_OFFSET'),1905.5);assert.equal(+field(text,'SAMPLE_PROJECTION_OFFSET'),1905.5);}
  else{assert.equal(+field(text,'MAP_RESOLUTION'),128);assert.equal(field(text,'COORDINATE_SYSTEM_NAME'),'PLANETOCENTRIC');}
  for(const p of points){assert.ok(Math.floor(p.x)>=0&&Math.floor(p.x)+1<cols);assert.ok(Math.floor(p.y)>=0&&Math.floor(p.y)+1<lines);}
  const rowMin=Math.min(...points.map(p=>Math.floor(p.y))),rowMax=Math.max(...points.map(p=>Math.floor(p.y)+1));
  const strip=await get(url,{start:rowMin*cols*2,end:(rowMax+1)*cols*2-1});
  const rawFile=site.id+'-topography-range.bin';await writeFile(new URL(rawFile,OUT),strip.buffer);
  const support=new Set(),read=(x,y)=>{
    support.add(`${x},${y}`);const at=((y-rowMin)*cols+x)*2,dn=isMoon?strip.buffer.readInt16LE(at):strip.buffer.readInt16BE(at);
    assert.ok(dn!==-32768&&dn!==32767,'Extreme DN requires separate source-flag review; no replacement permitted');
    return dn*(isMoon?.5:1);
  };
  const heights=points.map(p=>Math.round(bilinear(read,p.x,p.y)*100)/100);
  const data={schemaVersion:1,siteId:site.id,name:site.name,body:site.body,center:{lat:site.lat,lon:site.lon},size:SIZE,widthMeters:EXTENT,depthMeters:EXTENT,gridSpacingMeters:SPACING,units:'meters',bounds,projection,heights,
    source:{id:isMoon?'lola':'mola',url,labelUrl:url.replace('.img','.lbl'),labelSha256:metadata.provenance.sha256,labelLocalFile:metadata.localFile,...strip.provenance,localFile:rawFile,
      datum:isMoon?'Radial height relative to 1737400 m sphere; MEAN EARTH/POLAR AXIS OF DE421':'Topography relative to Mars areoid; IAU2000 planetocentric, east-positive',
      nominalPostingMeters:isMoon?240:2*Math.PI*site.radius/(360*128),sampling:'Bilinear source-pixel-center sampling at 500 m projected intervals; rounded to 0.01 m, not centimetre accuracy.'}};
  spatialCheck(data,site);const stats=analyzeTerrain(data);
  const observationSupport={status:'not-verified',note:'Finite DEM values do not establish independent observation coverage or effective accuracy. LOLA gridding interpolates tracks; no separate lunar count/uncertainty map was acquired.'};
  if(!isMoon){
    const countUrl=url.replace('/megt','/megc'),countLabel=await label(countUrl.replace('.img','.lbl'));
    assert.equal(field(countLabel.text,'SAMPLE_TYPE'),'UNSIGNED_INTEGER');assert.equal(+field(countLabel.text,'SAMPLE_BITS'),8);assert.equal(+field(countLabel.text,'LINES'),lines);assert.equal(+field(countLabel.text,'LINE_SAMPLES'),cols);
    const counts=await get(countUrl,{start:rowMin*cols,end:(rowMax+1)*cols-1}),countsFile=site.id+'-counts-range.bin';await writeFile(new URL(countsFile,OUT),counts.buffer);
    const value=(x,y)=>counts.buffer[(y-rowMin)*cols+x],supportValues=[...support].map(key=>value(...key.split(',').map(Number)));
    let anyZero=0,allZero=0;
    for(const p of points){const x=Math.floor(p.x),y=Math.floor(p.y),v=[value(x,y),value(x+1,y),value(x,y+1),value(x+1,y+1)];if(v.some(n=>n===0))anyZero++;if(v.every(n=>n===0))allZero++;}
    Object.assign(observationSupport,{status:'counts-inspected',source:{...counts.provenance,localFile:countsFile,labelUrl:countUrl.replace('.img','.lbl'),labelSha256:countLabel.provenance.sha256,labelLocalFile:countLabel.localFile},uniqueSourceCells:supportValues.length,zeroCountCells:supportValues.filter(n=>n===0).length,minCount:Math.min(...supportValues),maxCount:Math.max(...supportValues),gridSamplesWithAnyZeroCountCorner:anyZero,gridSamplesWithAllZeroCountCorners:allZero,note:'Counts refer to original latitude/longitude bins used for interpolation, not the number of direct measurements at each resampled output location. Zero-count source cells retain source-gridded topography, not invented replacements; this is not an accuracy percentage.'});
  }
  data.auditOnly=true;data.observationSupport=observationSupport;
  const gridFile=site.id+'-research-grid.json';await writeFile(new URL(gridFile,OUT),JSON.stringify(data));
  const summary={...site,status:'complete-source-grid-extracted',gridFile,gridSha256:sha(await readFile(new URL(gridFile,OUT))),sampleCount:heights.length,bounds,projection,source:data.source,observationSupport,statistics:{min:stats.min,max:stats.max,relief:stats.relief,slopeMean:stats.slopeMean,slopeP90:stats.slopeP90},checks:{finiteGrid:heights.every(Number.isFinite),sourcePixelSupportInsideProduct:true,spatialRoundTrips:true,sourceHashRecorded:true},implementationApproved:false};
  console.log(JSON.stringify({id:site.id,status:summary.status,relief:stats.relief,slopeMean:stats.slopeMean,observationSupport}));return summary;
}

await mkdir(OUT,{recursive:true});const report={auditDateLocal:'2026-11-15',timezone:'Asia/Taipei',applicationChanged:false,gridsAreResearchOnly:true,candidates:[],requests};
for(const site of candidates){try{report.candidates.push(await extract(site));}catch(error){report.candidates.push({...site,status:'failed',error:error.message});process.exitCode=1;console.error(`${site.id}: ${error.message}`);}}
report.completedAt=new Date().toISOString();await writeFile(new URL('probes.json',OUT),JSON.stringify(report,null,2));
console.log(`Audit report: ${fileURLToPath(new URL('probes.json',OUT))}`);
