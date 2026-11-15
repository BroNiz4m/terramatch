import * as THREE from '../vendor/three.module.js';
import {buildGlobeGeometry,bodyRadiusScene} from './globe-geometry.js';

/** Static, fitted view using the same original texture and numeric geometry as Explore. */
export function createPlanetPreview(container,getGlobe){
 let renderer=null,mesh=null,body=null,serial=0;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(39,1,.001,100);
 const fallback=document.createElement('img');fallback.className='planet-preview-map';container.append(fallback);
 function draw(){if(!renderer||!mesh)return;const r=container.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.position.z=bodyRadiusScene(body)*Math.max(3.9,3.9/camera.aspect);camera.updateProjectionMatrix();renderer.render(scene,camera);}
 function show({body:next,image,dem}){
  body=next;const job=++serial;fallback.hidden=!image;if(image)fallback.src=image.path;else fallback.removeAttribute('src');fallback.alt='Original published '+next+' global mosaic';
  if(renderer)renderer.domElement.hidden=true;
  const apply=()=>{
   if(job!==serial)return;const globe=getGlobe(),texture=globe?.textures?.[body];if(!globe?.renderer||!texture)return;
   if(!renderer){try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));renderer.domElement.setAttribute('aria-label','Fitted '+next+' preview from agency imagery and numeric terrain');container.append(renderer.domElement);}catch{return;}}
   if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
   mesh=new THREE.Mesh(buildGlobeGeometry(body,{dem,westLongitude:image?.registration?.westLongitude??-180,widthSegments:96,heightSegments:48}),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));mesh.rotation.set(.12,body==='earth'?-2.22:-1,0);scene.add(mesh);
   fallback.hidden=true;renderer.domElement.hidden=false;renderer.domElement.setAttribute('aria-label','Fitted '+next+' preview from agency imagery and numeric terrain');draw();
  };
  apply();if(!getGlobe()?.textures?.[body])getGlobe()?.ready?.then(apply).catch(()=>{});
 }
 new ResizeObserver(draw).observe(container);
 return{show,resize:draw};
}
