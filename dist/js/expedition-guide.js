import {groundHeight} from './terrain-contact.js';
import * as THREE from '../vendor/three.module.js';

const clamp=THREE.MathUtils.clamp;
export const GUIDE_NEAR_RADIUS=4; // Display units, not a field-safety or instrument footprint.

/** Follow the rendered DEM triangles without adding heights to the source dataset. */
export const guideSurfaceHeight=groundHeight;

export function nearestGuidePoint(waypoints,position,radius=GUIDE_NEAR_RADIUS){
 if(!position||!waypoints.length)return null;
 let nearest=null;
 for(const point of waypoints){const distance=Math.hypot(position.x-point.x,position.z-point.z);if(!nearest||distance<nearest.distance)nearest={number:point.number,distance,near:distance<=radius};}
 return nearest;
}

function clearPoint(exp,point){
 const clear=(x,z)=>!(exp.obstacles||[]).some(o=>Math.hypot(x-o.x,z-o.z)<o.r+1.2);
 if(clear(point.x,point.z))return point;
 for(let radius=2;radius<=14;radius+=2)for(let step=0;step<12;step++){
  const x=clamp(point.x+Math.cos(step*Math.PI/6)*radius,-exp.width*.44,exp.width*.44),z=clamp(point.z+Math.sin(step*Math.PI/6)*radius,-exp.depth*.44,exp.depth*.44);
  if(clear(x,z))return {...point,x,z};
 }
 return point; // Optional visual guide; no traversability or safe-route claim is made.
}

export function guidePointProjection(point,camera,viewport,exp){
 const position=new THREE.Vector3(point.x,point.y+1.2,point.z),view=position.clone().applyMatrix4(camera.matrixWorldInverse),projected=position.clone().project(camera);
 let visible=view.z< -camera.near&&projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<.98&&Math.abs(projected.y)<.96;
 if(visible&&exp){
  for(let i=1;i<12;i++){const t=i/12,x=THREE.MathUtils.lerp(camera.position.x,position.x,t),z=THREE.MathUtils.lerp(camera.position.z,position.z,t),y=THREE.MathUtils.lerp(camera.position.y,position.y,t);
   if(Math.abs(x)<=exp.width/2&&Math.abs(z)<=exp.depth/2&&guideSurfaceHeight(exp,x,z)>y+.1){visible=false;break;}
  }
 }
 return {number:point.number,x:(projected.x*.5+.5)*viewport.width,y:(.5-projected.y*.5)*viewport.height,visible,u:point.x/(exp?.width||500)+.5,v:point.z/(exp?.depth||500)+.5};
}

