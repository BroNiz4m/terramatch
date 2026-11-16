import * as THREE from '../vendor/three.module.js';
import {installLunarSurface} from './lunar-surface.js?v=20261116-mars-1';
import {installMarsSurface} from './mars-surface.js?v=20261116-mars-1';

// Legacy concept images are retained as assets but no longer used by the surface renderer.
export const SURFACE_ASSETS={};
export function surfaceSeed(site,data){
  const center=data.center||site;let hash=2166136261;
  for(const ch of `${site.body}:${center.lat}:${center.lon}`)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  return (hash>>>0)%2147483646+1;
}
export function surfaceBlend(slopes){return Float32Array.from(slopes,slope=>THREE.MathUtils.smoothstep(Number.isFinite(slope)?slope:0,.5,8));}

export function installSurfaceMaterial(expedition,options={}){
  if(expedition.site.body==='moon')return installLunarSurface(expedition,options);
  if(expedition.site.body==='mars')return installMarsSurface(expedition,options);
  return ()=>{};
}
