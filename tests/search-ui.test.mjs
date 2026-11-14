import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
import {terrainPNG} from './fixtures/terrain-png.mjs';
import {restoreSearchWindows,validSearchWindow} from '../dist/js/search-cache.js';
const waitFor=async(fn,label,timeout=12000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,10));}};

test('manual place, coordinates and globe selection retrieve new terrain and reach comparison/export',async()=>{
 const window=new Window({url:'http://localhost:4173/'});window.document.write(fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'));
 Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,devicePixelRatio:1,matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>queueMicrotask(()=>fn(performance.now()))});window.scrollTo=()=>{};
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},setLineDash(){},strokeRect(){},fillText(){}};
 window.HTMLCanvasElement.prototype.getContext=type=>type==='2d'?ctx:null;window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,iVBORw0KGgo=';
 const downloads=[],blobs=new Map();window.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,url:this.href});};URL.createObjectURL=blob=>{const key='blob:search-'+blobs.size;blobs.set(key,blob);return key;};URL.revokeObjectURL=()=>{};
 const requestedTiles=new Set();let placeRequests=0;
 globalThis.fetch=async(input,{signal}={})=>{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const url=new URL(String(input));
  if(url.protocol==='file:')return new Response(fs.readFileSync(url),{status:200});
  if(url.hostname==='geocoding-api.open-meteo.com'){placeRequests++;return Response.json({results:[{id:1,name:'Test Oasis',country:'Algeria',latitude:24.72,longitude:10.42}]});}
  if(url.hostname==='s3.amazonaws.com'){requestedTiles.add(url.href);const match=url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);assert.ok(match);return new Response(terrainPNG(Number(match[2]),Number(match[3])),{headers:{'Content-Type':'image/png'}});}
  throw Error('Unexpected external request: '+url);
 };
 const errors=[],oldError=console.error;console.error=(...args)=>{if(!args.join(' ').includes('Error creating WebGL context'))errors.push(args.join(' '));};
 try{
  await import('../dist/js/app.js');await waitFor(()=>window.__TERRAMATCH__,'initialization');const api=window.__TERRAMATCH__;
  assert.ok(document.querySelector('#discovery-panel'));assert.equal(api.state.customSites.length,0);
  document.querySelector('#place-query').value='Test Oasis';document.querySelector('#manual-search-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  await waitFor(()=>document.querySelector('#analyze-manual-area'),'place selection');assert.equal(placeRequests,1);document.querySelector('#analyze-manual-area').click();
  await waitFor(()=>document.querySelector('#compare-manual-result'),'manual terrain result');assert.equal(api.state.customSites.length,1);const id=api.state.earthId;assert.match(id,/^custom-/);assert.ok(validSearchWindow({site:api.state.customSites[0],data:api.state.terrains.get(id)}));assert.ok(requestedTiles.size>0);
  document.querySelector('#compare-manual-result').click();assert.equal(api.state.view,'compare');assert.match(document.querySelector('#comparison-workspace').textContent,/Test Oasis/);document.querySelector('#download-evidence').click();const evidence=JSON.parse(await blobs.get(downloads.at(-1).url).text());assert.equal(evidence.discovery.selectedCandidateOrigin,'manual');assert.equal(evidence.provenance.candidate.id,'terrarium');assert.ok(evidence.provenance.candidate.files[0].sha256.length===64);
  document.querySelector('[data-view="explore"]').click();document.querySelector('#pick-earth-point').click();api.searchUI.receivePoint({lat:30,lon:35});assert.match(document.querySelector('#manual-selection').textContent,/Globe-selected location/);assert.match(document.querySelector('#place-query').value,/30.00000/);
  document.querySelector('#place-query').value='91, 20';document.querySelector('#manual-search-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await waitFor(()=>!document.querySelector('#discovery-error').classList.contains('hidden'),'invalid coordinate error');assert.equal(api.state.customSites.length,1);assert.equal(placeRequests,1,'invalid coordinates never leak into a place-name request');
  await new Promise(resolve=>setTimeout(resolve,350));assert.equal(restoreSearchWindows(localStorage).length,1);assert.deepEqual(errors,[]);
  // Automatic mode is exercised next using the same application's new-window path.
  document.querySelector('[data-search-tab="automatic"]').click();document.querySelector('#scan-region').value='middleeast';document.querySelector('#scan-region').dispatchEvent(new window.Event('change'));document.querySelector('#scan-budget').value='12';document.querySelector('#run-automatic-search').click();
  api.state.weights={slope:1,relief:0};
  await waitFor(()=>api.state.searchCoverage,'automatic survey',25000);assert.ok(api.state.customSites.some(s=>s.origin==='automatic'));assert.ok(api.state.searchCoverage.completed>0);assert.equal(api.state.searchCoverage.exhaustive,false);assert.deepEqual(api.state.searchCoverage.weights,{slope:.65,relief:.35},'survey provenance retains its starting weights even when current controls change');assert.ok(document.querySelectorAll('[data-scan-result]').length>0);assert.equal(placeRequests,1,'grid scanning does not perform geocoding');document.querySelector('[data-scan-result]').click();assert.equal(api.state.view,'compare');assert.match(api.state.earthId,/^custom-/);assert.deepEqual(api.state.customSites.find(site=>site.id===api.state.earthId).discovery.weights,{slope:.65,relief:.35});
 }finally{console.error=oldError;await window.happyDOM.close();}
});

test('search cache rejects corrupt scientific data and survives unavailable storage',()=>{
 assert.equal(validSearchWindow({}),false);assert.deepEqual(restoreSearchWindows({getItem(){return'{broken';}}),[]);assert.deepEqual(restoreSearchWindows(null),[]);
});
