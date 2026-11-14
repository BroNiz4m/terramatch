import {isLand} from './land-geometry.js';

export const COVERAGE_VERSION='coastal-screen-v2';
export const DETAILED_MASK_SHA256='1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416';
export const COVERAGE_LIMIT='Natural Earth 1:10 million is generalized coastline mapping, not 10-metre resolution. Passing these checks does not verify all small water bodies, current shorelines, dry ground or field suitability.';
const wrap=x=>((x+180)%360+360)%360-180;
const parts=g=>!g?[]:g.type==='FeatureCollection'?g.features.flatMap(parts):g.type==='Feature'?parts(g.geometry):g.type==='GeometryCollection'?g.geometries.flatMap(parts):g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
const indexCache=new WeakMap();
function index(mask){
  if(indexCache.has(mask))return indexCache.get(mask);
  const entries=parts(mask).map(coordinates=>{
    const rings=coordinates.map(ring=>{
      const polar=ring.some(p=>p[1]<=-89.9)&&ring.some(p=>p[0]>179)&&ring.some(p=>p[0]<-179);
      let previous=ring[0][0];return ring.map(([lon,lat])=>{if(!polar){while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;}previous=lon;return [lon,lat];});
    });
    let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
    for(const [x,y]of rings[0]){west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);}
    return{coordinates,rings,west,east,south,north};
  });indexCache.set(mask,entries);return entries;
}
function clip(a,b,box){
  const dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1;
  for(const [p,q]of [[-dx,a[0]-box.west],[dx,box.east-a[0]],[-dy,a[1]-box.south],[dy,box.north-a[1]]]){
    if(p===0){if(q<0)return null;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
  }
  const t=(lo+hi)/2;return[a[0]+t*dx,a[1]+t*dy];
}
export function currentCoverage(data){
  const a=data?.source?.coverageAssessment,b=data?.bounds;
  return !!a&&a.version===COVERAGE_VERSION&&(a.detailed?.source?.sha256===DETAILED_MASK_SHA256||a.detailed?.source?.provided===true)&&['north','south','west','east'].every(k=>Number.isFinite(b?.[k])&&a.bounds?.[k]===b[k]);
}
export function assessLandCoverage(bounds,coarse,mask,source,error=null){
  const base={version:COVERAGE_VERSION,bounds:{...bounds},checkedAt:new Date().toISOString(),coarse};
  if(!mask)return{...base,status:'review-required',reason:'Detailed coastline screening is unavailable. Analyze this location again when the local mask can be loaded.',detailed:{available:false,error:String(error||'Mask unavailable').slice(0,200),source:source||null},limitation:COVERAGE_LIMIT};
  const center=(bounds.west+bounds.east)/2,selected=[];
  for(const item of index(mask)){
    const shift=360*Math.round((center-(item.west+item.east)/2)/360);
    if(item.east+shift>=bounds.west&&item.west+shift<=bounds.east&&item.north>=bounds.south&&item.south<=bounds.north)selected.push({...item,shift});
  }
  const local={type:'MultiPolygon',coordinates:selected.map(x=>x.coordinates)},examples=[];let land=0;
  for(let row=0;row<65;row++)for(let col=0;col<65;col++){
    const lat=bounds.north+(bounds.south-bounds.north)*row/64,lon=wrap(bounds.west+(bounds.east-bounds.west)*col/64),mappedLand=isLand(lon,lat,local);
    if(mappedLand)land++;else if(examples.length<25)examples.push({row,col,lat,lon,mappedLand:false});
  }
  const edgeExamples=[];let coastlineIntersections=0;
  const cosine=Math.max(.01,Math.cos((bounds.north+bounds.south)/2*Math.PI/180)),oneMeter=180/(Math.PI*6371008.8);
  for(const item of selected)for(const ring of item.rings)for(let i=1;i<ring.length;i++){
    const a=[ring[i-1][0]+item.shift,ring[i-1][1]],b=[ring[i][0]+item.shift,ring[i][1]],p=clip(a,b,bounds);if(!p)continue;
    const dx=(b[0]-a[0])*cosine,dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;
    const ox=-dy/length*oneMeter/cosine,oy=dx/length*oneMeter;
    // Natural Earth divides continental land into adjacent polygon pieces. A shared
    // edge with land on both sides is not coastline. Preserve true holes and islands.
    if(isLand(wrap(p[0]+ox),p[1]+oy,local)&&isLand(wrap(p[0]-ox),p[1]-oy,local))continue;
    coastlineIntersections++;if(edgeExamples.length<8)edgeExamples.push({lat:p[1],lon:wrap(p[0])});
  }
  const passed=coarse?.allLand===true&&land===4225&&coastlineIntersections===0;
  return{...base,status:passed?'screened-land':'review-required',reason:passed?null:coarse?.allLand!==true?'The coarse land screen includes non-land samples. This does not classify the whole location as water or unsuitable.':land<4225?'The detailed coastline screen includes non-land samples inside this window. Score and ranking require coverage review.':'Mapped coastline touches or crosses this window, including between terrain samples. Score and ranking require coverage review.',detailed:{available:true,source,gridSize:65,land,total:4225,nonLand:4225-land,examples,coastlineIntersections,edgeExamples,method:'65 × 65 point screen plus polygon-boundary intersections with the complete window; shared internal land-polygon edges ignored. Sample counts are not area fractions.'},limitation:COVERAGE_LIMIT};
}
