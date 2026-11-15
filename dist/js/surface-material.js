import * as THREE from '../vendor/three.module.js';

// Artistic albedo only: these images never supply heights, geology or scores.
export const SURFACE_ASSETS={moon:['moon-mare','moon-highlands'],mars:['mars-dunes','mars-layered']};
export function surfaceSeed(site,data){
  const center=data.center||site;let hash=2166136261;
  for(const ch of `${site.body}:${center.lat}:${center.lon}`)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  return (hash>>>0)%2147483646+1;
}
export function surfaceBlend(slopes){return Float32Array.from(slopes,slope=>THREE.MathUtils.smoothstep(Number.isFinite(slope)?slope:0,.5,8));}

export function installSurfaceMaterial(expedition,{loader=new THREE.TextureLoader()}={}){
  const names=SURFACE_ASSETS[expedition.site.body];if(!names)return ()=>{};
  const material=expedition.terrainMaterial,terrain=expedition.terrain;
  const textures=[];let cancelled=false,loaded=0;
  const seed=surfaceSeed(expedition.site,expedition.data),offset=(seed%1000)/1000;
  terrain.geometry.setAttribute('surfaceBlend',new THREE.BufferAttribute(surfaceBlend(expedition.stats.slopeGrid),1));
  const release=()=>{cancelled=true;textures.forEach(texture=>texture.dispose());};
  for(const name of names){
    const texture=loader.load(new URL(`../assets/terrain-concepts/${name}.png`,import.meta.url).href,()=>{
      if(cancelled||expedition.terrain!==terrain)return;
      if(++loaded!==2)return;
      expedition.groundTexture?.dispose();expedition.groundTexture=null;
      expedition.surfaceTexture=textures[0];material.map=expedition.layer==='surface'?textures[0]:null;
      material.onBeforeCompile=shader=>{
        shader.uniforms.roughSurfaceMap={value:textures[1]};
        shader.vertexShader='attribute float surfaceBlend;\nvarying float vSurfaceBlend;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceBlend = surfaceBlend;');
        shader.fragmentShader='uniform sampler2D roughSurfaceMap;\nvarying float vSurfaceBlend;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          vec4 surfaceColor = mix(texture2D(map, vMapUv), texture2D(roughSurfaceMap, vMapUv), vSurfaceBlend);
          diffuseColor *= surfaceColor;
        #endif`);
      };
      material.customProgramCacheKey=()=> 'illustrative-surface-v1';material.needsUpdate=true;
      expedition.recolor();
    },undefined,()=>{if(!cancelled){release();expedition.surfaceTexture=null;}});
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(75,75);
    texture.offset.set(offset,((seed>>>8)%1000)/1000);texture.center.set(.5,.5);
    texture.rotation=(seed%4)*Math.PI/2;texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(4,expedition.renderer?.capabilities?.getMaxAnisotropy?.()||1);
    textures.push(texture);
  }
  return release;
}
