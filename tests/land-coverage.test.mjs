import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {assessLandCoverage,currentCoverage,DETAILED_MASK_SHA256} from '../dist/js/land-coverage.js';
import {isLand,landWindowCoverage} from '../dist/js/land-geometry.js';
import {recheckSearchWindow,loadEarthWindow,clearSearchCaches} from '../dist/js/terrain-search.js';
import {comparisonStatus} from '../dist/js/comparison-status.js';
import {restoreSearchWindows,saveSearchWindows} from '../dist/js/search-cache.js';
import {terrainPNG} from './fixtures/terrain-png.mjs';
import {earthBounds} from '../dist/js/search-ui.js';

const nativeFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=nativeFetch;clearSearchCaches();});
const polygon=(w,s,e,n)=>({type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]});
const world={type:'MultiPolygon',coordinates:[polygon(-180,-85,0,85).coordinates,polygon(0,-85,180,85).coordinates]};
const source={provided:true,sha256:'fixture'};
const audit=JSON.parse(await fs.readFile(new URL('../research/longyearbreen-audit-2026-11-15/terrain-window.json',import.meta.url)));
const coarse=JSON.parse(await fs.readFile(new URL('../dist/data/land-mask.geojson',import.meta.url)));
const detailedBytes=await fs.readFile(new URL('../dist/data/land-mask-10m.geojson',import.meta.url));
const detailed=JSON.parse(detailedBytes);

test('real Longyearbreen window passes the old screen but detailed samples and coastline withhold ranking',()=>{
  const c=landWindowCoverage(audit.bounds,coarse),a=assessLandCoverage(audit.bounds,c,detailed,{sha256:DETAILED_MASK_SHA256});
  assert.equal(c.land,25);assert.equal(a.status,'review-required');assert.equal(a.detailed.land,2975);assert.equal(a.detailed.nonLand,1250);assert.ok(a.detailed.coastlineIntersections>0);
  assert.ok(a.detailed.examples.every(p=>!p.mappedLand));assert.match(a.limitation,/not 10-metre resolution/);
});
test('a narrow water hole between every terrain sample is detected by boundary intersection',()=>{
  const mask=polygon(-10,-10,10,10);mask.coordinates.push(polygon(.001,.001,.0012,.0012).coordinates[0]);const b=earthBounds(0,0);
  const a=assessLandCoverage(b,landWindowCoverage(b,world),mask,source);
  assert.equal(a.detailed.land,4225);assert.equal(a.detailed.coastlineIntersections,4);assert.equal(a.status,'review-required');assert.match(a.reason,/between terrain samples/);
});
test('adjacent land pieces, dateline wrapping and polar rings do not invent coastal exclusions',()=>{
  for(const [lat,lon,mask]of [[0,0,world],[0,179.99,polygon(170,-10,-170,10)],[-80,30,polygon(-180,-90,180,-60)]]){
    const b=earthBounds(lat,lon),a=assessLandCoverage(b,landWindowCoverage(b,mask),mask,source);
    assert.equal(a.detailed.land,4225);assert.equal(a.detailed.coastlineIntersections,0);assert.equal(a.status,'screened-land');
  }
});
test('land edge indexing agrees with independent ray crossings across the real Svalbard polygon',async()=>{
  const local=JSON.parse(await fs.readFile(new URL('../research/longyearbreen-audit-2026-11-15/local-land-10m.geojson',import.meta.url)));
  function ring(x,y,r){let v=false;for(let i=0,j=r.length-1;i<r.length;j=i++){if((r[i][1]>y)!==(r[j][1]>y)&&x<(r[j][0]-r[i][0])*(y-r[i][1])/(r[j][1]-r[i][1])+r[i][0])v=!v;}return v;}
  for(let r=0;r<13;r++)for(let c=0;c<13;c++){
    const lat=78.03+r*.0243,lon=14.77+c*.1187,expected=local.features.some(f=>ring(lon,lat,f.geometry.coordinates[0])&&!f.geometry.coordinates.slice(1).some(h=>ring(lon,lat,h)));
    assert.equal(isLand(lon,lat,local),expected);
  }
});
test('legacy cache is pending immediately and rechecked without fetching terrain or changing heights',async()=>{
  const site={id:audit.siteId,body:'earth',name:'Longyearbreen',country:'Svalbard',sourceIds:['terrarium','natural-earth'],useCases:[],limitations:[],origin:'manual',lat:audit.center.lat,lon:audit.center.lon,comparisonEligible:true};
  const memory={getItem(){return this.value;},setItem(k,v){this.value=v;}};assert.ok(saveSearchWindows(memory,[{site,data:audit}]));const [restored]=restoreSearchWindows(memory);
  assert.equal(comparisonStatus(restored.site,restored.data).scoreEligible,false);let fetches=0;
  globalThis.fetch=async url=>{fetches++;assert.equal(new URL(url).protocol,'file:','cached terrain must not be refetched');return new Response(await fs.readFile(new URL(url)));};
  const checked=await recheckSearchWindow(restored);assert.equal(fetches,2);assert.equal(checked.data.source.landScreening.land,25);assert.equal(checked.data.source.coverageAssessment.detailed.land,2975);
  assert.equal(checked.site.comparisonEligible,false);assert.equal(checked.data.comparisonEligible,false);assert.equal(comparisonStatus(checked.site,checked.data).scoreEligible,false);
  assert.deepEqual(checked.data.heights,audit.heights);assert.deepEqual(checked.data.source.files,audit.source.files);assert.equal(currentCoverage(checked.data),true);
  assert.equal(comparisonStatus(checked.site,{...checked.data,bounds:{...checked.data.bounds,north:79}}).scoreEligible,false,'a previous check cannot authorize a different window');
});
test('missing or corrupted detailed source keeps loaded terrain inspectable, with no fallback score',async()=>{
  for(const corrupted of [false,true]){
    clearSearchCaches();globalThis.fetch=async url=>String(url).includes('land-mask-10m')?(corrupted?new Response('{}'):new Response('missing',{status:503})):new Response(terrainPNG(0,0));
    const result=await loadEarthWindow({lat:0,lon:0,landmask:world});
    assert.equal(result.data.heights.length,4225);assert.equal(result.site.comparisonEligible,false);assert.equal(result.data.source.coverageAssessment.detailed.available,false);assert.equal(comparisonStatus(result.site,result.data).scoreEligible,false);
  }
});
test('a cleared inland cache may regain ranking only after current rechecking; unavailable masks leave it unranked',async()=>{
  const b=earthBounds(29.575,35.419),data={...audit,siteId:'custom-test',center:{lat:29.575,lon:35.419},bounds:b,coverageRecheckRequired:true},record={site:{id:'custom-test',comparisonEligible:true},data};
  globalThis.fetch=async url=>new Response(await fs.readFile(new URL(url)));
  const checked=await recheckSearchWindow(record);assert.equal(comparisonStatus(checked.site,checked.data).scoreEligible,true);
  clearSearchCaches();const unavailable=await recheckSearchWindow(record,{landmask:coarse,detailedLandmask:null});assert.equal(comparisonStatus(unavailable.site,unavailable.data).scoreEligible,false);
  assert.equal(record.data.coverageRecheckRequired,true,'rechecking must not mutate the original cached record');
});
