import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createHexapod,createCargoLander,createRocket} from '../dist/js/models.js';

test('hexapod has exactly six legs with finite terrain-following motion',()=>{
  const robot=createHexapod();assert.equal(robot.userData.legs.length,6);robot.position.set(10,2,-7);robot.rotation.y=.5;
  for(let i=0;i<120;i++){robot.position.z-=.02;robot.updateMatrixWorld(true);robot.userData.update(1/60,i/60,1,(x,z)=>2+.01*x+.02*z);}
  robot.updateMatrixWorld(true);robot.traverse(object=>{for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value));});
});
const near=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≠ ${expected}`);

test('cargo lander has a low box silhouette, four circular pads and six underbody nozzles',()=>{
  const lander=createCargoLander(),data=lander.userData;
  assert.equal(createRocket().name,lander.name);
  const bounds=new THREE.Box3().setFromObject(lander),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.y<5 && size.y<size.x);assert.equal(data.footAnchors.length,4);assert.equal(data.nozzleAnchors.length,6);
  assert.equal(data.landingLegs.length,4);assert.equal(data.rampWidth,4.5);assert.equal(data.bayWidth,4.5);
  assert.ok(data.landingLegs.every(leg=>leg.pad.geometry.type==='CylinderGeometry'));
  let bells=0;
  lander.traverse(object=>{
    if(object.name==='Underbody bell nozzle')bells++;
    if(object.isMesh)assert.ok(object.geometry.attributes.position.count>0);
    for(const value of object.matrixWorld.elements)assert.ok(Number.isFinite(value));
  });
  assert.equal(bells,6);assert.equal(data.flames.children.length,0);
  data.setThrust(1);data.update(.016,1);
  assert.ok(data.nozzleGlows.every(glow=>glow.material.emissiveIntensity>1));
});

test('both side panels carry the exact two-line Wh0Knows credit as rendered pixels',()=>{
  const {brandingText,brandingLabels,frontBrand}=createCargoLander().userData;
  assert.equal(brandingText,'powered by Wh0Knows');assert.equal(brandingLabels.length,2);
  for(const label of brandingLabels){
    assert.equal(label.userData.text,brandingText);assert.ok(label.geometry.parameters.height>=1.3);
    const texture=label.material.map;
    assert.equal(texture.userData.text,brandingText);assert.equal(texture.userData.renderMethod,'local-pixel-font');assert.equal(texture.flipY,true);
    const {data,width,height}=texture.image;assert.equal(height,320);
    // Foreground glyphs appear in both the small top line and large bottom line.
    for(const [y0,y1] of [[35,84],[135,219]]){
      let dark=0;for(let y=y0;y<y1;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4]<50)dark++;
      assert.ok(dark>500);
    }
  }
  assert.equal(frontBrand.userData.text,'TerraMatch');
});

test('side-hinged doors open outside a genuinely unobstructed full-width cargo bay',()=>{
  const lander=createCargoLander(),data=lander.userData;
  const ray=new THREE.Raycaster(new THREE.Vector3(.3,2.2,-10),new THREE.Vector3(0,0,1));
  lander.updateMatrixWorld(true);
  assert.ok(ray.intersectObject(lander,true)[0].point.z< -2.5);
  data.setDeployment(1);lander.updateMatrixWorld(true);
  const [left,right]=data.doorPivots;
  near(left.rotation.y,THREE.MathUtils.degToRad(110));near(right.rotation.y,-THREE.MathUtils.degToRad(110));
  near(left.rotation.x,0);near(right.rotation.x,0);
  assert.ok(new THREE.Box3().setFromObject(left).max.x< -2.25);
  assert.ok(new THREE.Box3().setFromObject(right).min.x>2.25);
  // Across the robot's complete walking envelope, the next hit is the back wall.
  for(const x of [-1.98,-1,0,1,1.98])for(const y of [1.2,2.2,3.17]){
    ray.ray.origin.set(x,y,-10);const hits=ray.intersectObject(lander,true);
    assert.ok(hits.length>0);assert.ok(hits[0].point.z>2,`Bay blocked at ${x}, ${y}: ${hits[0].point.z}`);
  }
});

test('unfolded ramp meets requested ground and exposes the same continuous walking plane',()=>{
  const lander=createCargoLander(),d=lander.userData;
  d.setDeployment(0);lander.updateMatrixWorld(true);
  assert.ok(new THREE.Box3().setFromObject(d.rampPivot).max.y<3.15);
  assert.equal(d.rampSurfaceHeight(0,-4),null);
  d.setDeployment(1);
  for(const compression of [0,.7,1])for(const ground of [-.35,0,.2]){
    d.setCompression(compression);d.setRampGroundHeight(ground);lander.updateMatrixWorld(true);
    const tip=d.rampTipPivot.localToWorld(new THREE.Vector3(0,0,-d.rampLength/2));
    near(tip.y,ground);near(tip.z,d.rampTipZ);near(d.rampHeight,.85-compression*.1);
    near(d.rampSurfaceHeight(0,d.doorFrontZ),d.rampHeight);
    near(d.rampSurfaceHeight(0,tip.z),ground);
    const midZ=(d.doorFrontZ+tip.z)/2;near(d.rampSurfaceHeight(0,midZ),(ground+d.rampHeight)/2);
    assert.equal(d.rampSurfaceHeight(2.26,midZ),null);
    assert.equal(d.rampSurfaceHeight(0,tip.z-.1),null);
  }
  d.setRampGroundHeight(-20);assert.equal(d.rampGrounding.clamped,true);assert.ok(Number.isFinite(d.rampAngle));
});

test('landing pads ground independently, report unreachable terrain and retract safely',()=>{
  const d=createCargoLander().userData;
  const sample=(x,z)=>.04*x+.025*z-.2;d.setGrounding(sample);
  for(const [i,anchor] of d.footAnchors.entries()){
    near(anchor.y,sample(anchor.x,anchor.z));near(d.landingLegs[i].pad.position.y-.055,anchor.y);
  }
  assert.equal(d.groundingStatus.outOfRange,false);
  d.setGrounding((x)=>x<0?-10:10);
  assert.equal(d.groundingStatus.clampedFeet.length,4);
  for(const anchor of d.footAnchors)near(anchor.y,anchor.x<0?-.8:.45);
  d.setGrounding(()=>0);d.setLandingGear(0);
  for(const anchor of d.footAnchors){near(Math.abs(anchor.x),3.02);near(anchor.y,.48);near(Math.abs(anchor.z),2.18);}
  d.setLandingGear(1);for(const anchor of d.footAnchors)near(anchor.y,0);
});

test('the existing full-stance hexapod fits the actual door and ramp with headroom',()=>{
  const robot=createHexapod(),lander=createCargoLander(),d=lander.userData;
  robot.userData.setStance(1);let width=0,head=0;
  for(let i=0;i<120;i++){
    robot.userData.update(1/60,i/60,1,()=>0);robot.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(robot);width=Math.max(width,box.max.x-box.min.x);head=Math.max(head,box.max.y);
  }
  assert.ok(width<d.bayWidth-.4);assert.ok(width<d.rampWidth-.4);
  // Lowest overhead fitting is the warm header light, bottom 3.42 m.
  assert.ok(head+d.deckHeight<3.42-.2);
});

test('hexapod folds its footprint to fit through the cargo doorway',()=>{
  const robot=createHexapod();robot.userData.setStance(0);robot.userData.update(.016,0,false,()=>0);const folded=Math.max(...robot.userData.legs.map(leg=>Math.abs(leg.footPosition.x)));assert.ok(folded<.85);robot.userData.setStance(1);robot.userData.update(.016,0,false,()=>0);const expanded=Math.max(...robot.userData.legs.map(leg=>Math.abs(leg.footPosition.x)));assert.ok(expanded>1.7);assert.equal(robot.userData.legs.length,6);
});
