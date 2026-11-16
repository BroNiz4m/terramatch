import * as THREE from '../vendor/three.module.js';
import {loadLocationImagery} from './location-imagery.js?v=20261116-lunar-1';
import {installLunarSurface,prepareLunarImage,makeLunarRocks} from './lunar-surface.js?v=20261116-mars-1';

/** CTX is monochrome: the display tint and fine regolith are not measured colours or geology. */
export async function loadMarsSurfaceImage(site,data,{load=loadLocationImagery,...options}={}){
 if(site?.body!=='mars')throw Error('A Martian surface image requires a Mars location.');
 const requestedSize=options.size??1024,delivery=[];let result;
 try{result=await load(site,data,{...options,size:requestedSize});}
 catch(error){
  if(options.signal?.aborted||requestedSize<=512||!(/HTTP|coverage|supported image|dimensions|decode/i.test(error.message||'')||error.name==='AbortError'))throw error;
  delivery.push({requestedSize,reason:error.message||'The high-resolution image request timed out.',fallbackSize:512});
  result=await load(site,data,{...options,size:512});
 }
 const center=result.metadata?.center;
 if(!center||![center.lat,center.lon,site.lat,site.lon].every(Number.isFinite)||Math.abs(center.lat-site.lat)>1e-5||Math.abs(((center.lon-site.lon+540)%360)-180)>1e-5)throw Error('CTX imagery does not match the selected Mars coordinates.');
 return {...result,metadata:{...result.metadata,body:'mars',colourMode:'Monochrome CTX observation with illustrative display tint',
  surfaceTint:'#b3a291',deliveryFallback:delivery,colourCaveat:'CTX records monochrome surface appearance. The muted warm-grey display tint is illustrative; no mineral, soil colour, dunes or ice classification is inferred.',
  processing:(result.metadata.processing||'')+' Fixed geographic UVs on the selected DEM; a display tint and fine grain are illustrative. No terrain displacement.'}};
}

export function prepareMarsImage(image,options={}){
 return prepareLunarImage(image,{...options,sourceName:'CTX',bodyName:'Martian'});
}

export function installMarsSurface(exp,options={}){
 return installLunarSurface(exp,{loadImagery:loadMarsSurfaceImage,prepareImage:prepareMarsImage,...options,surfaceStyle:'mars'});
}

export function marsLighting(site){
 const latitude=THREE.MathUtils.clamp(Math.abs(site.lat)/80,0,1),elevation=THREE.MathUtils.lerp(38,18,latitude)*Math.PI/180;
 return {offset:new THREE.Vector3(-55,Math.tan(elevation)*75,-50),sun:2.7,hemisphere:.9,rim:.2,
  note:'Illustrative sunlight and atmospheric haze for terrain readability, not observation-time weather or seasonal illumination.'};
}

export function makeMarsRocks(exp){
 const group=makeLunarRocks(exp);group.name='Illustrative Martian rock fragments and regolith clasts';
 for(const mesh of group.children){mesh.material.color.set('#a59a8b');mesh.material.bumpScale=.06;mesh.userData.placement='Coordinate-seeded illustrative fragments on the source DEM; not observed rock abundance, composition or positions.';}
 return group;
}
