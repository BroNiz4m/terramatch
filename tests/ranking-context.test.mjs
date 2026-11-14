import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describeRanking,rankingMessages,rankingContextReport} from '../dist/js/ranking-context.js';
import {SITES,EARTH_SITES,compareTerrains} from '../dist/js/science.js';
const data=id=>JSON.parse(fs.readFileSync(new URL(`../dist/data/${id}-terrain.json`,import.meta.url)));
const rank=(id,weights)=>EARTH_SITES.map(site=>({site,...compareTerrains(data(id),data(site.id),weights)})).sort((a,b)=>b.score-a.score);
const options={loadedCandidateIds:['wadi-rum','al-wahbah','amboy','lanzarote'],excludedCandidateIds:['lanzarote']};

test('Gale explains the actual 1.2-point leading gap and saturation without altering results',()=>{
  const rankings=rank('gale-bradbury',{slope:.65,relief:.35}),before=JSON.stringify(rankings);
  const context=describeRanking(rankings,{...options,selectedId:'amboy'}),messages=rankingMessages(context);
  assert.equal(context.firstSecondGapPoints,1.2);assert.equal(context.selected.gapFromLeadingPoints,1.2);assert.equal(context.selected.rank,2);
  assert.equal(context.relief.allSaturated,true);assert.equal(context.relief.saturatedCount,3);assert.match(messages.relief,/cannot distinguish them/);assert.match(messages.relief,/slope distribution/);
  assert.match(messages.scope,/3 eligible loaded/);assert.match(messages.scope,/4 loaded/);assert.match(messages.limits,/No uncertainty or statistical-significance threshold/);assert.equal(context.significanceAssessed,false);
  assert.equal(JSON.stringify(rankings),before,'explanation never mutates a score, component, array or ordering');
});

test('relief-only ties get shared ranks and no unique leader for both saturated targets',()=>{
  for(const id of ['gale-bradbury','shackleton']){
    const weights={slope:0,relief:1},rankings=rank(id,weights),context=describeRanking(rankings,{...options,weights,selectedId:'amboy'}),messages=rankingMessages(context);
    assert.deepEqual(context.rows.map(r=>r.rank),[1,1,1]);assert.ok(context.rows.every(r=>r.tied&&r.score===0));assert.equal(context.topTie,true);assert.equal(context.firstSecondGapPoints,0);
    assert.match(messages.leading,/No unique leader/);assert.match(messages.relief,/With relief only, all scores are 0.0/);assert.match(rankingContextReport(context),/Tied 1/);
  }
});

test('rounded ties use displayed values and stable source order, including on-demand candidates',()=>{
  const weights={slope:.16,relief:.84},actual=rank('cabeus-center',weights),context=describeRanking(actual,{...options,weights});
  assert.equal(context.topTie,true);assert.equal(context.firstSecondGapPoints,0);assert.deepEqual(context.rows.map(r=>r.rank),[1,1,3]);assert.ok(context.rows.slice(0,2).every(r=>r.tied));
  const synthetic=[{site:{id:'custom-a',name:'Searched A'},score:50,reliefDistance:.4},{site:{id:'custom-b',name:'Searched B'},score:50,reliefDistance:.3},{site:{id:'custom-c',name:'Searched C'},score:49.9,reliefDistance:1}];
  const snap=JSON.stringify(synthetic),searched=describeRanking(synthetic,{selectedId:'custom-b'});assert.deepEqual(searched.rows.map(r=>r.rank),[1,1,3]);assert.deepEqual(searched.topCandidateIds,['custom-a','custom-b']);assert.equal(searched.selected.rank,1);assert.equal(JSON.stringify(synthetic),snap);
});

test('empty/single candidate sets and excluded selections never invent ranks or gaps',()=>{
  const none=describeRanking([],{selectedId:'custom-review',loadedCandidateIds:['custom-review'],excludedCandidateIds:['custom-review']});assert.equal(none.firstSecondGapPoints,null);assert.equal(none.relief.allSaturated,false);assert.equal(none.selected.score,null);assert.equal(none.selected.rank,null);assert.match(rankingMessages(none).leading,/No eligible loaded/);
  const one=describeRanking([{site:{id:'a',name:'Only window'},score:50,reliefDistance:.4}],{selectedId:'custom-review',loadedCandidateIds:['a','custom-review'],excludedCandidateIds:['custom-review']});assert.equal(one.firstSecondGapPoints,null);assert.match(rankingMessages(one).leading,/unavailable/);assert.equal(one.selected.rank,null);assert.equal(one.scope.rankedCount,1);assert.equal(one.scope.coverageReviewCount,1);
});

test('disabled relief and partial caps remain distinct from all-candidate saturation',()=>{
  const rankings=rank('gale-bradbury',{slope:1,relief:0}),off=describeRanking(rankings,{...options,weights:{slope:1,relief:0},selectedId:'wadi-rum'});assert.equal(off.relief.active,false);assert.equal(off.relief.allSaturated,true);assert.match(rankingMessages(off).relief,/switched off/);assert.doesNotMatch(rankingMessages(off).relief,/ranking come from/);
  const partial=describeRanking(rank('cabeus-center',{slope:.65,relief:.35}),{...options});assert.equal(partial.relief.allSaturated,false);assert.deepEqual(partial.relief.saturatedCandidateIds,['al-wahbah']);assert.match(rankingMessages(partial).relief,/1 of 3/);
});
