import {EARTH_IMAGERY_SOURCES,loadRecentEarthImagery} from './recent-earth-imagery.js?v=20261116-observations-1';
/** Coordinate-derived, observed imagery. This module never supplies terrain measurements. */
export const IMAGERY_SOURCES=[
 ...EARTH_IMAGERY_SOURCES,
 {id:'lroc-wac-trek',body:'moon',title:'LRO LROC WAC global mosaic v2',agency:'NASA/GSFC/ASU/LROC Team · NASA/JPL Moon Trek',url:'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml',license:'Public mission imagery; retain NASA/GSFC/ASU/LROC and Trek credit.',note:'Historical WAC orbital mosaic. Geographic WMTS origin −180°,90°; 256 px tiles, two columns at level 0, levels 0–8. Dark areas and mosaic seams are retained.',period:'2009–2011 observations · historical mosaic',credit:'NASA/GSFC/Arizona State University · LROC Team · NASA/JPL Moon Trek',tileSize:256,maxZoom:8,template:'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg'},
 {id:'ctx-murray-beta01',body:'mars',title:'MRO CTX · Murray Lab beta01 mosaic',agency:'NASA/JPL/MSSS/Caltech Murray Lab · Esri',url:'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer',license:'Murray Lab grants free use of beta01 for all purposes; credit NASA/JPL/MSSS/The Murray Lab and service host.',note:'Observed CTX orbital imagery in a preliminary uncontrolled mosaic. Acquisition dates vary between source frames; seams, gaps and positional offsets can occur. Not survey-grade positioning or an elevation product.',period:'Historical mosaic · acquisition dates vary by frame',credit:'NASA/JPL/MSSS/The Murray Lab · hosted by Esri',tileSize:512,maxZoom:11,template:'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}'}
];
const RAD=Math.PI/180,radii={earth:6371008.8,moon:1737400,mars:3396190};
export function imageryRequestPlan(site,data,{size=512}={}){
 const source=site?.body==='earth'?EARTH_IMAGERY_SOURCES[1]:IMAGERY_SOURCES.find(s=>s.body===site?.body);
 if(!source||!Number.isFinite(site.lat)||Math.abs(site.lat)>90||!Number.isFinite(site.lon)||Math.abs(site.lon)>180)throw Error('Invalid imagery coordinates.');
 if(!Number.isInteger(size)||size<64||size>1024)throw Error('Unsupported imagery display size.');
 const width=data?.widthMeters??32000,depth=data?.depthMeters??32000,radius=data?.projection?.radiusMeters||radii[site.body];
 if(!(width>0&&width<=100000&&depth>0&&depth<=100000))throw Error('Unsupported study-area extent.');
 const halfLat=depth/2/radius/RAD,halfLon=width/2/radius/RAD/Math.cos(site.lat*RAD);
 const bounds=data?.bounds?{...data.bounds}:{west:site.lon-halfLon,east:site.lon+halfLon,south:site.lat-halfLat,north:site.lat+halfLat};
 const {west,east,south,north}=bounds;
 if(![west,east,south,north].every(Number.isFinite)||!(north>south&&east>west)||south< -90||north>90||east-west>=360)throw Error('This footprint crosses a pole or has unsupported bounds. Elevation remains available.');
 const centerError=((west+east)/2-site.lon+540)%360-180;
 if(Math.abs((north+south)/2-site.lat)>1e-5||Math.abs(centerError)>1e-5)throw Error('Imagery bounds do not match the selected coordinates.');
 const requests=[],height=Math.round(size*depth/width);if(height<32||height>1024)throw Error('Unsupported imagery aspect ratio.');
 const plan={siteId:site.id,body:site.body,center:{lat:site.lat,lon:site.lon},bounds,widthMeters:width,depthMeters:depth,size,height,source,requests};
 if(source.body==='earth'){
  // Split at the antimeridian; WMS 1.1.1 uses longitude,latitude axis order.
  let left=west;while(left<east-1e-10){const wrap=Math.floor((left+180)/360),right=Math.min(east,180+360*wrap),x0=Math.round((left-west)/(east-west)*size),x1=Math.round((right-west)/(east-west)*size);
   if(x1>x0){const url=new URL(source.endpoint);url.search=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:source.layer,STYLES:'',SRS:'EPSG:4326',BBOX:[left-wrap*360,south,right-wrap*360,north].join(','),WIDTH:String(x1-x0),HEIGHT:String(height),FORMAT:'image/jpeg'});requests.push({url:url.href,destination:[x0,0,x1-x0,height]});}left=right;
  }return plan;
 }
 let zoom=0;while(zoom<source.maxZoom&&Math.max(east-west,north-south)/360*(2**(zoom+1)*source.tileSize)<size)zoom++;
 const tileCount=z=>{const world=2**(z+1)*source.tileSize,tile=source.tileSize;return (Math.ceil((east+180)/360*world/tile)-Math.floor((west+180)/360*world/tile))*(Math.ceil((90-south)/360*world/tile)-Math.floor((90-north)/360*world/tile));};
 while(zoom>0&&tileCount(zoom)>16)zoom--;
 const columns=2**(zoom+1),rows=2**zoom,tile=source.tileSize,world=columns*tile;
 const x0=(west+180)/360*world,x1=(east+180)/360*world,y0=(90-north)/360*world,y1=(90-south)/360*world;
 for(let y=Math.floor(y0/tile);y<=Math.ceil(y1/tile)-1;y++)for(let x=Math.floor(x0/tile);x<=Math.ceil(x1/tile)-1;x++){
  if(y<0||y>=rows)throw Error('Imagery tile lies outside the registered projection.');
  const left=Math.max(x0,x*tile),right=Math.min(x1,(x+1)*tile),top=Math.max(y0,y*tile),bottom=Math.min(y1,(y+1)*tile),column=((x%columns)+columns)%columns;
  const url=source.template.replace('{z}',zoom).replace('{y}',y).replace('{x}',column);
  requests.push({url,tile:{zoom,row:y,column,unwrappedColumn:x},sourceRect:[left-x*tile,top-y*tile,right-left,bottom-top],destination:[(left-x0)/(x1-x0)*size,(top-y0)/(y1-y0)*height,(right-left)/(x1-x0)*size,(bottom-top)/(y1-y0)*height]});
 }
 if(requests.length>16)throw Error('This footprint requires too many imagery tiles.');
 const firstColumn=Math.floor(x0/tile),firstRow=Math.floor(y0/tile);
 return {...plan,zoom,mosaic:{firstColumn,firstRow,width:(Math.ceil(x1/tile)-firstColumn)*tile,height:(Math.ceil(y1/tile)-firstRow)*tile,crop:[x0-firstColumn*tile,y0-firstRow*tile,x1-x0,y1-y0]}};
}

