// Geographic polygon tests shared by coarse and detailed coastal screening.
const wrapLon=lon=>((lon+180)%360+360)%360-180;
function normalizeBounds(bounds){const {north,south,west,east}=bounds||{};if(![north,south,west,east].every(Number.isFinite)||north<=south||north>85||south< -85)throw new RangeError('Invalid land-screen bounds.');let e=east;while(e<=west)e+=360;if(e-west>360+1e-8)throw new RangeError('Invalid longitude span.');return {north,south,west,east:e};}
const ringCache=new WeakMap();
function ringContains(lon,lat,ring){
  if(!Array.isArray(ring)||ring.length<4)return false;
  if(!ringCache.has(ring)){
    // Preserve an Antarctic polygon's deliberate full-width edge along the pole.
    const polar=ring.some(point=>point[1]<=-89.9)&&ring.some(point=>point[0]<-179)&&ring.some(point=>point[0]>179);
    const points=[];let previous=ring[0][0];
    for(const point of ring){let x=point[0];if(!polar){while(x-previous>180)x-=360;while(x-previous < -180)x+=360;}points.push([x,point[1]]);previous=x;}
    let min=Infinity,max=-Infinity,minLat=Infinity,maxLat=-Infinity;
    for(const [x,y]of points){min=Math.min(min,x);max=Math.max(max,x);minLat=Math.min(minLat,y);maxLat=Math.max(maxLat,y);}
    const span=maxLat-minLat||1,bands=Array.from({length:128},()=>[]);
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const lo=Math.max(0,Math.floor((Math.min(points[i][1],points[j][1])-minLat-1e-9)/span*128)),hi=Math.min(127,Math.floor((Math.max(points[i][1],points[j][1])-minLat+1e-9)/span*128));
      for(let band=lo;band<=hi;band++)bands[band].push(i);
    }
    ringCache.set(ring,{points,polar,min,max,minLat,maxLat,span,bands});
  }
  const {points,polar,min,max,minLat,maxLat,span,bands}=ringCache.get(ring);if(lat<minLat||lat>maxLat)return false;
  let x=wrapLon(lon);if(!polar)x+=Math.round(((min+max)/2-x)/360)*360;
  if(x<min||x>max)return false;
  let inside=false;
  for(const i of bands[Math.max(0,Math.min(127,Math.floor((lat-minLat)/span*128)))]){
    const j=(i+points.length-1)%points.length;
    const [xi,yi]=points[i],[xj,yj]=points[j],cross=(x-xi)*(yj-yi)-(lat-yi)*(xj-xi);
    if(Math.abs(cross)<1e-9&&x>=Math.min(xi,xj)-1e-9&&x<=Math.max(xi,xj)+1e-9&&lat>=Math.min(yi,yj)-1e-9&&lat<=Math.max(yi,yj)+1e-9)return true;
    if((yi>lat)!==(yj>lat)&&x<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
function geometryContains(lon,lat,geometry){
  if(!geometry)return false;
  if(geometry.type==='FeatureCollection')return geometry.features.some(item=>geometryContains(lon,lat,item));
  if(geometry.type==='Feature')return geometryContains(lon,lat,geometry.geometry);
  if(geometry.type==='GeometryCollection')return geometry.geometries.some(item=>geometryContains(lon,lat,item));
  if(geometry.type==='MultiPolygon')return geometry.coordinates.some(coords=>geometryContains(lon,lat,{type:'Polygon',coordinates:coords}));
  if(geometry.type==='Polygon')return ringContains(lon,lat,geometry.coordinates[0])&&!geometry.coordinates.slice(1).some(ring=>ringContains(lon,lat,ring));
  return false;
}
export function isLand(lon,lat,geojson){if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat < -90||lat>90)return false;return geometryContains(wrapLon(lon),lat,geojson);}

export function landWindowCoverage(bounds,geojson){
  if(!geojson)throw new Error('A land-mask GeoJSON is required for coastal screening.');
  const b=normalizeBounds(bounds,{allowWindowLatitude:true});let land=0;const samples=[];
  for(let row=0;row<5;row++)for(let col=0;col<5;col++){const lat=b.north+(b.south-b.north)*row/4,lon=wrapLon(b.west+(b.east-b.west)*col/4),mappedLand=isLand(lon,lat,geojson);if(mappedLand)land++;samples.push({row,col,lat,lon,mappedLand});}
  return {samples,land,total:25,fraction:land/25,allLand:land===25,method:'5 × 5 samples against Natural Earth 1:110m land polygons; coarse coastline screen only, not a detailed inland-water classification.'};
}

