import * as THREE from '../vendor/three.module.js';
import {BODY_SHAPES,earthGeodeticPosition,planetocentricPosition,surfacePosition,inversePosition,sampleGlobeElevation} from './globe-science.js';

// A single scale for every body, including its actual sampled radial relief.
export const METRES_TO_SCENE=2.3/BODY_SHAPES.earth.equatorialRadiusMeters;
export function bodyRadiusScene(body){return BODY_SHAPES[body].equatorialRadiusMeters*METRES_TO_SCENE;}
export function surfacePoint(body,lat,lon,dem=null,liftFraction=0){
  const xyz=dem?surfacePosition(dem,lat,lon):body==='earth'?earthGeodeticPosition(lat,lon):planetocentricPosition(body,lat,lon);
  const point=new THREE.Vector3(xyz[0],xyz[2],-xyz[1]).multiplyScalar(METRES_TO_SCENE);
  if(liftFraction)point.multiplyScalar(1+liftFraction);return point;
}
export function pointCoordinates(body,point){return inversePosition(body,[point.x/METRES_TO_SCENE,-point.z/METRES_TO_SCENE,point.y/METRES_TO_SCENE]);}
export function buildGlobeGeometry(body,{dem=null,westLongitude=-180,widthSegments=360,heightSegments=180}={}){
  const width=widthSegments+1,height=heightSegments+1,positions=new Float32Array(width*height*3),uv=new Float32Array(width*height*2),colors=new Float32Array(width*height*3),indices=[];
  const heights=dem?.heightsMeters||[0,1],min=Math.min(...heights),max=Math.max(...heights),cold=new THREE.Color('#183851'),mid=new THREE.Color('#6eb6b0'),high=new THREE.Color('#efe1ab'),color=new THREE.Color();
  for(let row=0;row<height;row++)for(let col=0;col<width;col++){
    const lat=90-row/heightSegments*180,lon=westLongitude+col/widthSegments*360,index=row*width+col,p=surfacePoint(body,lat,lon,dem);
    positions.set(p.toArray(),index*3);uv.set([col/widthSegments,1-row/heightSegments],index*2);
    const value=dem?sampleGlobeElevation(dem,lat,lon):0,t=(value-min)/(max-min||1);color.copy(t<.5?cold:mid).lerp(t<.5?mid:high,t<.5?t*2:(t-.5)*2);colors.set(color.toArray(),index*3);
    if(row<heightSegments&&col<widthSegments){const a=index,b=index+width,c=b+1,d=index+1;indices.push(a,b,d,b,c,d);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.userData={body,verticalExaggeration:1,scaleMetresToScene:METRES_TO_SCENE,westLongitude,sourceGrid:dem?{width:dem.width,height:dem.height}:null,elevationRangeMeters:[min,max],datum:dem?.datum||'Reference figure only; global elevation unavailable'};return geometry;
}