async function decode(blob){
 if(globalThis.createImageBitmap)return createImageBitmap(blob);
 const url=URL.createObjectURL(blob);try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('The imagery response could not be decoded.'));image.src=url;});}finally{URL.revokeObjectURL(url);}
}
export async function loadLocationImagery(site,data,options={}){
 const plan=imageryRequestPlan(site,data,{size:options.size??512});
 if(site.body==='earth')return loadRecentEarthImagery(plan,{decodeImage:decode,createCanvas:()=>document.createElement('canvas'),...options,loadArchive:()=>loadPlannedImagery(plan,options)});
 return loadPlannedImagery(plan,options);
}
async function loadPlannedImagery(plan,{signal,fetchImpl=globalThis.fetch,decodeImage=decode,createCanvas=()=>document.createElement('canvas'),timeoutMs=16000}={}){
 const site={id:plan.siteId,body:plan.body},controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeoutMs);
 const canvas=createCanvas();canvas.width=plan.size;canvas.height=plan.height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context){clearTimeout(timer);signal?.removeEventListener('abort',abort);throw Error('Image composition is unavailable.');}
 const records=[];
 try{
  // Join complete source tiles at integer pixels before one geographic crop/resample.
  // Separate fractional tile draws can introduce artificial hairline seams.
  const mosaic=plan.mosaic?createCanvas():null;if(mosaic){mosaic.width=plan.mosaic.width;mosaic.height=plan.mosaic.height;}
  const tileContext=mosaic?mosaic.getContext('2d'):context;if(!tileContext)throw Error('Image composition is unavailable.');
  for(let start=0;start<plan.requests.length;start+=4){
   const settled=await Promise.allSettled(plan.requests.slice(start,start+4).map(async request=>{
    const response=await fetchImpl(request.url,{signal:controller.signal,mode:'cors',cache:'force-cache'});if(!response.ok)throw Error('Imagery service returned HTTP '+response.status+'.');
    const bytes=await response.arrayBuffer(),b=new Uint8Array(bytes);if(bytes.byteLength>5000000||!(b[0]===0xff&&b[1]===0xd8||b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47))throw Error('The provider returned no supported image for this area.');
    const sha256=globalThis.crypto?.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join(''):null;
    const image=await decodeImage(new Blob([bytes],{type:b[0]===0xff?'image/jpeg':'image/png'}));
    const expectedWidth=request.sourceRect?plan.source.tileSize:request.destination[2],expectedHeight=request.sourceRect?plan.source.tileSize:request.destination[3];
    if(image.width!==expectedWidth||image.height!==expectedHeight){image.close?.();throw Error('The returned image dimensions do not match the registered imagery grid.');}
    return {request,image,record:{url:request.url,sha256,bytes:bytes.byteLength,tile:request.tile||null}};
   }));
   const failure=settled.find(entry=>entry.status==='rejected');if(failure){for(const entry of settled)if(entry.status==='fulfilled')entry.value.image.close?.();throw failure.reason;}
   const batch=settled.map(entry=>entry.value);
   for(const {request,image,record}of batch){try{if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');if(mosaic)tileContext.drawImage(image,(request.tile.unwrappedColumn-plan.mosaic.firstColumn)*plan.source.tileSize,(request.tile.row-plan.mosaic.firstRow)*plan.source.tileSize);else context.drawImage(image,...request.destination);records.push(record);}finally{image.close?.();}}
  }
  if(mosaic)context.drawImage(mosaic,...plan.mosaic.crop,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let opaque=0,min=255,max=0;
  for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>=250)opaque++;min=Math.min(min,pixels[i],pixels[i+1],pixels[i+2]);max=Math.max(max,pixels[i],pixels[i+1],pixels[i+2]);}
  const coverage=opaque/(pixels.length/4);if(coverage<.98||max-min<2)throw Error('Full usable imagery coverage is unavailable for this footprint. Elevation remains available.');
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not prepare the imagery preview.')),'image/png'));
  return {blob,metadata:{siteId:site.id,body:site.body,center:plan.center,bounds:plan.bounds,extentMeters:{width:plan.widthMeters,depth:plan.depthMeters},sourceId:plan.source.id,product:plan.source.title,sourceURL:plan.source.url,imageryStatus:'historical-mosaic',resolution:plan.source.body==='earth'?plan.source.resolution:plan.source.body==='moon'?'WAC mosaic: about 100 m nominal source; preview resampled':'CTX source: about 5–6 m/px; delivered preview resampled',previewSamplingMeters:plan.widthMeters/plan.size,period:plan.source.period,credit:plan.source.credit,license:plan.source.license,caveat:plan.source.note,retrievedAt:new Date().toISOString(),opaqueCoverage:coverage,processing:'Provider imagery cropped and resampled to the geographic study bounds; north up. No generated surface detail. Independent of DEM measurements and ranking.',requests:records}};
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
