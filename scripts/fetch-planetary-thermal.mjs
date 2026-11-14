/** Offline ingestion of real NASA surface-thermal source values; no air-temperature substitution. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {terrainCoordinates} from '../dist/js/science.js';

const OUT=new URL('../dist/data/',import.meta.url),R=1737400,DEG=Math.PI/180;
const DIVINER='https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab';
const CAL_BASE='https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_calibrated_env/sol_0000_0089/sol_0029/';
const MEDA_FILE='WE__0029___________CAL_TIRS________________P04';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const round=(v,n=3)=>Math.round(v*10**n)/10**n;
async function request(url,headers={}){const response=await fetch(url,{headers,signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`${response.status}: ${url}`);const bytes=Buffer.from(await response.arrayBuffer());return {response,bytes,text:()=>bytes.toString('utf8'),sha256:hash(bytes),url};}
async function requestByRanges(url,total){const chunkSize=262144,chunks=new Array(Math.ceil(total/chunkSize)),ranges=[];let next=0,completed=0;await Promise.all(Array.from({length:4},async()=>{while(next<chunks.length){const index=next++,start=index*chunkSize,end=Math.min(total-1,start+chunkSize-1),part=await request(url,{Range:`bytes=${start}-${end}`});if(part.response.status!==206||part.bytes.length!==end-start+1)throw new Error('MEDA byte-range response did not match requested size.');chunks[index]=part.bytes;ranges.push({byteRange:[start,end],sha256:part.sha256,bytes:part.bytes.length});completed++;if(completed%5===0||completed===chunks.length)console.log(`MEDA source chunks ${completed}/${chunks.length}`);}}));const bytes=Buffer.concat(chunks);return {bytes,text:()=>bytes.toString('utf8'),sha256:hash(bytes),url,ranges:ranges.sort((a,b)=>a.byteRange[0]-b.byteRange[0])};}
function tag(xml,name){return xml.match(new RegExp(`<${name}(?: [^>]*)?>([^<]*)</${name}>`))?.[1]??null;}
export function parseDivinerRow(row){
  if(row.length<208)throw new Error('Short Diviner PRP source record.');
  const value={lon:Number(row.slice(126,141)),lat:Number(row.slice(143,158)),altitudeKm:Number(row.slice(160,175)),valueK:Number(row.slice(187,195))};
  if(!Object.values(value).every(Number.isFinite)||value.valueK<=0||value.valueK>500||value.lat < -90||value.lat>0)throw new Error('Invalid Diviner surface-maximum record.');
  return value;
}
export function distanceMeters(lat1,lon1,lat2,lon2,radius=R){const a=lat1*DEG,b=lat2*DEG,dlat=b-a,dlon=(lon2-lon1)*DEG,q=Math.sin(dlat/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dlon/2)**2;return 2*radius*Math.atan2(Math.sqrt(Math.max(0,q)),Math.sqrt(Math.max(0,1-q)));}
export function parseCSVLine(line){const fields=[];let current='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){fields.push(current.trim());current='';}else current+=c;}fields.push(current.trim());return fields;}
const comparableReason='Context only: Diviner annual modeled surface maxima, MEDA sampled-sol brightness observations and Earth 2025 daily-mean skin-temperature reanalysis use different statistics, spatial supports and periods. No cross-product thermal similarity score is calculated.';

export async function fetchLunarThermal(){
  const terrain=JSON.parse(await readFile(new URL('shackleton-terrain.json',OUT),'utf8')),size=terrain.size,points=[];
  let iMin=1199,iMax=0,jMin=1199,jMax=0;
  for(let row=0;row<size;row++)for(let col=0;col<size;col++){
    const {lat,lon}=terrainCoordinates(terrain,col/(size-1),row/(size-1)),x=R/1000*Math.cos(lat*DEG)*Math.cos(lon*DEG),y=R/1000*Math.cos(lat*DEG)*Math.sin(lon*DEG),i=Math.floor((300-x)/0.5),j=Math.floor((y+300)/0.5);
    points.push({lat,lon,i,j});iMin=Math.min(iMin,i);iMax=Math.max(iMax,i);jMin=Math.min(jMin,j);jMax=Math.max(jMax,j);
  }
  iMin=Math.max(0,iMin-3);iMax=Math.min(1199,iMax+3);jMin=Math.max(0,jMin-3);jMax=Math.min(1199,jMax+3);
  const label=await request(DIVINER.replace('.tab','.xml')),xml=label.text();
  if(!xml.includes('annual maximum temperature (K), calculated at')||!xml.includes('<field_location unit="byte">188</field_location>'))throw new Error('Diviner temp_max schema does not match expected surface quantity.');
  const sourceRows=new Map(),slices=[];let next=iMin,completed=0;
  const workers=Array.from({length:4},async()=>{
    while(next<=iMax){const i=next++,start=(1+2*(i*1200+jMin))*210,end=(1+2*(i*1200+jMax+1))*210-1;
      const slice=await request(DIVINER,{Range:`bytes=${start}-${end}`});if(slice.response.status!==206||slice.bytes.length!==end-start+1)throw new Error('Diviner archive did not return the requested exact byte range.');
      slices.push({url:DIVINER,byteRange:[start,end],sha256:slice.sha256,bytes:slice.bytes.length});
      for(let j=jMin;j<=jMax;j++)for(let triangle=0;triangle<2;triangle++){const offset=((j-jMin)*2+triangle)*210,recordNumber=2*(i*1200+j)+triangle+1;sourceRows.set(`${i},${j},${triangle}`,{...parseDivinerRow(slice.bytes.toString('ascii',offset,offset+210)),recordNumber});}
      completed++;if(completed%10===0||completed===iMax-iMin+1)console.log(`Diviner source strips ${completed}/${iMax-iMin+1}`);
    }
  });await Promise.all(workers);
  const valuesK=[],sourceRecords=[],sourceDistancesMeters=[],sourceSampleLats=[],sourceSampleLons=[];
  for(const point of points){let best=null,bestDistance=Infinity;
    for(let di=-3;di<=3;di++)for(let dj=-3;dj<=3;dj++)for(let triangle=0;triangle<2;triangle++){
      const candidate=sourceRows.get(`${point.i+di},${point.j+dj},${triangle}`);if(!candidate)continue;
      const distance=distanceMeters(point.lat,point.lon,candidate.lat,candidate.lon);if(distance<bestDistance){bestDistance=distance;best=candidate;}
    }
    if(!best||bestDistance>450)throw new Error(`No source facet within 450 m of lunar sample ${point.lat},${point.lon}.`);
    valuesK.push(best.valueK);sourceRecords.push(best.recordNumber);sourceDistancesMeters.push(round(bestDistance,2));sourceSampleLats.push(best.lat);sourceSampleLons.push(best.lon);
  }
  const validCount=valuesK.length,minK=Math.min(...valuesK),maxK=Math.max(...valuesK),meanK=valuesK.reduce((a,b)=>a+b,0)/validCount,retrievedAt=new Date().toISOString();
  return {schemaVersion:1,available:true,siteId:'shackleton',body:'moon',quantity:'surface-temperature',statistic:'annual-maximum',unit:'K',spatialSupport:'facet-derived-raster',summary:{minK,maxK,meanK:round(meanK),validCount,centerK:valuesK[Math.floor(size/2)*size+Math.floor(size/2)],label:'Spatial summary of modeled annual surface maxima; not a time mean.'},raster:{size,widthMeters:terrain.widthMeters,depthMeters:terrain.depthMeters,gridSpacingMeters:500,projection:terrain.projection,bounds:terrain.bounds,valuesK,sourceRecords,sourceDistancesMeters,sourceSampleLats,sourceSampleLons,sampling:'Nearest source-triangle centroid within 450 m, searched in a local 7 × 7 mesh-cell neighborhood. No fabricated interpolation values.'},temporal:{label:'Historical Diviner PRP annual surface maximum from first mapping-year thermal-model fits',startUTC:null,endUTC:null,period:'annual-cycle',note:'The PDS4 product marks start and stop dates inapplicable; no calendar 2025 observation is implied.'},quality:{modelFit:true,directInstantaneousObservation:false,sourceField:'temp_max',ignoredField:'temp_avg (2 cm depth)',maxSourceDistanceMeters:Math.max(...sourceDistancesMeters),sourceFacetCount:new Set(sourceRecords).size,sourceQualityFlag:'No per-facet temperature quality flag is supplied in this PRP table.'},source:{id:'diviner-thermal',title:'LRO Diviner South Polar Resource Product V2: annual maximum surface temperature',url:DIVINER,doi:'10.17189/1520650',labelUrl:label.url,labelSha256:label.sha256,productLid:'urn:nasa:pds:lro_diviner_derived1:data_derived_prp:dlre_prp_south',field:'temp_max',recordLengthBytes:210,headerBytes:210,slices:slices.sort((a,b)=>a.byteRange[0]-b.byteRange[0]),retrievedAt,method:'Fixed-width source field 188..195 is read as kelvin; temp_avg at 2 cm is not used. PRP model fits: Paige et al. (2010), doi:10.1126/science.1187726; Kaguya-based triangular mesh.',caveat:'Modeled annual extreme, not instantaneous thermal imagery. Source mesh and its modeling assumptions differ from the LOLA terrain DEM.'},comparability:{scoreEligible:false,reason:comparableReason}};
}

export async function fetchMartianThermal(){
  const csvUrl=CAL_BASE+MEDA_FILE+'.CSV',labelUrl=CAL_BASE+MEDA_FILE+'.xml';
  const label=await request(labelUrl),xml=label.text();if(!xml.includes('<name>GROUND_TEMP</name>')||!xml.includes('Ground brightness temperature'))throw new Error('MEDA source is not the expected ground-temperature field.');
  const [file,waypoints]=await Promise.all([requestByRanges(csvUrl,Number(tag(xml,'file_size'))),request('https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json')]);
  const expectedMd5=tag(xml,'md5_checksum');if(expectedMd5&&createHash('md5').update(file.bytes).digest('hex')!==expectedMd5)throw new Error('MEDA source MD5 differs from its PDS label.');
  const lines=file.text().trim().split(/\r?\n/),header=parseCSVLine(lines.shift()),index=Object.fromEntries(header.map((name,i)=>[name,i]));
  const required=['SCLK','LMST','LTST','GROUND_TEMP','GROUND_TEMP_UNCERTAINTY','WHEEL_OUTSIDE_TIRS_DOWNWARD_LOOKING_FOV','ROVER_LOW_TILT','TIRS_GROUND_FOOTPRINT_NOT_IN_SHADOW','ROVER_HGA_OFF','SKYCAM_OFF','ROVER_STILL'];
  for(const name of required)if(index[name]===undefined)throw new Error(`MEDA column missing: ${name}`);
  const flags=required.slice(5),requiredGoodFlags=['ROVER_LOW_TILT','TIRS_GROUND_FOOTPRINT_NOT_IN_SHADOW','ROVER_STILL'],bins=new Map(),valid=[],excluded={missingOrInvalid:0,qualityFlags:0},flagFailures=Object.fromEntries(flags.map(name=>[name,0])),unknownFlagCounts=Object.fromEntries(flags.map(name=>[name,0]));
  let rowNumber=1;
  for(const line of lines){rowNumber++;const fields=parseCSVLine(line),temperature=fields[index.GROUND_TEMP],uncertainty=fields[index.GROUND_TEMP_UNCERTAINTY],valueK=Number(temperature),uncertaintyK=Number(uncertainty);
    if(temperature===''||uncertainty===''||!Number.isFinite(valueK)||valueK<=0||valueK>=9999999999||!Number.isFinite(uncertaintyK)||uncertaintyK<0){excluded.missingOrInvalid++;continue;}
    let good=true;for(const flag of flags){const flagValue=fields[index[flag]];if(flagValue==='0'||(requiredGoodFlags.includes(flag)&&flagValue!=='1')){flagFailures[flag]++;good=false;}else if(flagValue!=='1')unknownFlagCounts[flag]++;}if(!good){excluded.qualityFlags++;continue;}
    const lmst=fields[index.LMST],match=lmst.match(/M(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);if(!match)throw new Error('Unexpected MEDA LMST format.');
    const hour=Number(match[1])+Number(match[2])/60+Number(match[3])/3600,sample={valueK,uncertaintyK,hour,lmst,ltst:fields[index.LTST],sclk:Number(fields[index.SCLK]),sourceRow:rowNumber};valid.push(sample);const key=Math.min(47,Math.floor(hour*2));if(!bins.has(key))bins.set(key,[]);bins.get(key).push(sample);
  }
  if(valid.length<10)throw new Error('Too few quality-filtered MEDA ground-temperature samples.');
  const series=Array.from({length:48},(_,bin)=>{const samples=bins.get(bin),basis={time:`Sol 29 ${String(Math.floor(bin/2)).padStart(2,'0')}:${bin%2?'45':'15'} LMST`,hour:bin/2+0.25,lmstSeconds:(bin/2+0.25)*3600,binStartLmstSeconds:bin*1800,binEndLmstSeconds:(bin+1)*1800};if(!samples?.length)return {...basis,valueK:null,minK:null,maxK:null,uncertaintyK:null,count:0,missing:true};return {...basis,valueK:round(samples.reduce((a,s)=>a+s.valueK,0)/samples.length),minK:Math.min(...samples.map(s=>s.valueK)),maxK:Math.max(...samples.map(s=>s.valueK)),uncertaintyK:round(samples.reduce((a,s)=>a+s.uncertaintyK,0)/samples.length),count:samples.length,sourceRowFirst:samples[0].sourceRow,sourceRowLast:samples.at(-1).sourceRow,localMeanSolarTimeFirst:samples[0].lmst,localMeanSolarTimeLast:samples.at(-1).lmst};});
  let minK=Infinity,maxK=-Infinity,sum=0;for(const sample of valid){minK=Math.min(minK,sample.valueK);maxK=Math.max(maxK,sample.valueK);sum+=sample.valueK;}
  const waypointData=JSON.parse(waypoints.text()),waypoint=waypointData.features?.find(feature=>Number(feature.properties?.sol)===29);if(!waypoint)throw new Error('Official rover waypoint for sol 29 not found.');
  const coordinates={lat:waypoint.properties.lat,lon:waypoint.properties.lon,sol:29,note:'Representative sol 29 end-of-drive localization, not exact per-observation instrument-footprint coordinates.'},retrievedAt=new Date().toISOString();
  return {schemaVersion:1,available:true,siteId:'jezero',body:'mars',quantity:'surface-temperature',statistic:'quality-filtered-sol-observations',unit:'K',spatialSupport:'rover-point-time-series',coordinates,summary:{minK,maxK,meanK:round(sum/valid.length),validCount:valid.length,sampleCount:valid.length,binCount:bins.size,label:'Mean and extrema of retained MEDA ground-brightness observations; not a complete-sol mean.'},series,seriesStatistic:'30-minute arithmetic means of retained GROUND_TEMP samples; positions are bin midpoints, missing bins are null.',temporal:{label:'Perseverance sol 29 · 19–21 March 2021 UTC · sampled local solar-time intervals',sol:29,startUTC:tag(xml,'start_date_time'),endUTC:tag(xml,'stop_date_time'),localMeanSolarTimeFirst:valid[0].lmst,localMeanSolarTimeLast:valid.at(-1).lmst,period:'sampled-sol',note:'Half-hour bins show arithmetic means of available quality-filtered measurements, not gap-filled temperatures or full-time coverage. lmstSeconds positions bins at their actual half-hour solar-time midpoints; missing bins remain gaps.'},quality:{sourceField:'GROUND_TEMP',sourceUncertaintyField:'GROUND_TEMP_UNCERTAINTY',processingLevel:'Calibrated P04, brightness temperature',rawRows:lines.length,retainedRows:valid.length,excluded,requiredFlags:requiredGoodFlags,rejectWhenExplicitlyBad:flags,flagFailures,unknownFlagCounts,qualityComplete:!Object.values(unknownFlagCounts).some(count=>count>0),binWidthHours:0.5,occupiedBins:bins.size,missingBins:Array.from({length:48},(_,i)=>i).filter(i=>!bins.has(i)),note:'Require low rover tilt, an unshadowed ground footprint and a stationary rover. Explicit bad (0) wheel, HGA or SkyCam flags are rejected; blank advisory flags remain UNKNOWN. These records are not fully quality screened, and their sample mean is not a complete-sol mean.'},source:{id:'meda-thermal',title:'Mars 2020 MEDA TIRS calibrated GROUND_TEMP, sol 29, P04',url:csvUrl,sha256:file.sha256,bytes:file.bytes.length,md5:expectedMd5,labelUrl,labelSha256:label.sha256,doi:'10.17189/1522849',field:'GROUND_TEMP',units:'kelvin',ranges:file.ranges,waypoints:{url:waypoints.url,sha256:waypoints.sha256,sol:29,rmc:waypoint.properties.RMC},retrievedAt,method:'Direct calibrated ground brightness-temperature samples in kelvin; explicit flag filtering and half-hour aggregation. AIR_TEMP is never used.',caveat:'Radiometric brightness temperature is not automatically identical to thermodynamic skin temperature. Some advisory flags are unavailable. Rover-local observations do not define a 32 km spatial thermal raster.'},comparability:{scoreEligible:false,reason:comparableReason}};
}

async function readExistingRecord(url){try{return JSON.parse(await readFile(url,'utf8'));}catch{return null;}}
async function main(){await mkdir(OUT,{recursive:true});const selected=process.argv.slice(2);for(const [id,loader]of[['shackleton',fetchLunarThermal],['jezero',fetchMartianThermal]]){if(selected.length&&!selected.includes(id))continue;const output=new URL(`${id}-thermal.json`,OUT);let record;try{console.log(`Ingesting actual ${id} surface thermal data…`);record=await loader();console.log(id,JSON.stringify({summary:record.summary,temporal:record.temporal,rasterSize:record.raster?.size,seriesBins:record.series?.length}));}catch(error){const reason=`Source ingestion did not complete: ${error.message}`;console.error(id,reason);
      // Never replace an existing validated source record with an unavailable one after a failed (e.g. offline) run.
      if((await readExistingRecord(output))?.available===true){process.exitCode=1;console.error(`${id}: the existing available record was kept unchanged.`);continue;}
      record={schemaVersion:1,available:false,siteId:id,reason,retrievedAt:new Date().toISOString()};}await writeFile(output,JSON.stringify(record));}}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await main();
