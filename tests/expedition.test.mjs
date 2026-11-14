import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
import {Expedition} from '../dist/js/expedition.js';
import {SITES,analyzeTerrain} from '../dist/js/science.js';
import {samplePlanetaryThermal} from '../dist/js/planetary-thermal.js';
import {thermalColor} from '../dist/js/thermal-colors.js';
import * as THREE from '../dist/vendor/three.module.js';

test('arrival, opening hatch, walking, keyboard inspection, comparison and pause form one working sequence',async()=>{
  const window=new Window();window.document.body.innerHTML='<div id="host"></div><canvas id="map" width="240" height="180"></canvas>';
  Object.assign(globalThis,{window,document:window.document,devicePixelRatio:1,ResizeObserver:class{observe(){}}});
  const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},drawImage(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},strokeRect(){},save(){},translate(){},rotate(){},closePath(){},restore(){},fillText(){}};
  window.HTMLCanvasElement.prototype.getContext=()=>context;
  let renderCount=0;const stages=[],inspections=[];let compared=0;
  const renderer={domElement:document.createElement('canvas'),shadowMap:{},setPixelRatio(){},setSize(){},setAnimationLoop(fn){this.animationLoop=fn;},render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);renderCount++;}};
  const host=document.querySelector('#host');host.getBoundingClientRect=()=>({width:1000,height:650});
  let expedition;expedition=new Expedition({container:host,minimap:document.querySelector('#map'),rendererFactory:()=>renderer,onStage:s=>stages.push(s),onInspect:info=>inspections.push(info),onCompare:()=>compared++,onPause:value=>expedition.setPaused(value)});
  const data=JSON.parse(fs.readFileSync(new URL('../dist/data/jezero-terrain.json',import.meta.url),'utf8')),site=SITES.find(s=>s.id==='jezero');
  expedition.load(site,data,analyzeTerrain(data));expedition.last=0;
  let sawDust=false,sawCargoFloor=false,sawRampTraversal=false;
  for(let frame=1;frame<=960;frame++){
    expedition.tick(frame*1000/60);sawDust ||= expedition.landingEffects.visibleParticles>0;
    if(expedition.robot.visible&&expedition.clock<10.2){sawCargoFloor=true;assert.ok(expedition.robot.position.y>=expedition.landingBaseY+.80,'visible cargo robot stays above its payload deck');}
    if(expedition.clock>11&&expedition.clock<14.9){sawRampTraversal=true;assert.ok(Math.abs(expedition.robot.position.y-expedition.walkSurfaceHeight(expedition.robot.position.x,expedition.robot.position.z))<1e-8);for(const leg of expedition.robot.userData.legs){const foot=leg.foot.getWorldPosition(new THREE.Vector3());assert.ok(foot.y>=expedition.walkSurfaceHeight(foot.x,foot.z)-.09,'walking foot does not cut through the ramp');}}
  }
  assert.ok(sawDust);assert.ok(sawCargoFloor);assert.ok(sawRampTraversal);
  assert.equal(expedition.phase,'explore');assert.ok(expedition.robot.visible);assert.ok(stages.includes('landing'));assert.ok(stages.includes('deploy'));assert.ok(stages.includes('explore'));assert.equal(stages.filter(s=>s==='explore').length,1);assert.equal(expedition.rocket.position.y,expedition.spawn.y);assert.equal(expedition.lander,expedition.rocket);assert.ok(expedition.lander.userData.doorPivots.every(p=>Math.abs(p.rotation.y)>1.8));assert.equal(expedition.lander.userData.brandingText,'powered by Wh0Knows');assert.equal(expedition.landingEffects.visibleParticles,0);assert.equal(expedition.landingEffects.engineLight.intensity,0);
  renderer.domElement.focus();const before=expedition.robot.position.clone();window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'w'}));
  for(let frame=961;frame<=1080;frame++)expedition.tick(frame*1000/60);
  window.dispatchEvent(new window.KeyboardEvent('keyup',{key:'w'}));assert.ok(expedition.robot.position.distanceTo(before)>2,'W moves the explorer over the source terrain');assert.ok(expedition.totalDistance>2);
  window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'e'}));assert.equal(inspections.length,1);assert.equal(inspections[0].siteId,'jezero');assert.ok(Number.isFinite(inspections[0].height));assert.equal(inspections[0].baselineMeters,1000);
  window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'c'}));assert.equal(compared,1);
  expedition.setLayer('slope');assert.equal(expedition.grid.visible,true);for(const c of expedition.terrain.geometry.attributes.color.array)assert.ok(Number.isFinite(c));
  window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(expedition.paused,true);const pausedPosition=expedition.robot.position.clone();expedition.setMove('forward',true);expedition.tick(18000);assert.deepEqual(expedition.robot.position.toArray(),pausedPosition.toArray());expedition.setPaused(false);
  assert.ok(renderCount>1000);assert.ok(expedition.camera.position.toArray().every(Number.isFinite));assert.equal(expedition.robot.userData.legs.length,6);
  const moonData=JSON.parse(fs.readFileSync(new URL('../dist/data/shackleton-terrain.json',import.meta.url))),thermal=JSON.parse(fs.readFileSync(new URL('../dist/data/shackleton-thermal.json',import.meta.url)));
  expedition.load(SITES.find(site=>site.id==='shackleton'),moonData,analyzeTerrain(moonData));
  const elevations=expedition.terrain.geometry.attributes.position.array.slice();
  assert.equal(expedition.scene.fog,null,'lunar scene adds no atmospheric fog');
  expedition.setThermalField({sample:(lat,lon)=>samplePlanetaryThermal(thermal,lat,lon)?.valueK??null});expedition.setLayer('temperature');
  assert.equal(expedition.terrain.material,expedition.thermalMaterial);assert.equal(expedition.terrain.material.toneMapped,false);assert.equal(expedition.terrain.material.map,null);assert.deepEqual(expedition.terrain.geometry.attributes.position.array,elevations,'thermal layer never changes DEM elevations');
  const center=(32*65+32)*3,expected=new THREE.Color().setRGB(...thermalColor(thermal.raster.valuesK[32*65+32]),THREE.SRGBColorSpace);
  const colors=expedition.terrain.geometry.attributes.color.array;assert.ok(Math.abs(colors[center]-expected.r)<1e-6);assert.ok(Math.abs(colors[center+1]-expected.g)<1e-6);
  expedition.setThermalField(null);const missing=new THREE.Color().setRGB(...thermalColor(null),THREE.SRGBColorSpace);assert.ok(Math.abs(colors[center]-missing.r)<1e-6,'missing thermal fields use grey instead of inferred values');
  expedition.setLayer('surface');assert.equal(expedition.terrain.material,expedition.terrainMaterial);
  expedition.skipArrival();assert.equal(expedition.landingEffects.visibleParticles,0);assert.ok(expedition.lander.userData.nozzleGlows.every(g=>g.material.emissiveIntensity===0));assert.equal(expedition.phase,'explore');
  // Repeated site loads ground actual hardware without changing the source DEM.
  for(const location of SITES){const terrain=JSON.parse(fs.readFileSync(new URL('../dist/'+location.terrainFile,import.meta.url))),original=terrain.heights.slice();expedition.load(location,terrain,analyzeTerrain(terrain));if(['cabeus-center','nobile-center','gale-bradbury','eberswalde-delta'].includes(location.id)){expedition.last=0;for(let frame=1;frame<=960;frame++){expedition.tick(frame*1000/60);if(expedition.clock>11&&expedition.clock<14.9)assert.ok(Math.abs(expedition.robot.position.y-expedition.walkSurfaceHeight(expedition.robot.position.x,expedition.robot.position.z))<1e-8,location.id+' robot traverses its real ramp');}assert.equal(expedition.phase,'explore');assert.equal(expedition.landingEffects.visibleParticles,0);}expedition.skipArrival();assert.equal(expedition.lander.userData.groundingStatus.outOfRange,false,location.id+' pads within reach');assert.equal(expedition.lander.userData.rampGrounding.clamped,false,location.id+' ramp within reach');assert.deepEqual(terrain.heights,original);assert.equal(expedition.thermalField,null);expedition.setLayer('temperature');const missingColor=new THREE.Color().setRGB(...thermalColor(null),THREE.SRGBColorSpace);assert.ok(Math.abs(expedition.terrain.geometry.attributes.color.array[0]-missingColor.r)<1e-6,location.id+' does not borrow a thermal map');expedition.setLayer('slope');assert.ok(expedition.terrain.geometry.attributes.color.array.every(Number.isFinite));expedition.setLayer('surface');assert.equal(expedition.telemetry().siteId,location.id);for(const foot of expedition.lander.userData.footAnchors){const actual=expedition.lander.localToWorld(foot.clone());assert.ok(Math.abs(actual.y-expedition.height(actual.x,actual.z))<1e-5,'each foot reaches the source terrain');}}
  await window.happyDOM.close();
});
