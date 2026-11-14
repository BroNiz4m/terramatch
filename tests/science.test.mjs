import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SITES, TARGETS, EARTH_SITES, analyzeTerrain, compareTerrains, sampleTerrain, terrainCoordinates } from '../dist/js/science.js';

const read=id=>JSON.parse(fs.readFileSync(new URL(`../dist/data/${id}-terrain.json`,import.meta.url),'utf8'));
const flat=height=>({size:5,widthMeters:2000,depthMeters:2000,heights:new Array(25).fill(height),bounds:{north:1,south:0,west:0,east:1}});
test('a flat plane has zero slope and relief, regardless of vertical datum',()=>{
  const a=analyzeTerrain(flat(-2500)),b=analyzeTerrain(flat(1200));
  assert.equal(a.slopeMean,0);assert.equal(a.relief,0);assert.equal(a.slopeHistogram[0],1);
  assert.equal(compareTerrains(a,b).score,100);
});
test('a known inclined plane produces the analytical gradient at the stated baseline',()=>{
  const data=flat(0);data.heights=data.heights.map((_,i)=>(i%5)*500*.1);
  const result=analyzeTerrain(data),expected=Math.atan(.1)*180/Math.PI;
  assert.ok(Math.abs(result.slopeMean-expected)<1e-10);
  assert.equal(result.relief,200);assert.deepEqual(result.gradientBaselineMeters,{x:1000,z:1000});
  assert.equal(result.slopeSampleCount,9);assert.equal(result.slopeHistogram[2],1);
});
test('bilinear interpolation preserves corners, midpoint and bounds',()=>{
  const data={size:2,heights:[0,10,20,30]};assert.equal(sampleTerrain(data,0,0),0);assert.equal(sampleTerrain(data,1,1),30);assert.equal(sampleTerrain(data,.5,.5),15);assert.equal(sampleTerrain(data,-1,2),20);
});
test('changing weights affects the chosen measures and cannot create an empty index',()=>{
  const a=flat(0),b=flat(0);b.heights=b.heights.map((_,i)=>i%5*20);
  assert.throws(()=>compareTerrains(a,b,{slope:0,relief:0}),/at least one/i);
  const r=compareTerrains(a,b,{slope:1,relief:0});assert.equal(r.components[0].weight,1);assert.equal(r.components[1].weight,0);assert.equal(r.score,Math.round(r.components[0].score*10)/10);
});
test('incomplete and nonfinite grids are rejected instead of silently filling values',()=>{
  assert.throws(()=>analyzeTerrain({...flat(0),heights:[0,1,2]}));const data=flat(0);data.heights[5]=NaN;assert.throws(()=>analyzeTerrain(data));
});
test('all six bundled windows have finite geolocated sourced elevations',()=>{
  assert.equal(SITES.length,6);assert.equal(TARGETS.length,2);
  for(const site of SITES){const data=read(site.id);assert.equal(data.siteId,site.id);assert.equal(data.heights.length,65*65);assert.ok(data.heights.every(Number.isFinite));assert.equal(data.widthMeters,32000);assert.equal(data.depthMeters,32000);assert.equal(data.gridSpacingMeters,500);assert.equal(data.units,'meters');assert.ok(data.source.url.startsWith('https://'));const stats=analyzeTerrain(data);assert.ok(stats.relief>0);assert.ok(Math.abs(stats.slopeHistogram.reduce((a,b)=>a+b,0)-1)<1e-10);assert.ok(stats.slopeP90>=stats.slopeMean*.5);const point=terrainCoordinates(data,.5,.5);assert.ok(Math.abs(point.lat-site.lat)<1e-5,site.id+' latitude');assert.ok(Math.abs(point.lon-site.lon)<1e-5,site.id+' longitude');}
});
test('lunar polar geolocation centers Shackleton and treats the pole correctly',()=>{
  const data=read('shackleton'),center=terrainCoordinates(data,.5,.5);assert.ok(Math.abs(center.lat+89.67)<1e-6);assert.ok(Math.abs(center.lon-129.78)<1e-6);const p=data.projection,u=-p.xWest/(p.xEast-p.xWest),v=-p.yNorth/(p.ySouth-p.yNorth);const pole=terrainCoordinates(data,u,v);assert.equal(pole.lat,-90);
});
test('coastal bathymetry never enters the terrestrial ranking',()=>{
  assert.ok(!EARTH_SITES.some(s=>s.id==='lanzarote'));assert.equal(read('lanzarote').comparisonEligible,false);assert.throws(()=>compareTerrains(read('jezero'),read('lanzarote')),/excluded/i);
});
test('terrain index is bounded, symmetric and identifies its scientific limits',()=>{
  for(const target of TARGETS)for(const earth of EARTH_SITES){const a=read(target.id),b=read(earth.id),ab=compareTerrains(a,b),ba=compareTerrains(b,a);assert.ok(ab.score>=0&&ab.score<=100);assert.equal(ab.score,ba.score);assert.equal(ab.scope,'Terrain only');assert.ok(ab.unassessed.includes('Landing or base safety'));assert.equal(compareTerrains(a,a).score,100);}
});
