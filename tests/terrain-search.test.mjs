import fs from 'node:fs';
import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {decodePNG,decodeTerrarium,parseCoordinates,isLand,landWindowCoverage,generateSearchCenters,loadEarthWindow,findPlaces,scanEarthRegion,clearSearchCaches,loadLandMask} from '../dist/js/terrain-search.js';

const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;clearSearchCaches();});
const CRC=Uint32Array.from({length:256},(_,v)=>{for(let i=0;i<8;i++)v=(v&1)?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
function checksum(bytes){let c=0xffffffff;for(const v of bytes)c=CRC[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(checksum(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function png({width=256,height=256,channels=3,pixel=(x,y)=>[128,0,0,255],filter=row=>row%5,interlace=0,colour=channels===4?6:2}={}){
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=colour;header[12]=interlace;
 const stride=width*channels,actual=Buffer.alloc(stride*height),raw=Buffer.alloc((stride+1)*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const values=pixel(x,y);for(let c=0;c<channels;c++)actual[y*stride+x*channels+c]=values[c];}
 for(let y=0;y<height;y++){
  const f=filter(y);raw[y*(stride+1)]=f;
  for(let x=0;x<stride;x++){const p=y*stride+x,a=x>=channels?actual[p-channels]:0,b=y?actual[p-stride]:0,c=y&&x>=channels?actual[p-stride-channels]:0,predict=f===0?0:f===1?a:f===2?b:f===3?Math.floor((a+b)/2):paeth(a,b,c);raw[y*(stride+1)+1+x]=(actual[p]-predict+256)&255;}
 }
 return {bytes:Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]),actual};
}
function rgb(height){const value=height+32768,integer=Math.floor(value);return[Math.floor(integer/256),integer%256,Math.round((value-integer)*256),255];}
const polygon=(west,south,east,north)=>({type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]});
const worldLand={type:'FeatureCollection',features:[{type:'Feature',geometry:polygon(-180,-85,0,85)},{type:'Feature',geometry:polygon(0,-85,180,85)}]};
const noLand={type:'FeatureCollection',features:[]};
const target={size:65,widthMeters:32000,depthMeters:32000,heights:Array(4225).fill(100)};
function mockTiles({height=()=>100,delay=0,failFirst=false,mask=worldLand}={}){
 let calls=0,active=0,maxActive=0,failed=false;const urls=[];
 globalThis.fetch=async(url,options={})=>{
  const href=String(url);if(href.includes('land-mask-10m.geojson'))return new Response(fs.readFileSync(new URL('../dist/data/land-mask-10m.geojson',import.meta.url)));
  if(href.includes('land-mask.geojson'))return new Response(JSON.stringify(mask));
  const match=href.match(/terrarium\/(\d+)\/(\d+)\/(\d+)\.png$/);if(!match)throw new Error(`Unexpected mocked URL ${href}`);
  calls++;urls.push(href);active++;maxActive=Math.max(maxActive,active);
  try{
   if(failFirst&&!failed){failed=true;throw new Error('A real network error would be reported here.');}
   await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,delay);if(options.signal?.aborted){clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));return;}options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
   const [z,tx,ty]=match.slice(1).map(Number);return new Response(png({pixel:(x,y)=>rgb(height({z,tx,ty,x,y}))}).bytes,{headers:{'Content-Type':'image/png'}});
  }finally{active--;}
 };
 return {get calls(){return calls;},get maxActive(){return maxActive;},urls};
}

