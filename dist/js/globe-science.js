/** Scientific, body-fixed geometry. Standard XYZ: +X lon0, +Y lon90E, +Z north. Units are metres. */
const A=6378137,F=1/298.257223563,B=A*(1-F),PCK='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc';
export const BODY_SHAPES=Object.freeze({
  earth:Object.freeze({body:'earth',name:'Earth',axesMeters:Object.freeze([A,A,B]),equatorialRadiusMeters:A,polarRadiusMeters:B,referenceRadiusMeters:(2*A+B)/3,inverseFlattening:298.257223563,coordinateConvention:'WGS84 geodetic latitude, east-positive longitude',frame:'WGS84 Earth-centered Earth-fixed geometry; no time-dependent celestial orientation',surfaceMode:'WGS84 ellipsoid plus ETOPO1 orthometric height (geoid undulation omitted)',source:'https://earth-info.nga.mil/?action=wgs84&dir=wgs84',pckRadiiMeters:Object.freeze([6378136.6,6378136.6,6356751.9]),pckUrl:PCK,textureGrid:{latitudeConvention:'geodetic',longitudeConvention:'east-positive'},geometryCaveat:'ETOPO1 is mean-sea-level height, not ellipsoidal altitude. Treating it as geodetic height omits geoid undulation; this is explicitly approximate, not survey-grade positioning.'}),
  mars:Object.freeze({body:'mars',name:'Mars',axesMeters:Object.freeze([3396190,3396190,3376200]),equatorialRadiusMeters:3396190,polarRadiusMeters:3376200,referenceRadiusMeters:3396000,coordinateConvention:'IAU2000 planetocentric latitude, east-positive longitude',frame:'IAU2000 body-fixed coordinates of the MOLA product',surfaceMode:'MOLA measured/interpolated absolute planetary radius; no ellipsoid or areoid double-addition',source:PCK,pckUrl:PCK,textureGrid:{latitudeConvention:'planetocentric',longitudeConvention:'east-positive'},geometryCaveat:'PCK axes are reference metadata. Actual surface geometry uses the archived MOLA radius field directly. Areoid-referenced topography is a separate field.'}),
  moon:Object.freeze({body:'moon',name:'Moon',axesMeters:Object.freeze([1737400,1737400,1737400]),equatorialRadiusMeters:1737400,polarRadiusMeters:1737400,referenceRadiusMeters:1737400,coordinateConvention:'Planetocentric latitude, east-positive longitude',frame:'Mean Earth / polar axis of DE421, as specified by LOLA LDEM_4',surfaceMode:'LOLA height plus1737400m reference sphere',source:PCK,pckUrl:PCK,textureGrid:{latitudeConvention:'planetocentric',longitudeConvention:'east-positive'},geometryCaveat:'DE421 mean-Earth coordinates and generic IAU_MOON are not identical precision orientation models; no inertial orientation or current-time libration is claimed.'}),
});
const cache=new Map(),DEG=Math.PI/180;
export const normalizeLongitude=lon=>((lon+180)%360+360)%360-180;
function bodyKey(body){const key=String(typeof body==='object'?body.body:body).toLowerCase();if(!BODY_SHAPES[key])throw new RangeError(`Unsupported planetary body: ${key}`);return key;}
function angles(lat,lon){if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat>90)throw new RangeError('Finite latitude in±90° and longitude are required.');return {phi:lat*DEG,lambda:normalizeLongitude(lon)*DEG};}
export function validateGlobeDEM(data){
  if(!data||!BODY_SHAPES[data.body]||!Number.isInteger(data.width)||!Number.isInteger(data.height)||data.width<2||data.height<2||data.heightsMeters?.length!==data.width*data.height||!data.heightsMeters.every(Number.isFinite)||!data.source?.files?.length)throw new Error('Invalid global elevation grid or provenance.');
  const g=data.registration;if(!g||![g.latitudeStart,g.latitudeStep,g.longitudeStart,g.longitudeStep].every(Number.isFinite)||g.latitudeStep>=0||g.longitudeStep<=0||g.longitudeStart!==-180||g.latitudeStart!==90||Math.abs(g.longitudeStep*(data.width-1)-360)>1e-8||Math.abs(g.latitudeStep*(data.height-1)+180)>1e-8)throw new Error('Global grid must cover north-to-south latitude and a complete wrapped longitude seam.');
  if(data.body==='mars'&&(data.radiiMeters?.length!==data.width*data.height||!data.radiiMeters.every(value=>Number.isFinite(value)&&value>3000000&&value<4000000)))throw new Error('Mars globe requires the actual MOLA radius field.');
  return data;
}
export async function loadGlobeDEM(body,{signal}={}){
  const key=bodyKey(body);if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');if(cache.has(key))return cache.get(key);
  const response=await fetch(new URL(`../data/${key}-globe-dem.json`,import.meta.url),{signal});if(!response.ok)throw new Error(`Global ${key} elevation unavailable (${response.status}).`);
  const data=validateGlobeDEM(await response.json());if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');cache.set(key,data);return data;
}
function sampleArray(data,values,lat,lon){
  angles(lat,lon);const g=data.registration,x=(normalizeLongitude(lon)-g.longitudeStart)/g.longitudeStep,y=Math.max(0,Math.min(data.height-1,(lat-g.latitudeStart)/g.latitudeStep)),x0=Math.max(0,Math.min(data.width-1,Math.floor(x))),x1=Math.min(data.width-1,x0+1),y0=Math.floor(y),y1=Math.min(data.height-1,y0+1),tx=x-x0,ty=y-y0,w=data.width;
  return (values[y0*w+x0]*(1-tx)+values[y0*w+x1]*tx)*(1-ty)+(values[y1*w+x0]*(1-tx)+values[y1*w+x1]*tx)*ty;
}
/** Earth:MSL topography/bathymetry. Mars:areoid topography. Moon:height above1737.4km sphere. */
export function sampleGlobeElevation(data,lat,lon){return sampleArray(data,data.heightsMeters,lat,lon);}
/** Geocentric radius at the requested location, not a vertically exaggerated display coordinate. */
export function sampleGlobeRadius(data,lat,lon){
  if(data.body==='mars')return sampleArray(data,data.radiiMeters,lat,lon);
  const h=sampleGlobeElevation(data,lat,lon);if(data.body==='moon')return BODY_SHAPES.moon.referenceRadiusMeters+h;
  return Math.hypot(...earthGeodeticPosition(lat,lon,h));
}
export function earthGeodeticPosition(lat,lon,heightMeters=0){
  if(!Number.isFinite(heightMeters))throw new RangeError('Height must be finite.');const {phi,lambda}=angles(lat,lon),e2=F*(2-F),sin=Math.sin(phi),n=A/Math.sqrt(1-e2*sin*sin),cos=Math.cos(phi);
  return [(n+heightMeters)*cos*Math.cos(lambda),(n+heightMeters)*cos*Math.sin(lambda),(n*(1-e2)+heightMeters)*sin];
}
/** Utility for a reference ellipsoid with planetocentric angles; not an areoid-height conversion. */
export function planetocentricPosition(body,lat,lon,radialHeightMeters=0){
  const shape=BODY_SHAPES[bodyKey(body)],{phi,lambda}=angles(lat,lon);if(!Number.isFinite(radialHeightMeters))throw new RangeError('Radial height must be finite.');const u=[Math.cos(phi)*Math.cos(lambda),Math.cos(phi)*Math.sin(lambda),Math.sin(phi)],radius=1/Math.sqrt(u.reduce((sum,value,index)=>sum+(value/shape.axesMeters[index])**2,0))+radialHeightMeters;return u.map(value=>value*radius);
}
export function surfacePosition(data,lat,lon){
  if(data.body==='earth')return earthGeodeticPosition(lat,lon,sampleGlobeElevation(data,lat,lon));
  const {phi,lambda}=angles(lat,lon),radius=sampleGlobeRadius(data,lat,lon);return [radius*Math.cos(phi)*Math.cos(lambda),radius*Math.cos(phi)*Math.sin(lambda),radius*Math.sin(phi)];
}
export function inversePosition(body,position){
  const key=bodyKey(body),v=Array.isArray(position)||ArrayBuffer.isView(position)?position:[position?.x,position?.y,position?.z],x=v[0],y=v[1],z=v[2];if(![x,y,z].every(Number.isFinite))throw new RangeError('A finite XYZ position in metres is required.');const radiusMeters=Math.hypot(x,y,z);if(radiusMeters<1)throw new RangeError('Latitude is undefined at the body center.');
  const p=Math.hypot(x,y),lon=normalizeLongitude(Math.atan2(y,x)/DEG);
  if(key!=='earth')return {lat:Math.atan2(z,p)/DEG,lon,heightMeters:radiusMeters-BODY_SHAPES[key].referenceRadiusMeters,radialHeightMeters:radiusMeters-BODY_SHAPES[key].referenceRadiusMeters,radiusMeters,heightDatum:key==='mars'?'Radial departure from3396000m sphere; not areoid-referenced topography':'Height above1737400m lunar reference sphere'};
  if(p<1e-8)return {lat:z>=0?90:-90,lon:0,heightMeters:Math.abs(z)-B,radiusMeters,heightDatum:'WGS84 ellipsoidal height (the input ETOPO1 conversion omits geoid undulation)'};
  const e2=F*(2-F),ep2=(A*A-B*B)/(B*B),theta=Math.atan2(z*A,p*B),phi=Math.atan2(z+ep2*B*Math.sin(theta)**3,p-e2*A*Math.cos(theta)**3),n=A/Math.sqrt(1-e2*Math.sin(phi)**2),heightMeters=Math.abs(Math.cos(phi))>1e-8?p/Math.cos(phi)-n:z/Math.sin(phi)-n*(1-e2);
  return {lat:phi/DEG,lon,heightMeters,radiusMeters,heightDatum:'WGS84 ellipsoidal height (the input ETOPO1 conversion omits geoid undulation)'};
}
