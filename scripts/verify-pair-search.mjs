/** Independently replay browser windows against original NASA IMG bytes. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadSearchAtlas,loadPlanetaryWindow,loadPlanetaryIndex,searchLocationPairs} from '../dist/js/planetary-search.js';
import {analyzeTerrain} from '../dist/js/science.js';
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{const url=new URL(String(input));return url.protocol==='file:'?new Response(await readFile(url)):nativeFetch(input,options);};
const rawRoot=new URL('../../output/search-atlas-sources/',import.meta.url),atlas=await loadSearchAtlas(),results={verifiedAt:new Date().toISOString(),sources:{},windows:[],indexChecks:0,heightChecks:0};
for(const body of ['mars','moon']){
 const p=atlas.bodies[body],raw=await readFile(new URL(p.product+'.img',rawRoot)),sha256=createHash('sha256').update(raw).digest('hex');if(sha256!==p.source.sha256)throw Error('Original NASA source hash mismatch');results.sources[body]={url:p.source.url,sha256,bytes:raw.length};
 const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
 function sourceAt(lat,lon){const east=((lon%360)+360)%360,column=east*p.pixelsPerDegree-.5,row=(90-lat)*p.pixelsPerDegree-.5,x0=Math.floor(column),y0=Math.floor(row);const at=(x,y)=>view.getInt16((y*p.width+((x%p.width)+p.width)%p.width)*2,body==='moon')*p.scale;const f=column-x0,g=row-y0;return (1-g)*((1-f)*at(x0,y0)+f*at(x0+1,y0))+g*((1-f)*at(x0,y0+1)+f*at(x0+1,y0+1));}
 const index=await loadPlanetaryIndex(body,{atlas});
 for(const[lat,lon]of [[12.34,56.78],[-34.25,179.95],[54.125,-.02],[-73.5,-178.5],...index.filter((_,i)=>i%547===0).map(p=>[p.lat,p.lon])]){
  const record=await loadPlanetaryWindow({body,lat,lon,atlas}),halfDegrees=16000/p.radiusMeters*180/Math.PI,widthDegrees=halfDegrees/Math.cos(lat*Math.PI/180);
  for(let y=0;y<17;y++)for(let x=0;x<17;x++){const expected=sourceAt(lat+halfDegrees-y/16*halfDegrees*2,lon-widthDegrees+x/16*widthDegrees*2),actual=record.data.heights[y*17+x];if(Math.abs(expected-actual)>1e-7)throw Error('Original source replay mismatch '+body+' '+lat+' '+lon);results.heightChecks++;}
  const row=index.find(p=>p.lat===lat&&p.lon===lon);if(row){const stats=analyzeTerrain(record.data);if(Math.abs(stats.relief-row.relief)>1e-7||Math.abs(stats.slopeMean-row.slopeMean)>1e-7||stats.slopeHistogram.some((n,i)=>Math.abs(n-row.slopeHistogram[i])>1e-12))throw Error('Index does not match decoded original heights');results.indexChecks++;}
  results.windows.push({body,lat,lon,sourceTiles:record.data.source.files.map(f=>f.sha256)});
 }
}
if(process.argv.includes('--live')){
 console.log('Running real Earth + Moon + Mars search…');let last='';const result=await searchLocationPairs({budget:6,onProgress:p=>{if(p.message!==last){console.log(p.message);last=p.message;}}});
 if(!result.pairs.some(p=>p.target.site.body==='moon')||!result.pairs.some(p=>p.target.site.body==='mars'))throw Error('Live search did not produce both body types; inspect coverage.');
 results.liveSearch=result;console.log('Real search:',result.pairs.length,'pairs;',result.coverage.earthCompleted,'Earth areas;',result.coverage.earthFailed,'failures.');
}
const out=new URL('../research/pair-search-validation-2026-11-15/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('results.json',out),JSON.stringify(results,null,2));
console.log(JSON.stringify({heightChecks:results.heightChecks,indexChecks:results.indexChecks,windows:results.windows.length,result:fileURLToPath(new URL('results.json',out))}));
