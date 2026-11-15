import * as THREE from '../vendor/three.module.js';
import {loadLocationImagery} from './location-imagery.js?v=20261116-lunar-1';
import {terrainCoordinates} from './science.js';

const clamp=THREE.MathUtils.clamp;
export const LUNAR_POLAR_SOURCE={id:'lroc-wac-south-surface',body:'moon',title:'LRO LROC WAC south-polar mosaic v2 · 100 m',agency:'NASA/GSFC/Arizona State University · NASA/JPL Moon Trek',
 url:'https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_WAC_Mosaic_SPole60_100m_v02/ImageServer',
 credit:'NASA/GSFC/Arizona State University · LROC Team · NASA/JPL Moon Trek',license:'Public mission imagery; retain NASA/GSFC/ASU/LROC and Trek credit.',
 note:'Historical orbital mosaic, not calibrated reflectance or live illumination. Reprojected to the selected DEM footprint. Black shadows are retained; microdetail and decorative rocks are illustrative. Imagery does not alter DEM heights or scores.'};
const polarWKT='PROJCS["PolarStereographic_Moon",GEOGCS["GCS_Moon",DATUM["D_Moon",SPHEROID["Moon",1737400.0,0.0]],PRIMEM["Reference_Meridian",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Stereographic_South_Pole"],PARAMETER["false_easting",0.0],PARAMETER["false_northing",0.0],PARAMETER["central_meridian",0.0],PARAMETER["standard_parallel_1",-90.0],UNIT["Meter",1.0]]';

export function lunarSurfacePlan(site,data,{size=1024}={}){
 if(site?.body!=='moon'||!Number.isFinite(site.lat)||!Number.isFinite(site.lon)||Math.abs(site.lat)>90||Math.abs(site.lon)>180)throw Error('Invalid lunar surface coordinates.');
 if(!Number.isInteger(size)||size<64||size>1024)throw Error('Unsupported lunar texture size.');
 if(data?.projection?.type!=='south-polar-stereographic')return null;
 const p=data.projection,center=terrainCoordinates(data,.5,.5),longitudeError=((center.lon-site.lon+540)%360)-180;
 if(Math.abs(p.radiusMeters-1737400)>.01||p.centralMeridian!==0||Math.abs(center.lat-site.lat)>1e-5||Math.abs(longitudeError)>1e-5)throw Error('The lunar polar grid does not match the selected site or registered projection.');
 const box=[p.xWest,p.ySouth,p.xEast,p.yNorth];
 if(!box.every(Number.isFinite)||!(p.xEast>p.xWest&&p.yNorth>p.ySouth)||Math.abs(p.xEast-p.xWest-data.widthMeters)>.01||Math.abs(p.yNorth-p.ySouth-data.depthMeters)>.01||data.widthMeters>100000||data.depthMeters>100000)throw Error('Invalid lunar polar footprint.');
 const height=Math.round(size*data.depthMeters/data.widthMeters),url=new URL(LUNAR_POLAR_SOURCE.url+'/exportImage'),crs=JSON.stringify({wkt:polarWKT});
 url.search=new URLSearchParams({f:'image',bbox:box.join(','),bboxSR:crs,imageSR:crs,size:size+','+height,format:'png32',interpolation:'RSP_BilinearInterpolation',adjustAspectRatio:'false'});
 return {url:url.href,width:size,height,projectedBounds:{west:p.xWest,east:p.xEast,south:p.ySouth,north:p.yNorth},source:LUNAR_POLAR_SOURCE};
}