export function createExpeditionGuide(exp,{reducedMotion=false}={}){
 const group=new THREE.Group();group.name='Example route · Optional guide points';group.visible=false;exp.root.add(group);
 const waypoints=[{x:exp.spawn.x+7,z:exp.spawn.z-28},{x:exp.spawn.x+24,z:exp.spawn.z-62},{x:exp.spawn.x+9,z:exp.spawn.z-100}].map((point,index)=>{
  const safe=clearPoint(exp,point);return {...safe,number:index+1,y:guideSurfaceHeight(exp,safe.x,safe.z)};
 });
 const controls=[new THREE.Vector3(exp.spawn.x,exp.spawn.y,exp.spawn.z-8),...waypoints.map(p=>new THREE.Vector3(p.x,p.y,p.z))],curve=new THREE.CatmullRomCurve3(controls),points=curve.getPoints(360),distances=new Float32Array(points.length);
 for(let i=0;i<points.length;i++){const point=points[i];point.y=guideSurfaceHeight(exp,point.x,point.z)+.12;if(i)distances[i]=distances[i-1]+point.distanceTo(points[i-1]);}
 const length=distances.at(-1),geometry=new THREE.BufferGeometry().setFromPoints(points);geometry.setAttribute('lineDistance',new THREE.BufferAttribute(distances,1));
 const uniforms={uHead:{value:0},uLength:{value:length},uTail:{value:8},uMotion:{value:reducedMotion?0:1},uPointScale:{value:Math.min(globalThis.devicePixelRatio||1,1.6)},uBase:{value:new THREE.Color('#4ea99f')},uBright:{value:new THREE.Color('#c3fff3')}};
 const pulse='float behind = mod(uHead - vDistance + uLength, uLength); float pulse = uMotion * (1.0 - smoothstep(0.0, uTail, behind));';
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,toneMapped:false,
  vertexShader:'attribute float lineDistance; varying float vDistance; void main(){vDistance=lineDistance;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform float uHead,uLength,uTail,uMotion;uniform vec3 uBase,uBright;varying float vDistance;void main(){if(mod(vDistance,1.4)>.75)discard;${pulse}gl_FragColor=vec4(mix(uBase,uBright,pulse),0.42+pulse*0.55);\n#include <colorspace_fragment>\n}`});
 const line=new THREE.Line(geometry,material);line.renderOrder=2;group.add(line);
 const glowMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,
  vertexShader:'attribute float lineDistance;uniform float uPointScale;varying float vDistance;void main(){vDistance=lineDistance;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=6.0*uPointScale;}',
  fragmentShader:`uniform float uHead,uLength,uTail,uMotion;uniform vec3 uBright;varying float vDistance;void main(){${pulse}if(pulse<0.03||mod(vDistance,1.4)>.75)discard;float radius=length(gl_PointCoord-vec2(0.5))*2.0;if(radius>1.0)discard;gl_FragColor=vec4(uBright,pulse*pow(1.0-radius,1.8)*0.75);\n#include <colorspace_fragment>\n}`});
 const glow=new THREE.Points(geometry,glowMaterial);glow.renderOrder=3;glow.visible=!reducedMotion;group.add(glow);
 const rings=waypoints.map(point=>{
  const vertices=[];for(let step=0;step<64;step++){const angle=step/64*Math.PI*2,x=point.x+Math.cos(angle),z=point.z+Math.sin(angle);vertices.push(new THREE.Vector3(x,guideSurfaceHeight(exp,x,z)+.14,z));}
  const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color:'#79b9b0',transparent:true,opacity:.75,depthWrite:false}));ring.renderOrder=2;group.add(ring);return ring;
 });
 let elapsed=0,lastNearest=-1;
 function update(dt,camera,viewport){
  const exploring=exp.phase==='explore';group.visible=exploring;
  if(!exploring)return null;
  if(!reducedMotion)elapsed=(elapsed+Math.max(0,Math.min(dt,.1)))%(length/8);uniforms.uHead.value=elapsed*8;
  const nearest=nearestGuidePoint(waypoints,exp.robot?.position);
  if(nearest?.number!==lastNearest){lastNearest=nearest?.number;for(let i=0;i<rings.length;i++){rings[i].material.color.set(i+1===lastNearest?'#baffed':'#79b9b0');rings[i].material.opacity=i+1===lastNearest?1:.65;}}
  return {siteId:exp.site.id,nearest,markers:waypoints.map(point=>guidePointProjection(point,camera,viewport,exp)),example:true};
 }
 function drawMap(ctx,width,height){
  const map=p=>[(p.x/exp.width+.5)*width,(p.z/exp.depth+.5)*height];ctx.strokeStyle='#65bbb0';ctx.lineWidth=1.2;ctx.setLineDash([3,4]);ctx.beginPath();
  points.forEach((point,index)=>{const xy=map(point);if(index)ctx.lineTo(...xy);else ctx.moveTo(...xy);});ctx.stroke();ctx.setLineDash([]);
  for(const point of waypoints){const xy=map(point);ctx.strokeStyle=point.number===lastNearest?'#baffed':'#79b9b0';ctx.beginPath();ctx.arc(...xy,3,0,Math.PI*2);ctx.stroke();}
 }
 return {group,waypoints,points,uniforms,update,drawMap,
  setReducedMotion(value){reducedMotion=!!value;uniforms.uMotion.value=value?0:1;glow.visible=!value;},
  dispose(){group.removeFromParent();geometry.dispose();material.dispose();glowMaterial.dispose();for(const ring of rings){ring.geometry.dispose();ring.material.dispose();}}
 };
}