test('PNG decoder reconstructs all five PNG filters byte-for-byte',async()=>{
 const {bytes,actual}=png({width:4,height:5,pixel:(x,y)=>[(x*31+y*17)%256,(x*67+y*29)%256,(x*19+y*73)%256]});const image=await decodePNG(bytes);
 assert.equal(image.width,4);assert.equal(image.height,5);assert.equal(image.channels,3);assert.deepEqual(Buffer.from(image.pixels),actual);
});
test('RGBA decoder preserves all channels and rejects transparent terrain',async()=>{
 const image=await decodePNG(png({width:2,height:2,channels:4,pixel:()=>[128,5,64,255]}).bytes);assert.equal(image.channels,4);
 const terrain=await decodeTerrarium(image);assert.equal(terrain.heights[0],5.25);
 await assert.rejects(()=>decodeTerrarium(png({width:1,height:1,channels:4,pixel:()=>[128,0,0,0]}).bytes),/transparent/);
});
test('PNG integrity and unsupported encodings fail explicitly',async()=>{
 const bad=Buffer.from(png({width:1,height:1}).bytes);bad[40]^=1;await assert.rejects(()=>decodePNG(bad),/checksum/);
 await assert.rejects(()=>decodePNG(png({width:1,height:1,interlace:1}).bytes),/non-interlaced/);
 await assert.rejects(()=>decodePNG(png({width:1,height:1,colour:3}).bytes),/RGB/);
 await assert.rejects(()=>decodePNG(new Uint8Array(20)),/signature/);
});
test('Terrarium decoding retains negative heights and fractional metres',async()=>{
 const values=[-85.25,0,2523.265625,30000];const data=await decodeTerrarium(png({width:4,height:1,pixel:x=>rgb(values[x])}).bytes);assert.deepEqual(Array.from(data.heights),values);
});
test('coordinate parser accepts decimal and hemisphere formats without guessing invalid numbers',()=>{
 for(const text of ['29.575, 35.419','29.575 35.419','29.575° N, 35.419° E','29.575N 35.419E'])assert.deepEqual(parseCoordinates(text),{lat:29.575,lon:35.41899999999998});
 assert.deepEqual(parseCoordinates('29.575 S; 35.419 W'),{lat:-29.575,lon:-35.41899999999998});
 assert.deepEqual(parseCoordinates('0, 180'),{lat:0,lon:-180});assert.equal(parseCoordinates('Wadi Rum'),null);
 for(const text of ['91, 0','0,181','-20 N,30 E','20,','30E,20N'])assert.throws(()=>parseCoordinates(text),RangeError);
});
test('land screening respects holes, boundaries, dateline polygons and polar edges',()=>{
 const hole={type:'Polygon',coordinates:[polygon(-5,-5,5,5).coordinates[0],polygon(-1,-1,1,1).coordinates[0]]};assert.equal(isLand(2,2,hole),true);assert.equal(isLand(0,0,hole),false);assert.equal(isLand(5,0,hole),true);
 const dateline=polygon(170,-10,-170,10);assert.equal(isLand(179,0,dateline),true);assert.equal(isLand(-179,0,dateline),true);assert.equal(isLand(0,0,dateline),false);
 const antarctica=polygon(-180,-90,180,-60);assert.equal(isLand(30,-80,antarctica),true);assert.equal(isLand(30,-50,antarctica),false);
});
test('land window screen reports sampled coverage and rejects unresolved coastal windows',()=>{
 const bounds={north:2,south:-2,west:-2,east:2};const all=landWindowCoverage(bounds,worldLand);assert.equal(all.land,25);assert.equal(all.allLand,true);
 const half=landWindowCoverage(bounds,polygon(0,-5,5,5));assert.equal(half.land,15);assert.equal(half.fraction,0.6);assert.equal(half.allLand,false);assert.match(half.method,/coarse/i);
});
test('automatic search centers are deterministic, distributed, bounded and land-screened',()=>{
 const bounds={north:20,south:-20,west:-30,east:30},a=generateSearchCenters(bounds,{stepDegrees:1,maxCandidates:12},worldLand),b=generateSearchCenters(bounds,{stepDegrees:1,maxCandidates:12},worldLand);
 assert.deepEqual(a,b);assert.equal(a.length,12);assert.ok(a.some(p=>p.lat<-10)&&a.some(p=>p.lat>10));assert.equal(new Set(a.map(p=>`${p.lat},${p.lon}`)).size,12);assert.equal(generateSearchCenters(bounds,{maxCandidates:5},noLand).length,0);
 const wrapped=generateSearchCenters({north:10,south:-10,west:170,east:-170},{stepDegrees:5,maxCandidates:20},worldLand);assert.ok(wrapped.some(p=>p.lon<0)&&wrapped.some(p=>p.lon>0));
 assert.throws(()=>generateSearchCenters(bounds,{maxCandidates:49},worldLand),RangeError);assert.throws(()=>generateSearchCenters(bounds,{stepDegrees:0},worldLand),RangeError);
});
test('runtime window uses pixel-center-correct bilinear interpolation across four tile seams',async()=>{
 const mock=mockTiles({height:({tx,ty,x,y})=>((tx*256+x)+(ty*256+y))/16});
 const result=await loadEarthWindow({lat:0,lon:0,landmask:worldLand,detailedLandmask:worldLand});
 assert.equal(result.data.heights.length,4225);assert.equal(result.data.heights[32*65+32],16383.94);assert.equal(result.data.source.files.length,4);assert.equal(result.site.comparisonEligible,true);assert.equal(result.data.widthMeters,32000);assert.ok(result.data.source.files.every(file=>/^[0-9a-f]{64}$/.test(file.sha256)));assert.ok(mock.maxActive<=4);
 const again=await loadEarthWindow({lat:0,lon:0,name:'A different label',landmask:worldLand,detailedLandmask:worldLand});assert.equal(again.site.id,result.site.id);assert.equal(mock.calls,4);
});
test('negative land elevations are eligible; ocean exclusion uses land mask rather than height',async()=>{
 mockTiles({height:()=>-50});const item=await loadEarthWindow({lat:0,lon:0,landmask:worldLand,detailedLandmask:worldLand});assert.equal(item.site.comparisonEligible,true);assert.ok(item.data.heights.every(height=>height===-50));
 const coastal=await loadEarthWindow({lat:0,lon:0,landmask:polygon(0,-5,5,5),detailedLandmask:worldLand});assert.equal(coastal.site.comparisonEligible,false);assert.equal(coastal.data.source.landScreening.land,15);
});
test('runtime window wraps the dateline and limits unsupported latitudes',async()=>{
 const mock=mockTiles();const item=await loadEarthWindow({lat:0,lon:179.99,landmask:worldLand,detailedLandmask:worldLand});assert.equal(item.data.bounds.crossesAntimeridian,true);assert.ok(item.data.bounds.east>180);assert.ok(mock.urls.some(url=>/\/1023\//.test(url))&&mock.urls.some(url=>/\/0\//.test(url)));
 await assert.rejects(()=>loadEarthWindow({lat:85,lon:0,landmask:worldLand,detailedLandmask:worldLand}),/84/);
});
test('aborting one request does not poison another caller or exceed four active tile fetches',async()=>{
 const mock=mockTiles({delay:20}),controller=new AbortController();
 const cancelled=loadEarthWindow({lat:0,lon:0,signal:controller.signal,landmask:worldLand,detailedLandmask:worldLand});const other=loadEarthWindow({lat:0,lon:0,landmask:worldLand,detailedLandmask:worldLand});
 setTimeout(()=>controller.abort(),5);await assert.rejects(()=>cancelled,{name:'AbortError'});assert.equal((await other).data.heights.length,4225);assert.ok(mock.maxActive<=4);
});
test('place lookup includes local reference names and external geocoding results',async()=>{
 let called='';globalThis.fetch=async url=>{called=String(url);return new Response(JSON.stringify({results:[{id:42,name:'Test Place',country:'Jordan',latitude:30,longitude:35,admin1:'Region'}]}));};
 const result=await findPlaces('Wadi Rum');assert.equal(result[0].siteId,'wadi-rum');assert.equal(result[1].name,'Test Place');assert.match(called,/name=Wadi%20Rum/);
 globalThis.fetch=async()=>{throw new Error('offline');};assert.equal((await findPlaces('Wadi Rum'))[0].siteId,'wadi-rum');await assert.rejects(()=>findPlaces('A place not in the catalogue'),/offline/);
});
test('coordinate lookup needs no geocoding request',async()=>{
 globalThis.fetch=async()=>{throw new Error('Should not geocode coordinates');};const result=await findPlaces('29.575,35.419');assert.equal(result[0].source,'coordinates');assert.equal(result[0].lat,29.575);
});
test('automatic scan retrieves genuinely new windows and retains provenance on a cached mask',async()=>{
 const mock=mockTiles(),seen=[];const mask=await loadLandMask();
 const result=await scanEarthRegion({bounds:{north:1,south:-1,west:-1,east:1},stepDegrees:1,maxCandidates:4,targetTerrain:target,detailedLandmask:worldLand,onResult:item=>seen.push(item.site.id)});
 assert.equal(result.coverage.planned,4);assert.equal(result.coverage.completed,4);assert.equal(result.results.length,4);assert.equal(seen.length,4);assert.ok(mock.calls>0);assert.ok(result.results.every(item=>item.site.id.startsWith('custom-')&&item.site.origin==='automatic'));assert.ok(result.results.every(item=>item.data.source.landMask.sha256));assert.ok(result.results.every(item=>Number.isFinite(item.comparison.score)));assert.equal(mask.type,'FeatureCollection');
});
test('cancelled automatic scan returns completed results with explicit partial coverage',async()=>{
 mockTiles();const controller=new AbortController();
 const result=await scanEarthRegion({bounds:{north:2,south:-2,west:-2,east:2},stepDegrees:1,maxCandidates:8,targetTerrain:target,landmask:worldLand,detailedLandmask:worldLand,signal:controller.signal,onResult:()=>controller.abort()});
 assert.equal(result.coverage.cancelled,true);assert.equal(result.results.length,1);assert.equal(result.coverage.completed,1);assert.equal(result.coverage.planned,8);
});
test('per-candidate fetch failures are counted and later automatic candidates still run',async()=>{
 mockTiles({failFirst:true});const result=await scanEarthRegion({bounds:{north:2,south:-2,west:-2,east:2},stepDegrees:1,maxCandidates:4,targetTerrain:target,landmask:worldLand,detailedLandmask:worldLand});
 assert.equal(result.coverage.failed,1);assert.equal(result.coverage.completed,3);assert.equal(result.results.length,3);assert.equal(result.coverage.failures.length,1);assert.equal(result.coverage.cancelled,false);
});
test('coastal automatic windows remain in excluded records rather than receiving a score',async()=>{
 mockTiles();const seen=[],controller=new AbortController();const result=await scanEarthRegion({bounds:{north:0.1,south:-0.1,west:0,east:0.2},stepDegrees:0.1,maxCandidates:4,targetTerrain:target,landmask:polygon(0,-5,5,5),detailedLandmask:worldLand,signal:controller.signal,onResult:item=>{seen.push(item);controller.abort();}});
 assert.equal(result.coverage.excluded,1);assert.equal(result.results.length,0);assert.equal(result.excluded.length,1);assert.equal(result.excluded[0].data.comparisonEligible,false);
 assert.equal(result.coverage.cancelled,true);assert.equal(result.coverage.completed,1);assert.equal(result.coverage.planned,4);assert.equal(seen.length,1);assert.equal(seen[0].comparison,undefined);assert.equal(seen[0].data.source.landScreening.samples.length,25);assert.ok(!seen[0].data.source.landScreening.samples[0].mappedLand);
});