export async function loadLunarSurfaceImage(site,data,{signal,fetchImpl=globalThis.fetch,size=1024,...options}={}){
 const plan=lunarSurfacePlan(site,data,{size});
 if(!plan)return loadLocationImagery(site,data,{signal,fetchImpl,size,...options});
 const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,16000);
 try{
  const response=await fetchImpl(plan.url,{signal:controller.signal,mode:'cors',cache:'force-cache'});if(!response.ok)throw Error('LRO polar imagery returned HTTP '+response.status+'.');
  const bytes=await response.arrayBuffer(),b=new Uint8Array(bytes);
  if(bytes.byteLength>8000000||!(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71))throw Error('No lunar polar image is available for this footprint.');
  const sha256=globalThis.crypto?.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join(''):null;
  return {blob:new Blob([bytes],{type:'image/png'}),metadata:{siteId:site.id,body:'moon',center:{lat:site.lat,lon:site.lon},sourceId:plan.source.id,product:plan.source.title,sourceURL:plan.source.url,credit:plan.source.credit,license:plan.source.license,caveat:plan.source.note,
   period:'Historical polar mosaic · acquisition dates vary',sourceResolutionMeters:100,resolution:'100 m source · reprojected display',extentMeters:{width:data.widthMeters,depth:data.depthMeters},projection:structuredClone(data.projection),projectedBounds:plan.projectedBounds,
   previewSamplingMeters:data.widthMeters/size,retrievedAt:new Date().toISOString(),requests:[{url:plan.url,sha256,bytes:bytes.byteLength}],processing:'Orbital image requested in the same south-polar stereographic CRS and X/Y bounds as the DEM. Not live lighting or a source of heights.'}};
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

function seedFor(site,data){let h=2166136261;for(const c of `${site.body}:${data.center?.lat??site.lat}:${data.center?.lon??site.lon}`)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function hash(x,y,seed){let h=Math.imul(x^seed,374761393)^Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(x,y,period,seed){const x0=Math.floor(x),y0=Math.floor(y),a=x-x0,b=y-y0,u=a*a*(3-2*a),v=b*b*(3-2*b),at=(i,j)=>hash((i%period+period)%period,(j%period+period)%period,seed);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(x0,y0),at(x0+1,y0),u),THREE.MathUtils.lerp(at(x0,y0+1),at(x0+1,y0+1),u),v);}

/** Display-only microstructure; never displaces vertices or enters terrain analysis. */
export function lunarRegolithTextures(seed,{size=256,repeat=200}={}){
 const albedo=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,low=noise(u*8,v*8,8,seed),medium=noise(u*32,v*32,32,seed+17),fine=noise(u*96,v*96,96,seed+31),grain=hash(x,y,seed+47),clast=Math.max(0,(medium-.62)/.38),pit=Math.max(0,(.3-low)/.3);
  const h=clamp(.42+.16*(low-.5)+.2*(fine-.5)+.14*(grain-.5)+clast*.22-pit*.15,0,1),tone=Math.round(127+(low-.5)*20+(fine-.5)*13+(grain-.5)*11+clast*14),i=(y*size+x)*4;
  for(let c=0;c<3;c++){albedo[i+c]=tone;height[i+c]=Math.round(h*255);roughness[i+c]=Math.round(230+grain*24);}albedo[i+3]=height[i+3]=roughness[i+3]=255;
 }
 const texture=(bytes,colorSpace)=>{const t=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=colorSpace;t.needsUpdate=true;return t;};
 return {albedo:texture(albedo,THREE.SRGBColorSpace),height:texture(height,THREE.NoColorSpace),roughness:texture(roughness,THREE.NoColorSpace)};
}

/** Contrast enhancement is for display, not an albedo/reflectance measurement. */
export function prepareLunarImage(image,{createCanvas=()=>document.createElement('canvas')}={}){
 const canvas=createCanvas();canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Lunar image inspection is unavailable.');ctx.drawImage(image,0,0);
 const rgba=ctx.getImageData(0,0,canvas.width,canvas.height),pixels=rgba.data,histogram=new Uint32Array(256);let valid=0;
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=250){histogram[pixels[i]]++;valid++;}
 if(valid/(pixels.length/4)<.98)throw Error('LRO imagery has incomplete coverage; illustrative detail retained.');
 const percentile=f=>{let count=0;for(let i=0;i<256;i++){count+=histogram[i];if(count>=valid*f)return i;}return 255;},low=percentile(.02),high=percentile(.98),median=percentile(.5);
 if(high-low<4)throw Error('No usable lunar image contrast in this footprint; illustrative detail retained.');
 for(let i=0;i<pixels.length;i+=4){const value=pixels[i]<3?pixels[i]:Math.round(38+170*Math.pow(clamp((pixels[i]-low)/(high-low),0,1),.8));pixels[i]=pixels[i+1]=pixels[i+2]=value;}
 ctx.putImageData(rgba,0,0);
 return {image:canvas,display:{contrastPercentiles:[low,high],sourceMedian:median,blackShadowsRetained:true,operation:'Monochrome 2–98 percentile display stretch; not calibrated reflectance.'}};
}

