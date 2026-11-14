/** Bounded source-access audit only. Writes research evidence, never application data. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const output=new URL('../research/ice-audit-2026-11-14/',import.meta.url);
const origin='https://terramatch-expedition.nizamkasema.chatgpt.site';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const labelUrl='https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.xml';
async function read(url,{range}={}){
  const headers={Origin:origin};if(range)headers.Range=`bytes=${range[0]}-${range[1]}`;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(25000)});
  const metadata={url:response.url,status:response.status,contentType:response.headers.get('content-type'),accessControlAllowOrigin:response.headers.get('access-control-allow-origin'),contentRange:response.headers.get('content-range')};
  if(range&&response.status!==206){await response.body?.cancel();return{metadata:{...metadata,error:'Exact byte-range response required; body was not downloaded.'},bytes:null};}
  const reader=response.body.getReader(),parts=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1024*1024)throw Error('Audit response exceeded its 1 MiB bound.');parts.push(value);}}catch(error){await reader.cancel();throw error;}
  const bytes=Buffer.concat(parts.map(p=>Buffer.from(p)));return{metadata:{...metadata,bytes:bytes.length,sha256:digest(bytes)},bytes};
}
async function settle(name,fn){try{return{name,...await fn()};}catch(error){return{name,error:error.message};}}
async function lunar(){
  const {metadata,bytes}=await read(labelUrl);if(metadata.status!==200)throw Error(`Diviner label HTTP ${metadata.status}`);
  const xml=bytes.toString('utf8'),field=xml.match(/<Field_Character>\s*<name>ice_depth<\/name>([\s\S]*?)<\/Field_Character>/)?.[1];
  if(!field||!field.includes('<field_location unit="byte">198</field_location>')||!field.includes('<field_length unit="byte">11</field_length>'))throw Error('Unexpected ice_depth field layout.');
  const terrainThermal=JSON.parse(await fs.readFile(new URL('../dist/data/shackleton-thermal.json',import.meta.url)));
  const raster=terrainThermal.raster,indices=[...new Set([0,32*65+32,raster.valuesK.indexOf(terrainThermal.summary.minK),raster.valuesK.indexOf(terrainThermal.summary.maxK),raster.valuesK.length-1])];
  const samples=[];
  for(const index of indices){
    const sourceRecord=raster.sourceRecords[index],range=[sourceRecord*210,sourceRecord*210+209];
    const record=await read(terrainThermal.source.url,{range});if(record.metadata.status!==206||record.bytes?.length!==210)throw Error('Unexpected Diviner record length.');
    const row=record.bytes.toString('ascii'),raw=row.slice(197,208).trim(),value=Number(raw),tempMaxK=Number(row.slice(187,195));
    if(!raw||!Number.isFinite(value)||tempMaxK!==raster.valuesK[index])throw Error('Diviner facet probe did not match the bundled thermal source.');
    const interpretation=value===-1?'unresolved_negative_value':value===-999||value===-32768?'invalid_or_excluded_sentinel':value===0?'model_surface_stability':value>0&&value<=2.8738?'model_positive_stability_depth':'unresolved_value';
    samples.push({index,sourceRecord,range,sha256:record.metadata.sha256,latitude:Number(row.slice(143,158)),longitude:Number(row.slice(126,141)),tempMaxK,iceDepthRaw:raw,iceDepthMeters:value,interpretation,iceDetectionClaim:false});
  }
  return{evidenceType:'modelled_stability',label:metadata,field:{name:'ice_depth',oneBasedByte:198,widthBytes:11,unit:'m',modelSublimationCriterion:'1 kg m^-2 per billion years',productLabelInvalidConstant:-999,sisInvalidConstant:-32768,negativeOneMeaning:'Not established by inspected documentation; do not infer ice presence or absence.'},samples};
}
async function glims(){
  const discovery=await read('https://www.glims.org/services');
  const search=await read('https://www.glims.org/services/search?glac_name=Longyearbreen&results_count=50');
  if(search.metadata.status!==200)throw Error(`GLIMS search HTTP ${search.metadata.status}`);
  const data=JSON.parse(search.bytes),analyses=[...new Map((data.results||[]).map(item=>[item.analysis_id,item])).values()].map(item=>({analysisId:item.analysis_id,glacierId:item.glacier_id,name:item.glacier_name,sourceDate:item.source_date,analysisDate:item.analysis_time,calculatedAreaKm2:item.glacier_calculated_area}));
  const candidates=analyses.filter(a=>a.glacierId==='G015474E78170N').sort((a,b)=>String(b.sourceDate).localeCompare(String(a.sourceDate)));
  if(!candidates.length)throw Error('Expected Svalbard glacier identifier not found.');
  const selected=candidates[0],boundsResponse=await read(`https://www.glims.org/services/glacierbounds?anlys_id=${selected.analysisId}`);
  const bounds=JSON.parse(boundsResponse.bytes);if(bounds[0]!==selected.glacierId||bounds[2]<78||bounds[4]>79||bounds[1]<15||bounds[3]>16)throw Error('Glacier bounds are not in the intended Svalbard region.');
  const services=[];for(const url of ['https://www.glims.org/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities','https://www.glims.org/geoserver/GLIMS/wfs?service=WFS&version=2.0.0&request=GetCapabilities','https://www.glims.org/geoserver/GLIMS/wms?service=WMS&version=1.3.0&request=GetCapabilities'])services.push((await read(url)).metadata);
  // Retain selected scientific fields only: no download tokens or contributor contact details.
  return{evidenceType:'mapped_glacier_extent',serviceDiscovery:discovery.metadata,search:search.metadata,reportedRows:data.total_count,returnedRows:data.results?.length,uniqueAnalyses:analyses,selectedAnalysis:selected,boundsProbe:{...boundsResponse.metadata,glacierId:bounds[0],west:bounds[1],south:bounds[2],east:bounds[3],north:bounds[4]},fullOutlineGeometryVerified:false,serviceProbes:services,limitations:['Search rows can repeat an analysis for multiple contributors; deduplicate by glacier ID and analysis ID.','Prefer observation/source date over processing date; geometry and topology can differ between analyses.','The bounds endpoint is not a glacier polygon. No area mask or no-ice claim can be inferred from it.','A zero-result name query does not establish absence of ice.']};
}
function tiffMetadata(bytes){
  if(bytes.subarray(0,4).toString('hex')!=='49492a00')throw Error('Expected a little-endian classic TIFF header.');
  const offset=bytes.readUInt32LE(4);if(offset+2>bytes.length)return{signature:'II/42',ifdOffset:offset};
  const count=bytes.readUInt16LE(offset),tags={};
  for(let n=0;n<count;n++){const at=offset+2+n*12;if(at+12>bytes.length)break;const tag=bytes.readUInt16LE(at),type=bytes.readUInt16LE(at+2),length=bytes.readUInt32LE(at+4);if(length===1&&(type===3||type===4))tags[tag]=type===3?bytes.readUInt16LE(at+8):bytes.readUInt32LE(at+8);}
  return{signature:'II/42',ifdOffset:offset,widthPixels:tags[256]??null,heightPixels:tags[257]??null,bitsPerSample:tags[258]??null,compressionCode:tags[259]??null,samplesPerPixel:tags[277]??null};
}
async function worldcover(){
  const url='https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N78E015_Map.tif';
  const result=await read(url,{range:[0,4095]});if(!result.bytes||result.bytes.length!==4096)throw Error('Expected a 4 KiB WorldCover range.');
  return{evidenceType:'classified_persistent_snow_or_ice',probe:result.metadata,tiff:tiffMetadata(result.bytes),referenceYear:2021,algorithmVersion:'v200',snowIceClass:70,numericalClassPixelsDecoded:false,limitations:['Metadata/range access only: no class-70 area or point values were calculated.','This source excludes Antarctica and is limited to 82.75 degrees north.','Class 70 combines persistent snow and glaciers; it is not an ice-purity or subsurface-ice measurement.','Missing Access-Control-Allow-Origin on this probe means direct browser access is not established; offline bundled ingestion is an alternative.']};
}

const results=[];
for(const [name,fn]of[['Diviner PRP',lunar],['GLIMS',glims],['ESA WorldCover',worldcover]]){const result=await settle(name,fn);results.push(result);console.log(`${name}: ${result.error?'ERROR '+result.error:'probed'}`);}
const report={schemaVersion:1,auditedAt:new Date().toISOString(),scope:'Source audit only; no application ice layer or ice score implemented.',results};
await fs.mkdir(output,{recursive:true});await fs.writeFile(new URL('probes.json',output),JSON.stringify(report,null,2)+'\n');
console.log(new URL('probes.json',output).pathname);
if(results.some(result=>result.error))process.exitCode=1;
