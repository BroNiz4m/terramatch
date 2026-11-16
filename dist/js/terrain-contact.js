import * as THREE from '../vendor/three.module.js';
const clamp=THREE.MathUtils.clamp;
/** Interpolate the exact two triangles used by PlaneGeometry, in source metres. */
export function meshElevation(data,u,v){
 const {size:n,heights}=data,x=clamp(u,0,1)*(n-1),z=clamp(v,0,1)*(n-1),ix=Math.min(n-2,Math.floor(x)),iz=Math.min(n-2,Math.floor(z)),a=x-ix,b=z-iz,nw=heights[iz*n+ix],ne=heights[iz*n+ix+1],sw=heights[(iz+1)*n+ix],se=heights[(iz+1)*n+ix+1];
 return a+b<=1?nw+(ne-nw)*a+(sw-nw)*b:se+(sw-se)*(1-a)+(ne-se)*(1-b);
}
export function groundHeight(exp,x,z){return(meshElevation(exp.data,x/exp.width+.5,z/exp.depth+.5)-exp.base)*exp.scale;}
export function terrainAttitude(height,x,z,heading){
 const fx=-Math.sin(heading),fz=-Math.cos(heading),rx=Math.cos(heading),rz=-Math.sin(heading),forward=new THREE.Vector3(fx,(height(x+fx*1.15,z+fz*1.15)-height(x-fx*1.15,z-fz*1.15))/2.3,fz),right=new THREE.Vector3(rx,(height(x+rx*1.4,z+rz*1.4)-height(x-rx*1.4,z-rz*1.4))/2.8,rz),up=new THREE.Vector3().crossVectors(right,forward).normalize();
 if(up.y<0)up.negate();forward.addScaledVector(up,-forward.dot(up)).normalize();right.crossVectors(forward,up).normalize();return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward.negate()));
}
/** Keep the camera above hills along the whole sight line, not only at its endpoint. */
export function clearTerrainCamera(exp,position,target,clearance=1.8){
 const result=position.clone();for(let i=1;i<=20;i++){const t=i/20,x=THREE.MathUtils.lerp(target.x,result.x,t),z=THREE.MathUtils.lerp(target.z,result.z,t);if(Math.abs(x)>exp.width/2||Math.abs(z)>exp.depth/2)continue;const floor=exp.height(x,z)+clearance*(.3+.7*t),line=THREE.MathUtils.lerp(target.y,result.y,t);if(line<floor)result.y+=(floor-line)/t;}
 return result;
}
