import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createHexapod,createRocket} from '../dist/js/models.js';

test('hexapod has exactly six legs with finite terrain-following motion',()=>{
  const robot=createHexapod();assert.equal(robot.userData.legs.length,6);robot.position.set(10,2,-7);robot.rotation.y=.5;
  for(let i=0;i<120;i++){robot.position.z-=.02;robot.updateMatrixWorld(true);robot.userData.update(1/60,i/60,1,(x,z)=>2+.01*x+.02*z);}
  robot.updateMatrixWorld(true);robot.traverse(object=>{for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value));});
});
test('cargo door and ramp open as actual geometry',()=>{
  const rocket=createRocket();rocket.userData.setDeployment(0);const closed=rocket.userData.doorPivot.rotation.x;rocket.userData.setDeployment(1);assert.notEqual(rocket.userData.doorPivot.rotation.x,closed);assert.ok(Number.isFinite(rocket.userData.rampPivot.rotation.x));const box=new THREE.Box3().setFromObject(rocket);assert.ok(box.max.y>10);assert.ok(box.min.z<-3);assert.ok(box.max.x-box.min.x>3);
});

test('hexapod folds its footprint to fit through the cargo doorway',()=>{
  const robot=createHexapod();robot.userData.setStance(0);robot.userData.update(.016,0,false,()=>0);const folded=Math.max(...robot.userData.legs.map(leg=>Math.abs(leg.footPosition.x)));assert.ok(folded<.85);robot.userData.setStance(1);robot.userData.update(.016,0,false,()=>0);const expanded=Math.max(...robot.userData.legs.map(leg=>Math.abs(leg.footPosition.x)));assert.ok(expanded>1.7);assert.equal(robot.userData.legs.length,6);
});
