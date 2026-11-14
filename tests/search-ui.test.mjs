import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
import {terrainPNG} from './fixtures/terrain-png.mjs';
import {restoreSearchWindows,saveSearchWindows,validSearchWindow} from '../dist/js/search-cache.js';
const waitFor=async(fn,label,timeout=12000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,10));}};

test('manual place, coordinates and globe selection retrieve new terrain and reach comparison/export',async()=>{
 const window=new Window({url:'http://localhost:4173/'});window.document.write(fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'));
 Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,devicePixelRatio:1,matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>queueMicrotask(()=>fn(performance.now()))});window.scrollTo=()=>{};
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},setLineDash(){},strokeRect(){},fillText(){}};
 window.HTMLCanvasElement.prototype.getContext=type=>type==='2d'?ctx:null;window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,iVBORw0KGgo=';
 const downloads=[],blobs=new Map();window.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,url:this.href});};URL.createObjectURL=blob=>{const key='blob:search-'+blobs.size;blobs.set(key,blob);return key;};URL.revokeObjectURL=()=>{};
 const requestedTiles=new Set();let placeRequests=0,failTiles=false;
 globalThis.fetch=async(input,{signal}={})=>{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const url=new URL(String(input));
  if(url.protocol==='file:')return new Response(fs.readFileSync(url),{status:200});
  if(url.hostname==='geocoding-api.open-meteo.com'){placeRequests++;return Response.json({results:[{id:1,name:'Test Oasis',country:'Algeria',latitude:24.72,longitude:10.42}]});}
  if(url.hostname==='s3.amazonaws.com'){if(failTiles)throw Error('Test terrain service unavailable');requestedTiles.add(url.href);const match=url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);assert.ok(match);return new Response(terrainPNG(Number(match[2]),Number(match[3])),{headers:{'Content-Type':'image/png'}});}
  throw Error('Unexpected external request: '+url);
 };
 const errors=[],oldError=console.error;window.addEventListener('error',e=>errors.push(e.error?.stack||e.message));console.error=(...args)=>{if(!args.join(' ').includes('Error creating WebGL context'))errors.push(args.join(' '));};
 try{
  await import('../dist/js/app.js');await waitFor(()=>window.__TERRAMATCH__,'initialization');const api=window.__TERRAMATCH__;
  assert.ok(document.querySelector('#discovery-panel'));assert.equal(api.state.customSites.length,0);
  document.querySelector('#place-query').value='Test Oasis';document.querySelector('#manual-search-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  await waitFor(()=>document.querySelector('#analyze-manual-area'),'place selection');assert.equal(placeRequests,1);document.querySelector('#analyze-manual-area').click();
  await waitFor(()=>document.querySelector('#compare-manual-result'),'manual terrain result');assert.equal(api.state.customSites.length,1);const id=api.state.earthId;assert.match(id,/^custom-/);assert.ok(validSearchWindow({site:api.state.customSites[0],data:api.state.terrains.get(id)}));assert.ok(requestedTiles.size>0);
  document.querySelector('#compare-manual-result').click();assert.equal(api.state.view,'compare');assert.match(document.querySelector('#comparison-workspace').textContent,/Test Oasis/);document.querySelector('#download-evidence').click();const evidence=JSON.parse(await blobs.get(downloads.at(-1).url).text());assert.equal(evidence.discovery.selectedCandidateOrigin,'manual');assert.equal(evidence.provenance.candidate.id,'terrarium');assert.ok(evidence.provenance.candidate.files[0].sha256.length===64);
  assert.equal(evidence.rankingContext.scope.rankedCount,4);assert.equal(evidence.rankingContext.scope.loadedCount,5);assert.ok(evidence.rankingContext.scope.rankedCandidateIds.includes(id));assert.match(document.querySelector('#ranking-context .ranking-context-scope').textContent,/4 eligible loaded/);
  document.querySelector('[data-view="explore"]').click();document.querySelector('#pick-earth-point').click();api.searchUI.receivePoint({lat:30,lon:35});assert.match(document.querySelector('#manual-selection').textContent,/Globe-selected location/);assert.match(document.querySelector('#place-query').value,/30.00000/);
  document.querySelector('#place-query').value='91, 20';document.querySelector('#manual-search-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await waitFor(()=>!document.querySelector('#discovery-error').classList.contains('hidden'),'invalid coordinate error');assert.equal(api.state.customSites.length,1);assert.equal(placeRequests,1,'invalid coordinates never leak into a place-name request');
  await new Promise(resolve=>setTimeout(resolve,350));assert.equal(restoreSearchWindows(localStorage).length,1);assert.deepEqual(errors,[]);
  // Automatic mode is exercised next using the same application's new-window path.
  document.querySelector('[data-search-tab="automatic"]').click();document.querySelector('#scan-region').value='middleeast';document.querySelector('#scan-region').dispatchEvent(new window.Event('change'));document.querySelector('#scan-budget').value='12';document.querySelector('#run-automatic-search').click();
  api.state.weights={slope:1,relief:0};
  await waitFor(()=>api.state.searchCoverage,'automatic survey',25000);assert.ok(api.state.customSites.some(s=>s.origin==='automatic'));assert.ok(api.state.searchCoverage.completed>0);assert.equal(api.state.searchCoverage.exhaustive,false);assert.deepEqual(api.state.searchCoverage.weights,{slope:.65,relief:.35},'survey provenance retains its starting weights even when current controls change');assert.ok(document.querySelectorAll('[data-scan-result]').length>0);assert.equal(placeRequests,1,'grid scanning does not perform geocoding');document.querySelector('[data-scan-result]').click();assert.equal(api.state.view,'compare');assert.match(api.state.earthId,/^custom-/);assert.deepEqual(api.state.customSites.find(site=>site.id===api.state.earthId).discovery.weights,{slope:.65,relief:.35});
  // A genuinely coastal mask result uses the same Compare entry point as inland results.
  document.querySelector('[data-view="explore"]').click();document.querySelector('[data-search-tab="manual"]').click();
  document.querySelector('#place-query').value='1.5535, 110.3593';document.querySelector('#manual-search-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
  await waitFor(()=>document.querySelector('#analyze-manual-area'),'coastal selection');document.querySelector('#analyze-manual-area').click();
  await waitFor(()=>document.querySelector('#compare-manual-result'),'coastal loaded');const coastalId=api.state.earthId;
  assert.equal(api.state.terrains.get(coastalId).comparisonEligible,false);assert.ok(!api.state.rankings.some(r=>r.site.id===coastalId));
  assert.match(document.querySelector('#manual-selection').textContent,/COVERAGE REVIEW REQUIRED/);document.querySelector('#compare-manual-result').click();
  assert.equal(api.state.earthId,coastalId);assert.deepEqual(errors,[]);assert.equal(api.state.view,'compare');assert.ok(document.querySelector('#coverage-review'),'coverage banner rendered');assert.equal(document.querySelector('#comparison-earth').value,coastalId);assert.match(document.querySelector('#comparison-earth').selectedOptions[0].textContent,/Coverage review required/);
  assert.match(document.querySelector('#coverage-review').textContent,/22 \/ 25/);assert.equal(document.querySelectorAll('#coverage-review tbody tr').length,25);
  assert.equal([...document.querySelectorAll('#coverage-review tbody tr')].filter(row=>row.textContent.includes('Non-land sample')).length,3);
  assert.match(document.querySelector('#coverage-review').textContent,/entire 32 × 32 km DEM window/);assert.equal(document.querySelector('#comparison-method'),null);
  assert.equal(document.querySelectorAll('#comparison-workspace .chart-svg').length,2);assert.equal(document.querySelectorAll('.coverage-review-list .score-bar').length,0);
  document.querySelector('[data-review-source]').click();assert.match(document.querySelector('.modal').textContent,/landScreening/);document.querySelector('.modal-close').click();
  document.querySelector('#download-evidence').click();const reviewEvidence=JSON.parse(await blobs.get(downloads.at(-1).url).text());
  assert.equal(reviewEvidence.comparison.status,'coverage-review-required');assert.equal(reviewEvidence.comparison.score,null);assert.equal(reviewEvidence.comparison.similarity,null);assert.deepEqual(reviewEvidence.comparison.components,[]);assert.equal(reviewEvidence.coverageReview.screening.samples.length,25);
  assert.equal(reviewEvidence.rankingContext.selected.rank,null);assert.equal(reviewEvidence.rankingContext.selected.gapFromLeadingPoints,null);assert.equal(reviewEvidence.rankingContext.selected.score,null);assert.ok(reviewEvidence.rankingContext.scope.excludedCandidateIds.includes(coastalId));assert.ok(!reviewEvidence.rankingContext.scope.rankedCandidateIds.includes(coastalId));assert.equal(reviewEvidence.rankingContext.scope.rankedCount,api.state.rankings.length);assert.equal(reviewEvidence.rankingContext.scope.loadedCount,api.state.customSites.length+4);assert.match(document.querySelector('#ranking-context .ranking-context-selected').textContent,/unranked/);
  document.querySelector('#compare-export').click();const reviewReport=await blobs.get(downloads.at(-1).url).text();assert.match(reviewReport,/Terrain resemblance index: withheld/);assert.doesNotMatch(reviewReport,/index: (?:0|null|NaN)\/100/);
  document.querySelector('#toggle-expedition-evidence').click();assert.match(document.querySelector('#expedition-evidence').textContent,/Coverage review required/);assert.match(document.querySelector('#expedition-evidence').textContent,/Withheld/);
  // Old cached summaries remain inspectable without fabricating point coordinates.
  const legacy={site:structuredClone(api.state.customSites.find(site=>site.id===coastalId)),data:structuredClone(api.state.terrains.get(coastalId))};delete legacy.data.source.landScreening.samples;
  saveSearchWindows(localStorage,[legacy]);const restored=restoreSearchWindows(localStorage);assert.equal(restored.length,1);api.registerSearchWindow(restored[0],{persist:false});
  assert.match(document.querySelector('#coverage-review').textContent,/cached record has summary coverage only/);assert.equal(document.querySelectorAll('#coverage-review tbody tr').length,0);
  // Switching back to an eligible window restores its existing numerical score.
  const selector=document.querySelector('#comparison-earth');selector.value=id;selector.dispatchEvent(new window.Event('change'));
  assert.equal(document.querySelector('#coverage-review'),null);assert.match(document.querySelector('#comparison-workspace').textContent,/Terrain resemblance index: [\d.]+ \/ 100/);
  // A survey containing only review windows still offers evidence, without a fake score or error.
  document.querySelector('[data-view="explore"]').click();document.querySelector('[data-search-tab="automatic"]').click();document.querySelector('#draw-search-region').click();
  api.searchUI.receivePoint({lat:1.49,lon:110.30});api.searchUI.receivePoint({lat:1.61,lon:110.42});api.state.searchCoverage=null;document.querySelector('#run-automatic-search').click();
  await waitFor(()=>api.state.searchCoverage,'all-review survey');assert.equal(api.state.searchCoverage.completed,1);assert.equal(api.state.searchCoverage.excluded,1);assert.equal(api.state.searchCoverage.candidateIds.length,1);
  assert.match(document.querySelector('#automatic-results').textContent,/Coverage review required/);assert.doesNotMatch(document.querySelector('#automatic-results').textContent,/\/ 100 terrain index/);assert.ok(document.querySelector('#discovery-error').classList.contains('hidden'));
  document.querySelector('[data-scan-result]').click();assert.match(document.querySelector('#coverage-review').textContent,/Terrain score and ranking withheld/);assert.ok(!api.state.rankings.some(r=>r.site.id===api.state.earthId));
  assert.equal(api.state.customSites.find(site=>site.id===api.state.earthId).discovery.status,'complete');
  // A failed fetch never registers another window or assigns a score.
  document.querySelector('[data-view="explore"]').click();document.querySelector('[data-search-tab="manual"]').click();failTiles=true;const beforeFailure=api.state.customSites.length;
  document.querySelector('#place-query').value='-24.5, -69.25';document.querySelector('#manual-search-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await waitFor(()=>document.querySelector('#analyze-manual-area'),'failed-fetch selection');document.querySelector('#analyze-manual-area').click();
  await waitFor(()=>!document.querySelector('#discovery-error').classList.contains('hidden'),'failed-fetch error');assert.equal(api.state.customSites.length,beforeFailure);assert.equal(document.querySelector('#compare-manual-result'),null);assert.deepEqual(errors,[]);
 }finally{console.error=oldError;await window.happyDOM.close();}
});

test('search cache rejects corrupt scientific data and survives unavailable storage',()=>{
 assert.equal(validSearchWindow({}),false);assert.deepEqual(restoreSearchWindows({getItem(){return'{broken';}}),[]);assert.deepEqual(restoreSearchWindows(null),[]);
});
