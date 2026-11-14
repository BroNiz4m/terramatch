import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
import {createThermalUI,thermalChart,THERMAL_LIMIT} from '../dist/js/thermal-ui.js';
import {thermalColor} from '../dist/js/thermal-colors.js';

test('thermal objective loads source records, survives a late old selection and exports physical definitions',async()=>{
  const browser=new Window();globalThis.document=browser.document;
  document.body.innerHTML='<div id="compare-view"><div id="thermal-workspace"></div></div><div id="thermal-mission-prompt"></div><div id="thermal-scene"></div>';
  const earth={id:'wadi-rum',body:'earth',name:'Wadi Rum'},moon={id:'shackleton',body:'moon',name:'Shackleton'},mars={id:'jezero',body:'mars',name:'Jezero'};
  let target=mars,resolveMars;const pendingMars=new Promise(resolve=>resolveMars=resolve);
  const earthRecord=JSON.parse(fs.readFileSync(new URL('../dist/data/earth-thermal-wadi-rum.json',import.meta.url)));
  const moonRecord={available:true,body:'moon',siteId:'shackleton',statistic:'Annual surface maximum',temporal:{label:'Historical thermal-model fit'},summary:{minK:80,maxK:300,validCount:4},raster:{},source:{title:'Diviner',url:'https://pds-geosciences.wustl.edu/'},comparability:{scoreEligible:false}};
  const expedition={site:earth,layer:'surface',setLayer(layer){this.layer=layer;},setThermalField(field){this.field=field;},recolor(){},telemetry:()=>({siteId:'wadi-rum',lat:29.575,lon:35.419})};
  let compareCount=0;const calls=[];
  const ui=createThermalUI({getTarget:()=>target,getEarth:()=>earth,getExpedition:()=>expedition,showCompare:()=>compareCount++,loadEarth:async site=>{calls.push(site.id);return earthRecord;},loadPlanet:async site=>site.id==='jezero'?pendingMars:moonRecord});
  ui.setMission('thermal');assert.match(document.querySelector('#thermal-mission-prompt').textContent,/ranking still measures terrain/);
  target=moon;ui.selectionChanged();await ui.load(moon);await ui.load(earth);
  resolveMars({available:false,siteId:'jezero',reason:'No validated product'});await ui.load(mars);
  assert.match(document.querySelector('#thermal-workspace').textContent,/Shackleton/);assert.doesNotMatch(document.querySelector('#thermal-workspace').textContent,/Jezero/);
  assert.match(document.querySelector('#thermal-workspace').textContent,/not the coldest night or hottest afternoon/);
  const evidence=ui.snapshot();assert.equal(evidence.temperatureRankingApplied,false);assert.equal(evidence.candidate.series.length,365);assert.equal(evidence.comparability.scoreEligible,false);assert.equal(evidence.candidate.source.rawResponseSHA256,earthRecord.source.rawResponseSHA256);assert.ok(ui.report().includes(THERMAL_LIMIT));
  await ui.activateLayer();assert.equal(expedition.layer,'temperature');assert.equal(expedition.field.sample(0,0),earthRecord.series[0].valueK);assert.equal(expedition.field.sample(29.575,35.419),earthRecord.series[0].valueK,'coarse context is uniform, without fabricated fine-scale variation');assert.match(document.querySelector('#thermal-scene').textContent,/not a spatial temperature map/);
  let slider=document.querySelector('#thermal-day');slider.value='200';slider.dispatchEvent(new browser.Event('input'));assert.equal(document.querySelector('#thermal-day'),slider,'pointer drag keeps the original range input');assert.equal(expedition.field.sample(0,0),earthRecord.series[200].valueK);assert.equal(ui.inspect(expedition.telemetry()).recordDate,earthRecord.series[200].time);assert.match(ui.inspectionHTML(expedition.telemetry()),/Coarse location context/);
  document.querySelector('#scene-thermal-compare').click();assert.equal(compareCount,1);
  expedition.site=mars;await ui.activateLayer();assert.equal(expedition.field,null);assert.match(document.querySelector('#thermal-scene').textContent,/No spatial thermal layer/);assert.equal(ui.inspect({siteId:'jezero',lat:0,lon:0}).available,false);
  ui.hideLayer();assert.ok(document.querySelector('#thermal-scene').classList.contains('hidden'));assert.equal(calls.length,1,'repeated selection uses a single loaded record');await browser.happyDOM.close();
});

test('thermal charts preserve gaps and the absolute palette never converts missing data into temperature',()=>{
  const svg=thermalChart([{time:'A',valueK:280},{time:'B',valueK:285},{time:'C',valueK:null},{time:'D',valueK:290},{time:'E',valueK:295}],'Daily means');
  assert.equal((svg.match(/<polyline /g)||[]).length,2);assert.match(svg,/gaps represent missing/);const isolated=thermalChart([{time:'A',valueK:280},{time:'B',valueK:null},{time:'C',valueK:290}],'Isolated samples');assert.equal((isolated.match(/<circle /g)||[]).length,2);
  assert.deepEqual(thermalColor(null),[.28,.32,.35]);assert.notDeepEqual(thermalColor(40),thermalColor(null));assert.deepEqual(thermalColor(10),thermalColor(40));assert.deepEqual(thermalColor(900),thermalColor(400));assert.ok(thermalColor(273.15).every(c=>Number.isFinite(c)&&c>=0&&c<=1));
});
