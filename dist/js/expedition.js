import * as THREE from '../vendor/three.module.js';
import { createHexapod, createRocket } from './models.js';
import { sampleTerrain, terrainCoordinates } from './science.js';
import { thermalColor } from './thermal-colors.js';

const clamp=THREE.MathUtils.clamp, smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const surfaceColors={mars:['#79543d','#b98359','#cba27b'],moon:['#42464c','#84878b','#b3b0a7'],earth:['#605642','#9e8a63','#c2aa7c']};
function disposeGroup(group){const geos=new Set(),mats=new Set();group.traverse(item=>{if(item.geometry)geos.add(item.geometry);if(item.material){for(const m of Array.isArray(item.material)?item.material:[item.material])mats.add(m);}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}

export class Expedition {
  constructor({container,minimap,onTelemetry,onStage,onInspect,onCompare,onPause,onError,rendererFactory}){
    Object.assign(this,{container,minimap,onTelemetry,onStage,onInspect,onCompare,onPause,onError});this.active=false;this.paused=false;this.keys=new Set();this.layer='surface';this.phase='landing';this.clock=0;this.orbitYaw=.28;this.orbitPitch=.32;this.cameraDistance=15;this.follow=true;this.evidenceOpen=false;
    try{this.renderer=rendererFactory?rendererFactory():new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){onError?.(error);return;}
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    container.append(this.renderer.domElement);this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label','3D expedition. W and S move, A and D turn, Shift moves faster. Drag to look. E inspects terrain, C compares, Escape pauses.');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(49,1,.1,1800);this.root=new THREE.Group();this.scene.add(this.root);
    this.hemisphere=new THREE.HemisphereLight('#e9ddce','#6c4330',2.2);this.scene.add(this.hemisphere);
    this.sun=new THREE.DirectionalLight('#fff0d4',3.4);this.sun.position.set(-35,60,-20);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-35;this.sun.shadow.camera.right=35;this.sun.shadow.camera.top=35;this.sun.shadow.camera.bottom=-35;this.sun.shadow.camera.near=.5;this.sun.shadow.camera.far=170;this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.02;this.scene.add(this.sun);this.scene.add(this.sun.target);
    const rim=new THREE.DirectionalLight('#b9d2e0',.45);rim.position.set(30,12,30);this.scene.add(rim);
    this.pointerDrag=null;const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{if(!this.active)return;canvas.focus({preventScroll:true});this.pointerDrag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!this.pointerDrag||!this.active)return;this.orbitYaw-=(e.clientX-this.pointerDrag.x)*.006;this.orbitPitch=clamp(this.orbitPitch+(e.clientY-this.pointerDrag.y)*.004,.08,1.05);this.pointerDrag={x:e.clientX,y:e.clientY};});
    const stopDrag=()=>this.pointerDrag=null;canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);
    canvas.addEventListener('wheel',e=>{if(!this.active)return;e.preventDefault();this.cameraDistance=clamp(this.cameraDistance+e.deltaY*.015,7,45);},{passive:false});
    window.addEventListener('keydown',e=>{
      if(!this.active||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||document.querySelector('.modal-backdrop'))return;
      const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(key)){e.preventDefault();this.keys.add(key);}
      if(e.repeat)return;if(key==='e'&&this.phase==='explore'&&!this.paused)this.onInspect?.(this.telemetry());if(key==='c'&&this.phase==='explore')this.onCompare?.();if(key==='escape')this.onPause?.(!this.paused);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{this.keys.clear();if(this.active&&this.phase==='explore')this.onPause?.(true);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.keys.clear();if(this.active&&this.phase==='explore')this.onPause?.(true);}});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.last=performance.now();this.renderer.setAnimationLoop(t=>this.tick(t));
  }
  load(site,data,stats){
    if(!this.renderer)throw new Error('WebGL is not available on this device.');
    this.keys.clear();this.paused=false;this.site=site;this.data=data;this.stats=stats;this.width=500;this.depth=data.depthMeters/data.widthMeters*500;this.scale=this.width/data.widthMeters;this.base=stats.min;this.clock=0;this.totalDistance=0;this.layer='surface';this.phase='landing';this.orbitYaw=.28;this.orbitPitch=.32;this.cameraDistance=15;this.follow=true;this.edgeReached=false;
    this.thermalMaterial?.dispose();this.terrainMaterial?.dispose();this.thermalField=null;disposeGroup(this.root);this.root.clear();this.obstacles=[];
    const moon=site.body==='moon',earth=site.body==='earth';const sky=moon?'#060a0e':earth?'#93adb5':'#b18c75';this.scene.background=new THREE.Color(sky);this.scene.fog=new THREE.FogExp2(sky,moon?.0012:.0022);this.hemisphere.color.set(moon?'#bfc8db':earth?'#c7e1ec':'#f2d7ba');this.hemisphere.groundColor.set(moon?'#292932':'#795238');this.hemisphere.intensity=moon?1.2:2.2;this.sun.color.set(moon?'#fff9e9':'#ffedcc');
    this.makeTerrain();this.spawn=this.findSpawn();this.spawn.y=this.height(this.spawn.x,this.spawn.z);
    this.rocket=createRocket();this.rocket.position.copy(this.spawn);this.rocket.position.y+=110;this.rocket.userData.setDeployment(0);this.root.add(this.rocket);
    this.robot=createHexapod();this.robot.position.set(this.spawn.x,this.spawn.y+1.25,this.spawn.z-.7);this.robot.visible=false;this.root.add(this.robot);
    this.makeRocks();this.makeRoute();this.makeMap();this.camera.position.set(this.spawn.x+26,this.spawn.y+68,this.spawn.z-40);this.camera.lookAt(this.spawn.x,this.spawn.y+94,this.spawn.z);this.lookTarget=new THREE.Vector3(this.spawn.x,this.spawn.y+94,this.spawn.z);this.active=true;this.resize();this.onStage?.('landing',0);this.drawMap();return this;
  }
  height(x,z){return(sampleTerrain(this.data,x/this.width+.5,z/this.depth+.5)-this.base)*this.scale;}
  walkSurfaceHeight(x,z){const ground=this.height(x,z);if(this.phase==='deploy'&&Math.abs(x-this.spawn.x)<.95){const rz=z-this.spawn.z;if(rz>=-1.35&&rz<1)return Math.max(ground,this.spawn.y+1.31);if(rz<-1.35&&rz>-5.4)return Math.max(ground,this.spawn.y+1.31-(Math.abs(rz)-1.35)*Math.tan(.285));}return ground;}
  pointSlope(x,z){const n=this.data.size,u=clamp(x/this.width+.5,0,1),v=clamp(z/this.depth+.5,0,1),ix=Math.round(u*(n-1)),iz=Math.round(v*(n-1));return this.stats.slopeGrid[iz*n+ix];}
  findSpawn(){const n=this.data.size;let best={cost:Infinity,x:0,z:0};for(let j=25;j<40;j++)for(let i=25;i<40;i++){const slope=this.stats.slopeGrid[j*n+i];const cost=slope+Math.hypot(i-32,j-32)*.15;if(cost<best.cost)best={cost,x:(i/(n-1)-.5)*this.width,z:(j/(n-1)-.5)*this.depth};}return new THREE.Vector3(best.x,0,best.z);}
  makeTerrain(){
    const n=this.data.size,geometry=new THREE.PlaneGeometry(this.width,this.depth,n-1,n-1);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position,colors=new Float32Array(n*n*3);
    for(let i=0;i<n*n;i++)positions.setY(i,(this.data.heights[i]-this.base)*this.scale);
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();this.terrainMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});this.thermalMaterial=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});this.terrain=new THREE.Mesh(geometry,this.terrainMaterial);this.terrain.receiveShadow=true;this.root.add(this.terrain);this.recolor();
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(3500,3500),new THREE.MeshStandardMaterial({color:surfaceColors[this.site.body][0],roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.5;ground.receiveShadow=true;this.root.add(ground);
    this.grid=new THREE.LineSegments(new THREE.WireframeGeometry(geometry),new THREE.LineBasicMaterial({color:'#b1e9e1',transparent:true,opacity:.10,depthWrite:false}));this.grid.position.y=.022;this.grid.visible=false;this.root.add(this.grid);
    // Fine ground texture is a visual treatment only. Elevations stay unchanged.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),img=ctx.createImageData(128,128);let seed=41;for(let i=0;i<img.data.length;i+=4){seed=seed*16807%2147483647;const value=150+seed%75;img.data[i]=img.data[i+1]=img.data[i+2]=value;img.data[i+3]=255;}ctx.putImageData(img,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(75,75);texture.colorSpace=THREE.SRGBColorSpace;this.terrainMaterial.map=texture;this.terrainMaterial.needsUpdate=true;this.groundTexture=texture;
  }
  recolor(){if(!this.terrain)return;const palette=surfaceColors[this.site.body],low=new THREE.Color(palette[0]),mid=new THREE.Color(palette[1]),high=new THREE.Color(palette[2]),teal=new THREE.Color('#318f99'),yellow=new THREE.Color('#d5c46a'),red=new THREE.Color('#cb6437'),color=new THREE.Color(),array=this.terrain.geometry.attributes.color;
    for(let i=0;i<this.data.heights.length;i++){
      const h=(this.data.heights[i]-this.stats.min)/(this.stats.relief||1),s=clamp(this.stats.slopeGrid[i]/25,0,1);
      if(this.layer==='temperature'){const n=this.data.size,{lat,lon}=terrainCoordinates(this.data,(i%n)/(n-1),Math.floor(i/n)/(n-1)),value=this.thermalField?.sample(lat,lon);color.setRGB(...thermalColor(value),THREE.SRGBColorSpace);}
      else if(this.layer==='slope'){color.copy(s<.5?teal:yellow).lerp(s<.5?yellow:red,s<.5?s*2:(s-.5)*2);color.multiplyScalar(.85);}
      else if(this.layer==='elevation'){color.copy(new THREE.Color('#225e74')).lerp(new THREE.Color('#d5c58c'),h);}
      else{color.copy(h<.5?low:mid).lerp(h<.5?mid:high,h<.5?h*2:(h-.5)*2);const variation=Math.sin(i*12.96)*.025;color.offsetHSL(0,0,variation);}
      array.setXYZ(i,color.r,color.g,color.b);
    }array.needsUpdate=true;this.terrain.material=this.layer==='temperature'?this.thermalMaterial:this.terrainMaterial;
  }
  setLayer(layer){this.layer=layer;this.recolor();if(this.grid)this.grid.visible=layer!=='surface';}
  setThermalField(field){this.thermalField=field;if(this.layer==='temperature')this.recolor();}
  makeRocks(){
    const geometry=new THREE.DodecahedronGeometry(1,0),material=new THREE.MeshStandardMaterial({color:this.site.body==='moon'?'#6b6c71':this.site.body==='earth'?'#8f8065':'#8e664b',roughness:1});this.rocks=new THREE.InstancedMesh(geometry,material,180);this.rocks.castShadow=true;this.rocks.receiveShadow=true;const dummy=new THREE.Object3D();let seed=6553;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
    for(let i=0;i<180;i++){let x=this.spawn.x+(rand()-.5)*180,z=this.spawn.z+(rand()-.5)*180;const r=.12+rand()*.8;if(Math.abs(x-this.spawn.x)<5&&Math.abs(z-this.spawn.z)<12)x+=12;const y=this.height(x,z);dummy.position.set(x,y+r*.35,z);dummy.rotation.set(rand(),rand()*6,rand());dummy.scale.set(r*(.8+rand()),r*.65,r*(.7+rand()));dummy.updateMatrix();this.rocks.setMatrixAt(i,dummy.matrix);if(r>.48)this.obstacles.push({x,z,r:r+1.4});}this.obstacles.push({x:this.spawn.x,z:this.spawn.z,r:3.1});this.root.add(this.rocks);
  }
  makeRoute(){
    this.waypoints=[{x:this.spawn.x+7,z:this.spawn.z-28},{x:this.spawn.x+24,z:this.spawn.z-62},{x:this.spawn.x+9,z:this.spawn.z-100}];const points=[new THREE.Vector3(this.spawn.x,this.spawn.y+.09,this.spawn.z-8)];for(const p of this.waypoints){p.y=this.height(p.x,p.z);points.push(new THREE.Vector3(p.x,p.y+.1,p.z));const ring=new THREE.Mesh(new THREE.TorusGeometry(.7,.055,6,32),new THREE.MeshBasicMaterial({color:'#ffd0a2'}));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,p.y+.18,p.z);this.root.add(ring);}
    const curve=new THREE.CatmullRomCurve3(points);const pts=curve.getPoints(120);for(const p of pts)p.y=this.height(p.x,p.z)+.09;const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:'#a5dbd1',dashSize:.7,gapSize:.6,transparent:true,opacity:.7}));line.computeLineDistances();this.root.add(line);
  }
  makeMap(){
    const n=this.data.size,canvas=document.createElement('canvas');canvas.width=canvas.height=240;const ctx=canvas.getContext('2d');ctx.fillStyle='#0a2834';ctx.fillRect(0,0,240,240);const image=ctx.createImageData(240,240);
    for(let y=0;y<240;y++)for(let x=0;x<240;x++){const u=x/239,v=y/239,h=sampleTerrain(this.data,u,v),level=(h-this.stats.min)/(this.stats.relief||1),i=(y*240+x)*4;image.data[i]=14+level*28;image.data[i+1]=42+level*43;image.data[i+2]=52+level*35;image.data[i+3]=255;const interval=Math.max(50,this.stats.relief/14);if(h%interval<interval*.045){image.data[i]=61;image.data[i+1]=137;image.data[i+2]=139;}}
    ctx.putImageData(image,0,0);this.mapBase=canvas;
  }
  drawMap(){if(!this.mapBase||!this.robot)return;const canvas=this.minimap,ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.drawImage(this.mapBase,0,0,w,h);const toMap=(x,z)=>[(x/this.width+.5)*w,(z/this.depth+.5)*h];ctx.strokeStyle='#e0e1c5';ctx.lineWidth=1.2;ctx.setLineDash([3,4]);ctx.beginPath();let p=toMap(this.spawn.x,this.spawn.z);ctx.moveTo(...p);for(const waypoint of this.waypoints){p=toMap(waypoint.x,waypoint.z);ctx.lineTo(...p);}ctx.stroke();ctx.setLineDash([]);for(const wp of this.waypoints){p=toMap(wp.x,wp.z);ctx.fillStyle='#eea15e';ctx.beginPath();ctx.arc(...p,2.6,0,Math.PI*2);ctx.fill();}p=toMap(this.spawn.x,this.spawn.z);ctx.strokeStyle='#dddac5';ctx.strokeRect(p[0]-3,p[1]-4,6,8);p=toMap(this.robot.position.x,this.robot.position.z);ctx.save();ctx.translate(...p);ctx.rotate(-this.robot.rotation.y);ctx.fillStyle='#ffb064';ctx.strokeStyle='#fff0d0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle='#afc7ce';ctx.font='9px sans-serif';ctx.fillText('32 km',9,h-9);ctx.fillText(this.data.projection?.type==='south-polar-stereographic'?'Y ↑':'N ↑',w-28,14);}
  setActive(active){this.active=active;this.keys.clear();if(active){this.resize();this.last=performance.now();}}
  setPaused(value){this.paused=value;this.keys.clear();}
  setMove(direction,pressed){const key={forward:'w',backward:'s',left:'a',right:'d'}[direction];if(pressed)this.keys.add(key);else this.keys.delete(key);}
  resize(){if(!this.renderer)return;const r=this.container.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
  skipArrival(){if(!this.robot)return;this.clock=15;this.rocket.position.y=this.spawn.y;this.rocket.userData.setThrust?.(0);this.rocket.userData.setDeployment(1);this.robot.visible=true;this.robot.position.set(this.spawn.x,this.height(this.spawn.x,this.spawn.z-8),this.spawn.z-8);this.phase='explore';this.lastStage='explore';this.onStage?.('explore',1);this.renderer.domElement.focus({preventScroll:true});}
  changeCamera(){this.follow=!this.follow;if(!this.follow){this.orbitPitch=.8;this.cameraDistance=28;}else{this.orbitPitch=.32;this.cameraDistance=15;}return this.follow?'Follow camera':'Survey camera';}
  telemetry(){if(!this.robot)return null;const x=this.robot.position.x,z=this.robot.position.z,u=x/this.width+.5,v=z/this.depth+.5;return{siteId:this.site.id,siteName:this.site.name,body:this.site.body,lat:terrainCoordinates(this.data,u,v).lat,lon:terrainCoordinates(this.data,u,v).lon,height:sampleTerrain(this.data,u,v),slope:this.pointSlope(x,z),distanceMeters:this.totalDistance/this.scale,gridSpacingMeters:this.data.widthMeters/(this.data.size-1),baselineMeters:this.stats.gradientBaselineMeters.x,avatarScaleEnlarged:true,decorativeRocks:true,position:{x,z},u,v};}
  tick(time){const dt=Math.min((time-this.last)/1000,.045);this.last=time;if(!this.active||!this.data||this.paused||!this.renderer)return;this.clock+=dt;let moving=0;
    if(this.phase!=='explore'){
      const t=this.clock;
      if(t<6){const p=smooth(t/6);this.rocket.position.y=this.spawn.y+(1-p)*110;this.rocket.userData.setThrust?.((1-p)*1.3+.15);this.phase='landing';}
      else if(t<9){this.phase='deploy';this.rocket.position.y=this.spawn.y;this.rocket.userData.setThrust?.(0);this.rocket.userData.setDeployment(smooth((t-6)/3));}
      else if(t<14){this.phase='deploy';this.robot.visible=true;const p=smooth((t-9)/5),z=THREE.MathUtils.lerp(this.spawn.z-.8,this.spawn.z-8,p);let y=this.height(this.spawn.x,z);if(z>this.spawn.z-5.8)y=Math.max(y,this.spawn.y+Math.max(0,1.3*(1-(this.spawn.z-z-.8)/5)));this.robot.position.set(this.spawn.x,y,z);moving=.8;}
      else{this.skipArrival();}
      if(this.lastStage!==this.phase){this.onStage?.(this.phase,clamp(t/14,0,1));this.lastStage=this.phase;}
      const p=smooth(this.clock/14),altitude=this.rocket.position.y-this.spawn.y,cameraTarget=new THREE.Vector3(this.spawn.x+24-p*7,this.spawn.y+15-p*5+altitude*.5,this.spawn.z-33+p*9);this.camera.position.lerp(cameraTarget,1-Math.exp(-dt*2));this.lookTarget.lerp(new THREE.Vector3(this.spawn.x,this.spawn.y+4+altitude*.82,this.spawn.z-1),1-Math.exp(-dt*3));
    }else{
      const forward=(this.keys.has('w')||this.keys.has('arrowup')?1:0)-(this.keys.has('s')||this.keys.has('arrowdown')?1:0),turn=(this.keys.has('a')||this.keys.has('arrowleft')?1:0)-(this.keys.has('d')||this.keys.has('arrowright')?1:0);this.robot.rotation.y+=turn*dt*1.5;const speed=this.keys.has('shift')?5.8:2.6;let x=this.robot.position.x-Math.sin(this.robot.rotation.y)*forward*speed*dt,z=this.robot.position.z-Math.cos(this.robot.rotation.y)*forward*speed*dt;
      x=clamp(x,-this.width*.475,this.width*.475);z=clamp(z,-this.depth*.475,this.depth*.475);
      for(const rock of this.obstacles){const dx=x-rock.x,dz=z-rock.z,d=Math.hypot(dx,dz);if(d<rock.r&&d>.001){x=rock.x+dx/d*rock.r;z=rock.z+dz/d*rock.r;}}
      this.totalDistance+=Math.hypot(x-this.robot.position.x,z-this.robot.position.z);this.robot.position.x=x;this.robot.position.z=z;this.robot.position.y=this.height(x,z);
      const hFront=this.height(x-Math.sin(this.robot.rotation.y)*1.2,z-Math.cos(this.robot.rotation.y)*1.2),hBack=this.height(x+Math.sin(this.robot.rotation.y)*1.2,z+Math.cos(this.robot.rotation.y)*1.2);this.robot.rotation.x=THREE.MathUtils.lerp(this.robot.rotation.x,clamp(Math.atan2(hFront-hBack,2.4),-.3,.3),.1);
      moving=forward?1:turn?.45:0;
      const angle=this.robot.rotation.y+this.orbitYaw,dist=this.cameraDistance,desired=new THREE.Vector3(x+Math.sin(angle)*dist,this.robot.position.y+Math.sin(this.orbitPitch)*dist+2,z+Math.cos(angle)*dist);desired.y=Math.max(desired.y,this.height(desired.x,desired.z)+2.5);this.camera.position.lerp(desired,1-Math.exp(-dt*3.5));this.lookTarget.lerp(new THREE.Vector3(x-Math.sin(this.robot.rotation.y)*3,this.robot.position.y+1,z-Math.cos(this.robot.rotation.y)*3),1-Math.exp(-dt*5));
    }
    this.robot.userData.setStance?.(this.phase==='explore'?1:smooth((this.clock-12)/2));this.robot.updateMatrixWorld(true);this.robot.userData.update?.(dt,this.clock,moving,(x,z)=>this.walkSurfaceHeight(x,z));this.camera.lookAt(this.lookTarget);const sx=this.robot.position.x,sz=this.robot.position.z;this.sun.position.set(sx-35,this.robot.position.y+60,sz-20);this.sun.target.position.set(sx,this.robot.position.y,sz);this.sun.target.updateMatrixWorld();
    if(time-(this.lastTelemetry||0)>180){this.lastTelemetry=time;this.onTelemetry?.(this.telemetry());this.drawMap();}this.renderer.render(this.scene,this.camera);
  }
}
