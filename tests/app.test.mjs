import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Window } from 'happy-dom';
import {SITES} from '../dist/js/science.js';

// Exercise real DOM event handlers and scientific exports without pretending this
// is a visual/WebGL browser test. 3D geometry has its own separate tests.
test('mission, comparison, source records, filters and exports work together',async()=>{
  const browser=new Window({url:'http://localhost:4173/'});
  browser.document.write(fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'));
  Object.assign(globalThis,{window:browser,document:browser.document,localStorage:browser.localStorage,devicePixelRatio:1,matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){} disconnect(){}},requestAnimationFrame:fn=>queueMicrotask(()=>fn(performance.now()))});
  browser.scrollTo=()=>{};
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},setLineDash(){},strokeRect(){},fillText(){}};
  browser.HTMLCanvasElement.prototype.getContext=function(type){return type==='2d'?ctx:null;};
  browser.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,iVBORw0KGgo=';
  const downloads=[];browser.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,url:this.href});};
  const blobs=new Map();URL.createObjectURL=blob=>{const key='blob:test-'+blobs.size;blobs.set(key,blob);return key;};URL.revokeObjectURL=()=>{};
  globalThis.fetch=async url=>{const path=new URL(String(url));if(path.protocol!=='file:')throw Error('Only local bundled data permitted in this test.');return new Response(fs.readFileSync(path),{status:200,headers:{'Content-Type':'application/json'}});};
  const errors=[],oldError=console.error;console.error=(...args)=>{if(!args.join(' ').includes('Error creating WebGL context'))errors.push(args.join(' '));};
  try{
    await import('../dist/js/app.js');
    for(let i=0;i<100&&!browser.__TERRAMATCH__;i++)await new Promise(resolve=>setTimeout(resolve,5));
    const api=browser.__TERRAMATCH__;assert.ok(api,'app initialization finished');assert.equal(api.state.terrains.size,6);assert.equal(api.state.ready,true);assert.equal(api.state.rankings.length,3);assert.equal(document.querySelectorAll('.candidate-card').length,3);
    assert.ok(!api.state.rankings.some(r=>r.site.id==='lanzarote'));
    document.querySelector('[data-view="compare"]').click();assert.equal(api.state.view,'compare');assert.equal(document.querySelectorAll('.chart-svg').length,2);assert.match(document.querySelector('#comparison-workspace').textContent,/Terrain resemblance index/);
    const target=document.querySelector('#comparison-target');target.value='shackleton';target.dispatchEvent(new browser.Event('change'));assert.equal(api.state.targetId,'shackleton');assert.equal(api.state.body,'moon');assert.match(document.querySelector('#comparison-workspace').textContent,/Shackleton/);
    const earth=document.querySelector('#comparison-earth');earth.value='al-wahbah';earth.dispatchEvent(new browser.Event('change'));assert.equal(api.state.earthId,'al-wahbah');
    const task=document.querySelector('#task-select');task.value='navigation';task.dispatchEvent(new browser.Event('change'));assert.deepEqual(api.state.weights,{slope:.85,relief:.15});assert.match(document.querySelector('#task-panel').textContent,/Navigation training/);assert.match(document.querySelector('#task-panel').textContent,/Ground under 10° slope/);assert.match(document.querySelector('#task-brief').textContent,/85% slope distribution/);
    task.value='thermal';task.dispatchEvent(new browser.Event('change'));assert.equal(api.state.task,'thermal');
    await Promise.all(['shackleton','al-wahbah'].map(id=>api.thermalUI.load(SITES.find(site=>site.id===id))));
    assert.match(document.querySelector('#thermal-workspace').textContent,/DAILY MEANS/);assert.match(document.querySelector('#thermal-workspace').textContent,/ANNUAL SURFACE MAXIMUM/);
    document.querySelector('#download-evidence').click();assert.match(downloads.at(-1).name,/shackleton-al-wahbah-evidence.json/);const evidence=JSON.parse(await blobs.get(downloads.at(-1).url).text());assert.equal(evidence.target.id,'shackleton');assert.equal(evidence.task.id,'thermal');assert.equal(evidence.task.calibrated,false);assert.deepEqual(evidence.weights,{slope:.65,relief:.35});assert.equal(evidence.candidate.id,'al-wahbah');assert.equal(evidence.comparison.scope,'Terrain only');assert.ok(evidence.provenance.target.url.includes('lola'));assert.equal(evidence.thermal.temperatureRankingApplied,false);assert.equal(evidence.thermal.target.available,true);assert.equal(evidence.thermal.candidate.series.length,365);assert.equal(evidence.thermal.candidate.metric.id,'TS');
    document.querySelector('#compare-export').click();const report=await blobs.get(downloads.at(-1).url).text();assert.match(report,/Shackleton region/);assert.match(report,/## Exploration task/);assert.match(report,/Al Wahbah/);assert.match(report,/1 km slope baseline/);assert.match(report,/not a probability/);
    document.querySelector('[data-view="sources"]').click();assert.ok(document.querySelectorAll('.source-card').length>=15);assert.match(document.querySelector('#sources-content').textContent,/Excluded: coastal bathymetry/);document.querySelector('[data-source-site="jezero"]').click();assert.ok(document.querySelector('[role="dialog"]'));assert.match(document.querySelector('.modal').textContent,/MOLA/);document.querySelector('.modal-close').click();assert.equal(document.querySelector('[role="dialog"]'),null);
    document.querySelector('[data-view="explore"]').click();document.querySelector('#metric-relief').checked=false;document.querySelector('#find-analogs').click();assert.equal(api.state.weights.slope,.65);assert.equal(api.state.weights.relief,0);document.querySelector('#metric-slope').checked=false;document.querySelector('#find-analogs').click();assert.match(document.querySelector('#toast-region').textContent,/Choose at least one/);
    // An empty terrain selection cannot silently apply a task preset and re-rank.
    const previousTask=api.state.task,previousWeights={...api.state.weights},previousRankings=api.state.rankings;
    task.value='navigation';task.dispatchEvent(new browser.Event('change'));
    assert.equal(api.state.task,previousTask);assert.equal(task.value,previousTask,'rejected task restores the visible selection');assert.deepEqual(api.state.weights,previousWeights);assert.equal(api.state.rankings,previousRankings,'invalid task change leaves the existing comparison intact');assert.equal(document.querySelector('#metric-slope').checked,false);assert.equal(document.querySelector('#metric-relief').checked,false);assert.match(document.querySelector('#toast-region').textContent,/before changing tasks/);
    // A single enabled measure stays enabled on its own through task changes.
    document.querySelector('#metric-slope').checked=true;task.value='navigation';task.dispatchEvent(new browser.Event('change'));assert.equal(api.state.task,'navigation');assert.deepEqual(api.state.weights,{slope:.85,relief:0});assert.match(document.querySelector('#task-brief').textContent,/100% slope distribution, 0% relative relief/);
    document.querySelector('#metric-slope').checked=false;document.querySelector('#metric-relief').checked=true;task.value='fieldwork';task.dispatchEvent(new browser.Event('change'));assert.deepEqual(api.state.weights,{slope:0,relief:.5});assert.match(document.querySelector('#task-brief').textContent,/0% slope distribution, 100% relative relief/);
    document.querySelector('#metric-slope').checked=true;task.value='navigation';task.dispatchEvent(new browser.Event('change'));assert.deepEqual(api.state.weights,{slope:.85,relief:.15});
    assert.deepEqual(errors,[],'no unexpected initialization or event-handler errors');
  }finally{console.error=oldError;await browser.happyDOM.close();}
});
