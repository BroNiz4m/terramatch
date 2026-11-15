import * as THREE from '../vendor/three.module.js';
import {createCargoLander,createSurfaceRover} from './models.js?v=20261115-rover-1';
import {LandingEffects} from './landing-effects.js';
import {ARRIVAL,arrivalPose} from './lander-arrival.js';
const clamp=THREE.MathUtils.clamp,smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
export function initializeCargoArrival(exp){
  const lander=exp.lander=createCargoLander();exp.rocket=lander; // Existing collaboration API alias.
  exp.landingBaseY=Math.max(exp.spawn.y,...lander.userData.footAnchors.map(a=>exp.height(exp.spawn.x+a.x,exp.spawn.z+a.z)));exp.spawn.y=exp.landingBaseY;
  lander.userData.setGrounding((x,z)=>exp.height(exp.spawn.x+x,exp.spawn.z+z)-exp.landingBaseY);const r=lander.userData;
  let tailZ=r.doorFrontZ-Math.sqrt(Math.max(0,r.rampLength**2-r.rampHeight**2)),ground=exp.height(exp.spawn.x,exp.spawn.z+tailZ)-exp.landingBaseY;
  for(let i=0;i<4;i++){const angle=-Math.asin(clamp((r.rampHeight-ground)/r.rampLength,-.65,.65));tailZ=r.doorFrontZ-Math.cos(angle)*r.rampLength;ground=exp.height(exp.spawn.x,exp.spawn.z+tailZ)-exp.landingBaseY;}r.setRampGroundHeight(ground);
  lander.position.set(exp.spawn.x+4,exp.landingBaseY+ARRIVAL.startAltitude,exp.spawn.z+3);r.setLandingGear(0);r.setCompression(0);r.setDeployment(0);exp.root.add(lander);
  exp.robot=createSurfaceRover();exp.robot.position.set(exp.spawn.x,exp.landingBaseY+r.rampHeight,exp.spawn.z+.15);exp.robot.visible=false;exp.root.add(exp.robot);
  exp.landingEffects=new LandingEffects({body:exp.site.body,lander,height:(x,z)=>exp.height(x,z)});exp.root.add(exp.landingEffects.group);
  exp.lastStage='landing';exp.lastArrivalStep='approach';
}
export function prepareCargoCamera(exp){exp.camera.position.set(exp.spawn.x+18,exp.landingBaseY+ARRIVAL.startAltitude+11,exp.spawn.z-25);exp.lookTarget=new THREE.Vector3(exp.spawn.x+4,exp.landingBaseY+ARRIVAL.startAltitude+2,exp.spawn.z+3);exp.camera.lookAt(exp.lookTarget);}
export function cargoSurfaceHeight(exp,x,z){
  const ground=exp.height(x,z),lander=exp.lander;if(!lander)return ground;
  const localX=x-lander.position.x,localZ=z-lander.position.z,r=lander.userData;let surface=r.rampSurfaceHeight(localX,localZ);
  if(surface==null&&Math.abs(localX)<=r.bayWidth/2&&localZ>=r.doorFrontZ&&localZ<=r.doorFrontZ+r.bayDepth)surface=r.rampHeight;
  return Number.isFinite(surface)?Math.max(ground,lander.position.y+surface):ground;
}
export function insideCargoWall(exp,x,z){const r=exp.lander?.userData;if(!r)return false;const lx=x-exp.spawn.x,lz=z-exp.spawn.z;if(Math.abs(lx)>3.7||lz<r.doorFrontZ-1||lz>r.doorFrontZ+r.bayDepth+1)return false;return !(Math.abs(lx)<Math.max(.25,r.bayWidth/2-(exp.robot?.userData.halfWidth??1.65)-.08)&&lz<r.doorFrontZ+r.bayDepth-(exp.robot?.userData.halfLength??1.35)-.08);}
export function orientCargoRobot(exp,dt){const {robot}=exp,x=robot.position.x,z=robot.position.z,yaw=robot.rotation.y,fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw),height=(x,z)=>cargoSurfaceHeight(exp,x,z),front=height(x+fx*1.15,z+fz*1.15),back=height(x-fx*1.15,z-fz*1.15),right=height(x+rx*1.4,z+rz*1.4),left=height(x-rx*1.4,z-rz*1.4),blend=1-Math.exp(-dt*10);robot.rotation.x=THREE.MathUtils.lerp(robot.rotation.x,clamp(Math.atan2(front-back,2.3),-.42,.42),blend);robot.rotation.z=THREE.MathUtils.lerp(robot.rotation.z,clamp(Math.atan2(right-left,2.8),-.3,.3),blend);}
export function finishCargoArrival(exp){if(!exp.robot)return;exp.clock=ARRIVAL.control+.01;exp.lander.position.set(exp.spawn.x,exp.landingBaseY,exp.spawn.z);exp.lander.rotation.set(0,0,0);const r=exp.lander.userData;r.setLandingGear(1);r.setCompression(.12);r.setThrust(0);r.setDeployment(1);r.update(0,exp.clock);exp.landingEffects.clear();exp.robot.visible=true;exp.robot.userData.resetMotion?.();exp.robot.position.set(exp.spawn.x,cargoSurfaceHeight(exp,exp.spawn.x,exp.spawn.z+ARRIVAL.exitZ),exp.spawn.z+ARRIVAL.exitZ);exp.robot.userData.update(0,exp.clock,false,(x,z)=>cargoSurfaceHeight(exp,x,z));exp.phase='explore';exp.lastStage='explore';exp.lastArrivalStep='explore';exp.onStage?.('explore',1,{step:'explore'});exp.renderer.domElement.focus({preventScroll:true});}
export function updateCargoArrival(exp,dt){
  const t=exp.clock,pose=arrivalPose(t),lander=exp.lander,r=lander.userData;exp.phase=pose.complete?'deploy':pose.phase;
  lander.position.set(exp.spawn.x+pose.offsetX,exp.landingBaseY+pose.altitude,exp.spawn.z+pose.offsetZ);lander.rotation.set(Math.sin(t*1.25)*.025*(1-pose.gear),Math.sin(t*.8)*.045*(1-pose.gear),Math.sin(t*1.8)*.025*(1-pose.gear));r.setLandingGear(pose.gear);r.setCompression(pose.compression);r.setThrust(pose.thrust);r.setDeployment(pose.deployment);r.update(dt,t);exp.landingEffects.update(dt,t,{thrust:pose.thrust,altitude:pose.altitude});
  exp.robot.visible=pose.robotVisible;const z=THREE.MathUtils.lerp(exp.spawn.z+.15,exp.spawn.z+ARRIVAL.exitZ,pose.exit);exp.robot.position.set(exp.spawn.x,cargoSurfaceHeight(exp,exp.spawn.x,z),z);
  const step=t<ARRIVAL.touchdown?'approach':t<ARRIVAL.settled?'touchdown':pose.deployment<.48?'doors':t<ARRIVAL.open?'ramp':'robot';
  if(exp.lastStage!==exp.phase||exp.lastArrivalStep!==step){exp.onStage?.(exp.phase,clamp(t/ARRIVAL.control,0,1),{step,credit:'Wh0Knows'});exp.lastStage=exp.phase;exp.lastArrivalStep=step;}
  const approach=smooth(t/ARRIVAL.touchdown),transition=smooth((pose.exit-.45)/.55),hero=new THREE.Vector3(exp.spawn.x+18-approach*6.3,exp.landingBaseY+pose.altitude+11-approach*4.5,exp.spawn.z-25+approach*9.6),follow=new THREE.Vector3(exp.robot.position.x+Math.sin(exp.orbitYaw)*exp.cameraDistance,exp.robot.position.y+Math.sin(exp.orbitPitch)*exp.cameraDistance+2,exp.robot.position.z+Math.cos(exp.orbitYaw)*exp.cameraDistance);hero.lerp(follow,transition);hero.y=Math.max(hero.y,exp.height(hero.x,hero.z)+2.5);exp.camera.position.lerp(hero,1-Math.exp(-dt*4));const target=new THREE.Vector3(lander.position.x,lander.position.y+2,lander.position.z-1).lerp(new THREE.Vector3(exp.robot.position.x,exp.robot.position.y+1,exp.robot.position.z-3),transition);exp.lookTarget.lerp(target,1-Math.exp(-dt*4));
  if(pose.complete)finishCargoArrival(exp);return t>ARRIVAL.open?.85:0;
}
