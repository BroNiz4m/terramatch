import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SITES,terrainCoordinates,analyzeTerrain,compareTerrains,TASK_PROFILES} from '../dist/js/science.js';
import {fetchMarsTerrain,fetchMoonTerrain,polarWindow} from '../scripts/lib/planetary-terrain.mjs';

const dir=new URL('../research/planetary-target-audit-2026-11-15/',import.meta.url);
const audit=JSON.parse(await readFile(new URL('probes.json',dir),'utf8'));
test('the new pipeline reproduces all four independently audited grids from exact original source strips',async()=>{
  const earth=JSON.parse(await readFile(new URL('../dist/data/wadi-rum-terrain.json',import.meta.url),'utf8'));
  for(const item of audit.candidates){
    const site=SITES.find(s=>s.id===item.id),original=JSON.parse(await readFile(new URL(item.gridFile,dir),'utf8'));
    const reads=[original.source,...(original.observationSupport.source?[original.observationSupport.source]:[])];
    const io={readLabel:async url=>readFile(new URL(reads.find(r=>r.labelUrl===url).labelLocalFile,dir),'utf8'),readRange:async(url,start,end)=>{const r=reads.find(r=>r.url===url);assert.deepEqual([start,end],r.byteRange);return readFile(new URL(r.localFile,dir));}};
    const generated=await (site.body==='moon'?fetchMoonTerrain:fetchMarsTerrain)(site,io);
    const bundled=JSON.parse(await readFile(new URL('../dist/'+site.terrainFile,import.meta.url),'utf8'));
    assert.deepEqual(generated.heights,original.heights);assert.deepEqual(bundled.heights,original.heights);assert.deepEqual(bundled.projection,generated.projection);
    assert.equal(generated.source.sha256ByteRange,original.source.sha256);assert.equal(bundled.source.sha256ByteRange,original.source.sha256);assert.equal(bundled.source.labelSha256,original.source.labelSha256);
    assert.equal(bundled.source.coordinateSource,item.coordinateSource);assert.match(bundled.source.coordinateNote,/center|coordinate/);
    if(site.body==='moon'){assert.ok(bundled.bounds.south>-90);assert.ok(bundled.bounds.east-bundled.bounds.west<30);}
    else{for(const key of ['uniqueSourceCells','zeroCountCells','gridSamplesWithAnyZeroCountCorner','gridSamplesWithAllZeroCountCorners'])assert.equal(generated.source.observationSupport[key],original.observationSupport[key]);}
    for(const [row,col]of[[0,0],[64,64],[32,32],[15,51]]){const p=terrainCoordinates(bundled,col/64,row/64);assert.ok(p.lat>=bundled.bounds.south-1e-9&&p.lat<=bundled.bounds.north+1e-9);}
    const stats=analyzeTerrain(bundled);assert.ok(Math.abs(stats.relief-item.statistics.relief)<1e-8);
    for(const task of Object.values(TASK_PROFILES)){const result=compareTerrains(bundled,earth,task.weights);assert.ok(Number.isFinite(result.score));assert.equal(result.components[0].weight,task.weights.slope);}
  }
});

test('MOLA interpolation crosses the equator and 0°/360° tile seams without a half-pixel jump',async()=>{
  const seen=[];
  function product(url){const m=url.match(/meg([tc])(\d{2})([ns])(\d{3})hb\./);assert.ok(m);return {kind:m[1],north:Number(m[2])*(m[3]==='s'?-1:1),west:Number(m[4])};}
  const io={readLabel:async url=>{const p=product(url);return `LINES = 5632\nLINE_SAMPLES = 11520\nMAP_RESOLUTION = 128.0\nPOSITIVE_LONGITUDE_DIRECTION = EAST\nCOORDINATE_SYSTEM_NAME = PLANETOCENTRIC\nSAMPLE_BITS = ${p.kind==='t'?16:8}\nSAMPLE_TYPE = ${p.kind==='t'?'MSB_INTEGER':'UNSIGNED_INTEGER'}\nWESTERNMOST_LONGITUDE = ${p.west}\nMAXIMUM_LATITUDE = ${p.north}\nPRODUCT_ID = "${url.split('/').at(-1).replace('.lbl','.IMG')}"\nPRODUCT_VERSION_ID = 2.0\nSTART_TIME = 1997-09-15\nSTOP_TIME = 2001-06-30`;},readRange:async(url,start,end)=>{
    const p=product(url),stride=11520*(p.kind==='t'?2:1),first=start/stride,rows=(end-start+1)/stride,b=Buffer.alloc(end-start+1);seen.push(url);
    for(let r=0;r<rows;r++)for(let c=0;c<11520;c++){
      const globalRow=(88-p.north)*128+first+r,globalColumn=p.west*128+c,signedColumn=globalColumn>=360*128/2?globalColumn-360*128:globalColumn;
      if(p.kind==='t')b.writeInt16BE(globalRow-11264+signedColumn,(r*11520+c)*2);else b[r*11520+c]=200;
    }return b;
  }};
  const site={lat:0,lon:0},result=await fetchMarsTerrain(site,io);assert.equal(seen.length,8);assert.equal(result.heights[32*65+32],-1);assert.equal(result.source.observationSupport.minCount,200);
  for(let row=0;row<65;row++)for(let col=0;col<65;col++){const lat=result.bounds.north-row/64*(result.bounds.north-result.bounds.south),lon=result.bounds.west+col/64*(result.bounds.east-result.bounds.west),expected=Math.round((128*(lon-lat)-1)*100)/100;assert.equal(result.heights[row*65+col],expected);}
  assert.equal(result.source.files.filter(f=>f.kind==='topography').length,4);
  await assert.rejects(()=>fetchMarsTerrain({lat:88,lon:0},io),/outside 88/);
});

test('polar bounds describe the actual window and unsupported latitude fails before a source read',()=>{
  const atPole=polarWindow({lat:-89.67,lon:129.78});assert.equal(atPole.bounds.south,-90);assert.equal(atPole.bounds.east-atPole.bounds.west,360);
  for(const id of ['cabeus-center','nobile-center']){const p=polarWindow(SITES.find(s=>s.id===id));assert.ok(p.bounds.south>-87);assert.ok(p.bounds.east-p.bounds.west<30);}
  assert.throws(()=>polarWindow({lat:-74,lon:0}),/outside/);
});