export function installLunarSurface(exp,{loadImagery=loadLunarSurfaceImage,loader=new THREE.TextureLoader(),prepareImage=prepareLunarImage}={}){
 const terrain=exp.terrain,material=exp.terrainMaterial,site=exp.site,data=exp.data,seed=seedFor(site,data),controller=new AbortController(),owned=[],urls=new Set();let cancelled=false;
 const detail=lunarRegolithTextures(seed,{repeat:(exp.width||500)/2.5});owned.push(...Object.values(detail));
 for(const t of owned)t.anisotropy=Math.min(8,exp.renderer?.capabilities?.getMaxAnisotropy?.()||1);
 const active=()=>!cancelled&&exp.terrain===terrain&&exp.site===site;
 const publish=record=>{if(active()){exp.surfaceRecord=record;exp.onSurface?.(record);}};
 const sync=()=>{material.bumpMap=exp.layer==='surface'?detail.height:null;material.roughnessMap=exp.layer==='surface'?detail.roughness:null;material.bumpScale=.045;material.needsUpdate=true;};
 exp.updateSurfaceLayer=sync;exp.surfaceTexture=detail.albedo;material.color.set('#c8c8c5');material.roughness=1;material.metalness=0;sync();exp.recolor();
 publish({siteId:site.id,status:'loading',mode:'illustrative-detail',note:'Looking for LRO imagery for this footprint. Fine grain, rocks and lighting are illustrations.'});
 // Source image has fixed geographic UVs. Only the unmeasured fine grain repeats.
 material.onBeforeCompile=shader=>{
  shader.uniforms.lunarGrain={value:detail.albedo};
  shader.vertexShader='varying vec2 vLunarDetailUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLunarDetailUv = uv * '+((exp.width||500)/2.5).toFixed(1)+';');
  shader.fragmentShader='uniform sampler2D lunarGrain;\nvarying vec2 vLunarDetailUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    vec4 observed = texture2D(map, vMapUv);
    float grain = texture2D(lunarGrain, vLunarDetailUv).r;
    float broad = texture2D(lunarGrain, vLunarDetailUv * 0.071 + vec2(0.23,0.61)).r;
    diffuseColor *= vec4(observed.rgb * (0.84 + grain * 0.55) * (0.96 + broad * 0.10), observed.a);
  #endif`);
 };
 material.customProgramCacheKey=()=> 'lunar-observed-material-v1';material.needsUpdate=true;
 void (async()=>{
  try{
   const result=await loadImagery(site,data,{signal:controller.signal,size:1024});if(!active())return;
   const url=URL.createObjectURL(result.blob);urls.add(url);
   await new Promise((resolve,reject)=>{
    const texture=loader.load(url,imageTexture=>{
     urls.delete(url);URL.revokeObjectURL(url);
     if(!active()){resolve();return;}
     try{
      const prepared=prepareImage(imageTexture.image);imageTexture.image=prepared.image;imageTexture.wrapS=imageTexture.wrapT=THREE.ClampToEdgeWrapping;imageTexture.repeat.set(1,1);imageTexture.offset.set(0,0);imageTexture.rotation=0;imageTexture.colorSpace=THREE.SRGBColorSpace;imageTexture.anisotropy=Math.min(8,exp.renderer?.capabilities?.getMaxAnisotropy?.()||1);imageTexture.needsUpdate=true;
      exp.surfaceTexture=imageTexture;exp.groundTexture?.dispose();exp.groundTexture=null;exp.recolor();
      publish({siteId:site.id,status:'available',mode:'orbital-imagery-with-illustrative-detail',...result.metadata,display:prepared.display,
       detail:'Fine regolith, rock shapes/placement and sunlight are illustrative. No added craters, no displaced DEM vertices, no inferred ice or material classification.'});resolve();
     }catch(error){reject(error);}
    },undefined,reject);owned.push(texture);
   });
  }catch(error){if(active())publish({siteId:site.id,status:'unavailable',mode:'illustrative-detail',reason:error.message||'LRO imagery could not be loaded.',detail:'Fine regolith and rocks remain illustrative. DEM heights remain available.'});}
 })();
 return ()=>{cancelled=true;controller.abort();if(exp.updateSurfaceLayer===sync)exp.updateSurfaceLayer=null;for(const url of urls)URL.revokeObjectURL(url);for(const t of owned)t.dispose();};
}

