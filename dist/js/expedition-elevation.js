import {analyzeTerrain,terrainCoordinates} from './science.js';

const ROOT='https://trek.nasa.gov/',cache=new WeakMap();
export const EXPEDITION_ELEVATION_SOURCES={
 mars:{id:'trek-mola-hrsc-200m',body:'mars',service:'Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw',title:'Mars MOLA / HRSC merged DEM · 200 m',nativeSpacingMeters:200,credit:'NASA/JPL/GSFC · ESA/DLR/FU Berlin · USGS',radius:3396190,datum:'Mars areoid; merged MOLA / HRSC elevation, metres'},
 moon:{id:'trek-lola-256',body:'moon',service:'LRO_LOLA_DEM_Global_256ppd_v06',title:'LRO LOLA global DEM · 256 pixels per degree',nativeSpacingMeters:118.45,credit:'NASA/GSFC · LOLA Science Team · NASA/JPL Moon Trek',radius:1737400,datum:'Elevation relative to lunar reference radius 1,737,400 m'},
 south:{id:'trek-lola-south-30m',body:'moon',service:'LRO_LOLA_DEM_SPole75_30mp_v04',title:'LRO LOLA south-polar DEM · 30 m',nativeSpacingMeters:30,credit:'NASA/GSFC · LOLA Science Team · NASA/JPL Moon Trek',radius:1737400,datum:'Elevation relative to lunar reference radius 1,737,400 m'}
};
export const EXPEDITION_ELEVATION_CREDITS=Object.values(EXPEDITION_ELEVATION_SOURCES).map(s=>({id:s.id,title:s.title,agency:s.credit,url:ROOT+s.body+'/trekarcgis/rest/services/'+s.service+'/ImageServer',license:'Public mission data; retain the named instrument and agency credits.',note:'Used for location-specific Expedition geometry only. Native source spacing varies. Comparison ranking uses its separately recorded grid; this is not rover-scale hazard or mobility validation.'}));
const polarWKT='PROJCS["Moon2000_spole",GEOGCS["GCS_Moon",DATUM["D_Moon_2000",SPHEROID["Moon_2000_IAU_IAG",1737400.0,0.0]],PRIMEM["Reference_Meridian",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Stereographic_South_Pole"],PARAMETER["false_easting",0.0],PARAMETER["false_northing",0.0],PARAMETER["central_meridian",0.0],PARAMETER["standard_parallel_1",-90.0],UNIT["Meter",1.0]]';
export function expeditionElevationPlan(site,data){
 if(!['moon','mars'].includes(site?.body))return null;
 const center=terrainCoordinates(data,.5,.5),lonError=((center.lon-site.lon+540)%360)-180;
 if((data.body&&data.body!==site.body)||Math.abs(center.lat-site.lat)>1e-5||Math.abs(lonError)>1e-5||data.widthMeters!==data.depthMeters||data.widthMeters>64000)throw Error('Detailed DEM requires the selected site’s registered square footprint.');
 const polar=data.projection?.type==='south-polar-stereographic';
 if(polar&&(site.body!=='moon'||Math.abs(data.projection.radiusMeters-1737400)>.01||data.projection.centralMeridian!==0))throw Error('Unsupported detailed DEM polar registration.');
 const source=EXPEDITION_ELEVATION_SOURCES[polar?'south':site.body],size=polar?513:257;
 let bounds,crs;
 if(polar){const p=data.projection;bounds=[p.xWest,p.ySouth,p.xEast,p.yNorth];crs=JSON.stringify({wkt:polarWKT});if(bounds.some(v=>Math.abs(v)>457000))throw Error('Outside the registered south-polar detailed DEM.');}
 else{const b=data.bounds;bounds=[b.west,b.south,b.east,b.north];crs=site.body==='mars'?'104905':JSON.stringify({wkt:'GEOGCS["GCS_MOON",DATUM["D_MOON",SPHEROID["MOON_2000",1737400.0,0.0]],PRIMEM["Reference_Meridian",0.0],UNIT["Degree",0.0174532925199433]]'});}
 if(!bounds.every(Number.isFinite)||bounds[2]<=bounds[0]||bounds[3]<=bounds[1])throw Error('Invalid detailed DEM footprint.');
 const dx=(bounds[2]-bounds[0])/(size-1),dy=(bounds[3]-bounds[1])/(size-1),bbox=[bounds[0]-dx/2,bounds[1]-dy/2,bounds[2]+dx/2,bounds[3]+dy/2];
 if(!polar&&(bbox[0]<-180||bbox[2]>180||bbox[1]<-90||bbox[3]>90))throw Error('The detailed DEM footprint crosses a source seam; the original registered grid is retained.');
 const serviceURL=ROOT+source.body+'/trekarcgis/rest/services/'+source.service+'/ImageServer',url=new URL(serviceURL+'/exportImage');
 url.search=new URLSearchParams({f:'image',bbox:bbox.join(','),bboxSR:crs,imageSR:crs,size:size+','+size,format:'tiff',pixelType:'F32',interpolation:'RSP_BilinearInterpolation',renderingRule:JSON.stringify({rasterFunction:'None'}),adjustAspectRatio:'false'});
 return {source,serviceURL,url:url.href,size,bbox,polar,gridSpacingMeters:data.widthMeters/(size-1)};
}

