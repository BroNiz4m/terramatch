import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {comparisonStatus} from '../dist/js/comparison-status.js';
import {compareTerrains} from '../dist/js/science.js';
import {landWindowCoverage} from '../dist/js/terrain-search.js';
import {earthBounds} from '../dist/js/search-ui.js';

test('any explicit site, terrain or source-screen exclusion withholds scoring',()=>{
  const terrain=JSON.parse(fs.readFileSync(new URL('../dist/data/wadi-rum-terrain.json',import.meta.url)));
  assert.equal(comparisonStatus({},terrain).scoreEligible,true);
  assert.equal(comparisonStatus({comparisonEligible:false},terrain).status,'coverage-review-required');
  assert.equal(comparisonStatus({}, {...terrain,comparisonEligible:false}).scoreEligible,false);
  const sourceExcluded={...terrain,comparisonEligible:true,source:{...terrain.source,landScreening:{allLand:false,land:24,total:25}}};
  assert.equal(comparisonStatus({comparisonEligible:true},sourceExcluded).scoreEligible,false);
  assert.throws(()=>compareTerrains(terrain,sourceExcluded),/coverage needs review/);
});

test('Kuching example exposes the actual coarse-mask sample locations without classifying the whole city',()=>{
  const mask=JSON.parse(fs.readFileSync(new URL('../dist/data/land-mask.geojson',import.meta.url)));
  const screen=landWindowCoverage(earthBounds(1.5535,110.3593),mask);
  assert.equal(screen.land,22);assert.equal(screen.samples.length,25);
  const nonLand=screen.samples.filter(p=>!p.mappedLand);
  assert.deepEqual(nonLand.map(p=>[p.row,p.col]),[[0,2],[0,3],[0,4]]);
  assert.ok(nonLand.every(p=>Math.abs(p.lat-1.6973912582)<1e-9));
  assert.ok(screen.samples.find(p=>p.row===2&&p.col===2).mappedLand,'the center is on mapped land');
  assert.match(comparisonStatus({}, {source:{landScreening:screen}}).reason,/does not classify the whole location/);
});
