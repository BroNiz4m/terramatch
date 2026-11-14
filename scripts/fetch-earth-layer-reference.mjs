import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const endpoint='https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const specs=[
  {id:'truecolor',layer:'MODIS_Terra_CorrectedReflectance_TrueColor',title:'Daily satellite imagery',date:'2026-11-13',note:'MODIS Terra corrected reflectance. Clouds and swath gaps belong to the dated image; this is not continuous live coverage.',documentationUrl:'https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/near-real-time/near-real-time-data/corrected-reflectance'},
  {id:'temperature',layer:'MODIS_Terra_L3_Land_Surface_Temp_Daily_Day',title:'Daytime land surface temperature',date:'2026-11-13',legend:'MODIS_Land_Surface_Temp',note:'Dated daytime land-surface retrievals, not air temperature. Clouds, polar night and missing retrievals leave gaps. This is a browse visualization; no numeric temperature is decoded from colours.',documentationUrl:'https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/MOD11A1/'},
  {id:'water',layer:'MODIS_Terra_L3_Land_Water_Mask',title:'Annual land / water mask',date:'2015-01-01',legend:'MODIS_Land_Water_Mask',note:"Historical annual MODIS land/water browse classification. It does not show current floods, water depth, ice, purity or drinkability. Transparent land is not missing water evidence. This older GIBS rendition shows unreliable Antarctic land detail; TerraMatch conservatively hides it south of 60°S and north of 80°N. This display guard is not an official product coverage boundary; no classification is inferred in the hidden regions.",documentationUrl:'https://modis.gsfc.nasa.gov/data/dataprod/mod44w.php'}
];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`${r.status} ${url}`);return{bytes:Buffer.from(await r.arrayBuffer()),cors:r.headers.get('access-control-allow-origin'),contentType:r.headers.get('content-type')};}
await fs.mkdir('dist/data',{recursive:true});
const caps=await get(endpoint+'?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0'),xml=caps.bytes.toString();
const layers=[];
for(const spec of specs){
  const i=xml.indexOf('<Name>'+spec.layer+'</Name>');if(i<0)throw Error('Unadvertised layer');const block=xml.slice(xml.lastIndexOf('<Layer',i),xml.indexOf('</Layer>',i));const time=block.match(/<Dimension name="time"[^>]*default="([^"]+)"[^>]*>([^<]+)<\/Dimension>/);if(!time)throw Error('No time dimension');
  const url=new URL(endpoint);url.search=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:spec.layer,STYLES:'',SRS:'EPSG:4326',BBOX:'-180,-90,180,90',WIDTH:'2048',HEIGHT:'1024',FORMAT:'image/png',TRANSPARENT:'TRUE',TIME:spec.date});
  const result=await get(url.href),b=result.bytes;if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.readUInt32BE(16)!==2048||b.readUInt32BE(20)!==1024)throw Error('Not the requested global PNG');
  const path=`assets/earth-${spec.id}-reference.png`;await fs.writeFile('dist/'+path,b);
  let legendPath=null,legendSourceUrl=null,colormapSourceUrl=null;
  if(spec.legend){legendSourceUrl=`https://gibs.earthdata.nasa.gov/legends/${spec.legend}_H.png`;legendPath=`assets/earth-${spec.id}-legend.png`;await fs.writeFile('dist/'+legendPath,(await get(legendSourceUrl)).bytes);colormapSourceUrl=`https://gibs.earthdata.nasa.gov/colormaps/v1.3/${spec.legend}.xml`;await fs.writeFile(`dist/data/earth-${spec.id}-colormap.xml`,(await get(colormapSourceUrl)).bytes);}
  layers.push({...spec,legend:undefined,reference:{date:spec.date,path,requestUrl:url.href,bytes:b.length,sha256:hash(b),retrievedAt:new Date().toISOString()},legendPath,legendSourceUrl,colormapSourceUrl,time:{latestAdvertised:time[1],intervals:time[2].split(',')},rendering:{width:2048,height:1024,projection:'EPSG:4326',bounds:[-180,-90,180,90],method:'Unchanged NASA GIBS server-rendered PNG',quantitativePixelAnalysis:false,...(spec.id==='water'?{displayLatitudeBounds:[-60,80],displayGuard:'Conservative TerraMatch polar quarantine; not an official coverage boundary or a no-water classification.'}:{})},cors:result.cors});console.log(spec.id,b.length,'bytes');
}
await fs.writeFile('dist/data/earth-observation-layers.json',JSON.stringify({schemaVersion:1,provider:'NASA GIBS / MODIS Terra',endpoint,capabilitiesUrl:endpoint+'?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0',capabilitiesSHA256:hash(caps.bytes),verifiedAt:new Date().toISOString(),layers},null,2)+'\n');
