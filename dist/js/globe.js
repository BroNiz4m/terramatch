import * as THREE from '../vendor/three.module.js';
import { createHexapod } from './models.js';

const lonLat = (lat, lon, radius=2.3) => {
  const a=THREE.MathUtils.degToRad(lat), b=THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(a)*Math.cos(b),Math.sin(a),-Math.cos(a)*Math.sin(b)).multiplyScalar(radius);
};

export class GlobeView {
  constructor({container,onSelect,onReady,onHover,onError}) {
    this.container=container;this.onSelect=onSelect;this.onHover=onHover;this.active=true;this.body='earth';this.pins=[];this.targetRotation={x:.13,y:-2.22};this.zoomTarget=7.15;
    try { this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'}); }
    catch(error){onError?.(error);return;}
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    container.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Drag to rotate the globe. Scroll to zoom. Select a candidate marker.');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(39,1,.1,100);this.camera.position.z=this.zoomTarget;
    this.world=new THREE.Group();this.world.rotation.set(.13,-2.22,0);this.scene.add(this.world);
    this.loader=new THREE.TextureLoader();this.textures={};
    for(const [key,file] of Object.entries({earth:'earth-day.jpg',moon:'moon.jpg',mars:'mars.jpg'})){
      const texture=this.loader.load(`assets/${file}`,()=>{if(key==='earth')onReady?.();},undefined,()=>{if(key==='earth')onReady?.();});texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures[key]=texture;
    }
    const specular=this.loader.load('assets/earth-specular.jpg');
    this.globe=new THREE.Mesh(new THREE.SphereGeometry(2.3,96,64),new THREE.MeshPhongMaterial({map:this.textures.earth,specularMap:specular,specular:new THREE.Color('#274555'),shininess:12}));this.world.add(this.globe);
    this.atmosphere=new THREE.Mesh(new THREE.SphereGeometry(2.35,64,48),new THREE.ShaderMaterial({uniforms:{glow:{value:new THREE.Color('#5292d0')}},vertexShader:'varying vec3 vNormal; varying vec3 vPos; void main(){ vNormal=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.0);vPos=p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 glow;varying vec3 vNormal; varying vec3 vPos; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(-vPos))),3.4);gl_FragColor=vec4(glow,rim*0.5);}',transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending}));this.scene.add(this.atmosphere);
    this.scene.add(new THREE.AmbientLight('#b0d5ff',1.1));const sun=new THREE.DirectionalLight('#fff5df',2.5);sun.position.set(-5,5,8);this.scene.add(sun);
    const stars=new Float32Array(130*3);let seed=123;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};for(let i=0;i<130;i++){stars[i*3]=(rand()-.5)*35;stars[i*3+1]=(rand()-.5)*24;stars[i*3+2]=-12-rand()*12;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(stars,3));this.scene.add(new THREE.Points(geo,new THREE.PointsMaterial({size:.018,color:'#769cb1',transparent:true,opacity:.5})));
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.drag=null;this.moved=false;
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',event=>{this.drag={x:event.clientX,y:event.clientY};this.moved=false;canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';});
    canvas.addEventListener('pointermove',event=>{
      if(this.drag){const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;this.targetRotation.y+=dx*.006;this.targetRotation.x=THREE.MathUtils.clamp(this.targetRotation.x+dy*.004,-1.15,1.15);this.moved ||=Math.abs(dx)+Math.abs(dy)>2;this.drag={x:event.clientX,y:event.clientY};this.onHover?.(null);}
      else {const hit=this.pick(event);canvas.style.cursor=hit?'pointer':'grab';this.hover=hit;}
    });
    canvas.addEventListener('pointerup',event=>{if(!this.moved){const hit=this.pick(event);if(hit)this.onSelect?.(hit.userData.site);}this.drag=null;canvas.style.cursor='grab';});
    canvas.addEventListener('pointercancel',()=>this.drag=null);
    canvas.addEventListener('wheel',event=>{event.preventDefault();this.zoom(event.deltaY>0?1:-1);},{passive:false});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.last=performance.now();
    this.renderer.setAnimationLoop(t=>this.render(t));
  }
  pick(event){const bounds=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hits=this.raycaster.intersectObjects(this.pins,false);return hits.find(hit=>{const w=hit.object.getWorldPosition(new THREE.Vector3());return w.z>.15;})?.object;}
  setSites(sites,selectedId){
    if(!this.renderer)return;
    for(const pin of this.pins){this.world.remove(pin);pin.geometry.dispose();pin.material.dispose();if(pin.userData.halo){this.world.remove(pin.userData.halo);pin.userData.halo.geometry.dispose();pin.userData.halo.material.dispose();}}this.pins=[];
    sites.filter(s=>s.body===this.body).forEach(site=>{
      const selected=site.id===selectedId;const pin=new THREE.Mesh(new THREE.SphereGeometry(selected?.047:.034,16,12),new THREE.MeshBasicMaterial({color:selected?'#ffad61':'#f28b43'}));pin.position.copy(lonLat(site.lat,site.lon,2.34));pin.userData.site=site;this.world.add(pin);this.pins.push(pin);
      const halo=new THREE.Mesh(new THREE.RingGeometry(selected?.068:.052,selected?.084:.065,32),new THREE.MeshBasicMaterial({color:selected?'#fff1d6':'#c7ddd7',side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));halo.position.copy(lonLat(site.lat,site.lon,2.342));halo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),halo.position.clone().normalize());this.world.add(halo);pin.userData.halo=halo;
    });this.selectedId=selectedId;
  }
  setPlanet(body,sites,selectedId){if(!this.renderer)return;this.body=body;this.globe.material.map=this.textures[body]||this.textures.earth;this.globe.material.specular.set(body==='earth'?'#274555':'#111111');this.globe.material.needsUpdate=true;this.atmosphere.visible=body!=='moon';this.atmosphere.material.uniforms.glow.value.set(body==='mars'?'#ad6b40':'#5292d0');this.setSites(sites,selectedId);if(body==='earth')this.reset();else{const target=sites.find(s=>s.id===selectedId)||sites.find(s=>s.body===body);if(target)this.focusSite(target);}}
  focusSite(site){if(!this.renderer)return;this.targetRotation.y=-Math.PI/2-THREE.MathUtils.degToRad(site.lon);this.targetRotation.x=THREE.MathUtils.clamp(THREE.MathUtils.degToRad(site.lat)*.7,-1.1,1.1);this.hover=this.pins.find(p=>p.userData.site.id===site.id);}
  reset(){this.targetRotation={x:.13,y:-2.22};this.zoomTarget=7.15;}
  zoom(direction){this.zoomTarget=THREE.MathUtils.clamp(this.zoomTarget+direction*.45,5.35,10);}
  resize(){if(!this.renderer)return;const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  setActive(active){this.active=active;if(active)this.resize();}
  render(time){if(!this.active||!this.renderer)return;this.world.rotation.x=THREE.MathUtils.lerp(this.world.rotation.x,this.targetRotation.x,.065);this.world.rotation.y=THREE.MathUtils.lerp(this.world.rotation.y,this.targetRotation.y,.065);this.camera.position.z=THREE.MathUtils.lerp(this.camera.position.z,this.zoomTarget,.08);const selected=this.hover||this.pins.find(p=>p.userData.site.id===this.selectedId);if(selected){const position=selected.getWorldPosition(new THREE.Vector3());if(position.z>.35){position.project(this.camera);const r=this.container.getBoundingClientRect();this.onHover?.(selected.userData.site,(position.x*.5+.5)*r.width,(-position.y*.5+.5)*r.height-39);}else this.onHover?.(null);}this.renderer.render(this.scene,this.camera);}
}

export function createRobotPreview(container){
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{return{setActive(){}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.1,30);camera.position.set(5,3.2,-5);camera.lookAt(0,.8,0);
  scene.add(new THREE.HemisphereLight('#d7edff','#5c3a23',2.5));const light=new THREE.DirectionalLight('#fff0cf',3);light.position.set(-2,7,-3);light.castShadow=true;light.shadow.mapSize.set(512,512);scene.add(light);
  const plane=new THREE.Mesh(new THREE.CircleGeometry(8,48),new THREE.MeshStandardMaterial({color:'#34414a',roughness:.95}));plane.rotation.x=-Math.PI/2;plane.receiveShadow=true;scene.add(plane);
  const robot=createHexapod();robot.rotation.y=.25;scene.add(robot);let active=true;
  const resize=()=>{const r=container.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(container);resize();
  renderer.setAnimationLoop(time=>{if(!active)return;robot.rotation.y=.25+Math.sin(time*.00015)*.18;robot.userData.update?.(.016,time*.001,false,()=>0);renderer.render(scene,camera);});
  return{setActive(value){active=value;if(value)resize();}};
}