export async function decodeElevationTIFF(bytes,plan,{decoder}={}){
 const b=new Uint8Array(bytes);if(b.length>12000000||b.length<8||!((b[0]===73&&b[1]===73)||(b[0]===77&&b[1]===77)))throw Error('The elevation service did not return a numeric GeoTIFF.');
 const {fromArrayBuffer}=decoder||await import('../vendor/geotiff.module.js'),tiff=await fromArrayBuffer(bytes),image=await tiff.getImage();
 if(image.getWidth()!==plan.size||image.getHeight()!==plan.size||image.getSamplesPerPixel()!==1||image.getSampleFormat(0)!==3||image.getBitsPerSample(0)!==32)throw Error('A single-band Float32 elevation grid is required.');
 const bounds=image.getBoundingBox(),keys=image.getGeoKeys(),radius=keys.GeogSemiMajorAxisGeoKey;
 if(!Number.isFinite(radius)||Math.abs(radius-plan.source.radius)>1||keys.GTRasterTypeGeoKey!==1||keys.GTModelTypeGeoKey!==(plan.polar?1:2))throw Error('The returned GeoTIFF has the wrong planetary reference frame.');
 if(bounds.some((v,i)=>Math.abs(v-plan.bbox[i])>Math.max(1e-7,Math.abs(plan.bbox[i])*1e-9)))throw Error('The elevation service shifted the requested footprint.');
 const values=await image.readRasters({interleave:true}),noData=image.getGDALNoData(),heights=Array.from(values);
 const range=plan.source.body==='moon'?[-15000,15000]:[-15000,30000];
 if(heights.length!==plan.size**2||heights.some(h=>!Number.isFinite(h)||h===noData||h<range[0]||h>range[1]))throw Error('The detailed elevation grid has missing or invalid heights.');
 return heights;
}

/** A separate, source-backed Expedition grid. Never replaces the ranked comparison grid. */
export async function loadExpeditionTerrain(site,data,{signal,fetchImpl=globalThis.fetch,decode=decodeElevationTIFF,timeout=20000,onProgress}={}){
 if(!['moon','mars'].includes(site.body))return {data,stats:analyzeTerrain(data),detail:{status:'original'}};
 if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');if(cache.has(data))return cache.get(data);
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>controller.abort(new Error('Detailed NASA elevation request timed out.')),timeout);
 try{
  const plan=expeditionElevationPlan(site,data);onProgress?.('Reading location-specific NASA elevation…');
  const response=await fetchImpl(plan.url,{signal:controller.signal,mode:'cors',cache:'force-cache'});if(!response.ok)throw Error('NASA elevation service returned HTTP '+response.status+'.');
  const bytes=await response.arrayBuffer();if(controller.signal.aborted)throw controller.signal.reason;const heights=await decode(bytes,plan);if(controller.signal.aborted)throw controller.signal.reason;
  const sha256=globalThis.crypto?.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''):null;
  const detail={status:'available',sourceId:plan.source.id,sourceURL:plan.serviceURL,credit:plan.source.credit,nativeSpacingMeters:plan.source.nativeSpacingMeters,gridSpacingMeters:plan.gridSpacingMeters,retrievedAt:new Date().toISOString(),request:{url:plan.url,sha256,bytes:bytes.byteLength},comparisonGridSpacingMeters:data.gridSpacingMeters,
   note:'Location-specific source elevations, at 1× vertical scale. The output grid is not native measurement accuracy. Source interpolation and gaps may remain. Rover motion is not a validated mobility simulation.'};
  const refined={...data,size:plan.size,heights,gridSpacingMeters:plan.gridSpacingMeters,expeditionDetail:detail,source:{id:plan.source.id,title:plan.source.title,url:plan.serviceURL,datum:plan.source.datum,credit:plan.source.credit,nativeResolutionMetersApprox:plan.source.nativeSpacingMeters,
   sampling:'Unstretched, single-band Float32 DEM, bilinearly exported in the selected footprint. Half-pixel-expanded bounds align pixel centres with mesh nodes. Mesh triangles are used for ground contact and inspection.',request:detail.request,caveat:detail.note}};
  const stats=analyzeTerrain(refined);refined.summary={min:stats.min,max:stats.max,relief:stats.relief,slopeMean:stats.slopeMean,slopeP90:stats.slopeP90,validCount:stats.validCount};const result={data:refined,stats,detail};cache.set(data,result);return result;
 }catch(error){if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');return {data,stats:analyzeTerrain(data),detail:{status:'fallback',reason:error.message||'Detailed elevation is unavailable.',gridSpacingMeters:data.gridSpacingMeters,sourceURL:data.source?.url}};}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