export function lunarLighting(site){
 const polar=clamp((Math.abs(site.lat)-60)/25,0,1),elevation=THREE.MathUtils.lerp(32,7,polar)*Math.PI/180;
 return {offset:new THREE.Vector3(-70,Math.tan(elevation)*80,-39),hemisphere:.24,rim:.08,sun:3.1,
  note:'Illustrative sunlight selected for terrain readability; not reconstructed observation-time illumination or a permanent-shadow calculation.'};
}

function rockGeometry(seed){
 const geometry=new THREE.IcosahedronGeometry(1,2),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),factor=1+.12*Math.sin(x*7.2+z*3.1+seed)+.10*Math.sin(y*9.3-x*4.8+seed*.37)+.07*Math.cos(z*12.7+y*4.1);
  p.setXYZ(i,x*factor,Math.max(-.66,y*factor)*.8,z*factor);
 }
 geometry.computeVertexNormals();return geometry;
}

/** Decorative clasts are deterministic per coordinate; they are not mapped boulders. */
export function makeLunarRocks(exp){
 const group=new THREE.Group();group.name='Illustrative lunar rocks and regolith clasts';exp.root.add(group);let seed=seedFor(exp.site,exp.data)||1;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const clastDetail=lunarRegolithTextures(seed,{size:128,repeat:2.2});
 const material=new THREE.MeshStandardMaterial({color:'#b7b5b1',map:clastDetail.albedo,bumpMap:clastDetail.height,bumpScale:.075,roughnessMap:clastDetail.roughness,roughness:1,metalness:0}),variants=4,count=55,dummy=new THREE.Object3D();
 const clusters=Array.from({length:5},()=>({x:exp.spawn.x+(random()-.5)*100,z:exp.spawn.z+(random()-.5)*100}));
 for(let variant=0;variant<variants;variant++){
  const mesh=new THREE.InstancedMesh(rockGeometry(variant*7.31+1),material,count);mesh.castShadow=mesh.receiveShadow=true;
  for(let i=0;i<count;i++){
   const cluster=clusters[(i+variant)%clusters.length],spread=6+random()*15;
   let x=i%3?cluster.x+(random()+random()-1)*spread:exp.spawn.x+(random()-.5)*145,z=i%3?cluster.z+(random()+random()-1)*spread:exp.spawn.z+(random()-.5)*145;
   if(Math.abs(x-exp.spawn.x)<8&&Math.abs(z-exp.spawn.z)<15)x+=16;
   const slope=exp.pointSlope(x,z),r=.10+Math.pow(random(),2.4)*1.05;
   dummy.position.set(x,exp.height(x,z)+r*.18,z);dummy.rotation.set((random()-.5)*.45,random()*Math.PI*2,(random()-.5)*.45);dummy.scale.set(r*(.8+random()*.6),r*(.6+random()*.5),r*(.7+random()*.8));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   mesh.setColorAt(i,new THREE.Color().setScalar(.65+random()*.35));
   if(r>.48)exp.obstacles.push({x,z,r:r+1.4});
   mesh.userData.placement='Coordinate-seeded illustration; local DEM slope '+(Number.isFinite(slope)?'available':'unavailable')+'; not a rock-abundance measurement.';
  }
  group.add(mesh);
 }
 const pebbles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),material,700);pebbles.receiveShadow=true;
 for(let i=0;i<700;i++){
  let x=exp.spawn.x+(random()-.5)*120,z=exp.spawn.z+(random()-.5)*120;
  if(Math.abs(x-exp.spawn.x)<5&&z>exp.spawn.z-11&&z<exp.spawn.z+4)x+=9;
  const r=.025+random()**3*.12;dummy.position.set(x,exp.height(x,z)+r*.12,z);dummy.rotation.set(random(),random()*6,random());dummy.scale.set(r*1.3,r*.65,r);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
 }
 group.add(pebbles);for(const foot of exp.lander.userData.footAnchors)exp.obstacles.push({x:exp.spawn.x+foot.x,z:exp.spawn.z+foot.z,r:1.25});
 exp.rocks=group;return group;
}
