/** One scoped terrain case study. Research outputs only; no production source, score or dataset changes. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {analyzeTerrain,compareTerrains,terrainCoordinates,SITES,TASK_PROFILES} from '../dist/js/science.js';
import {fetchMarsTerrain} from './lib/planetary-terrain.mjs';
import {landWindowCoverage} from '../dist/js/land-geometry.js';
import {assessLandCoverage,DETAILED_MASK_SHA256} from '../dist/js/land-coverage.js';

const OUT=new URL('../research/jezero-amboy-case-2026-11-15/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(name,value)=>writeFile(new URL(name,OUT),JSON.stringify(value,null,2)+'\n');
const grids={},inputs=[];let numericalChecks=0;
function close(a,b,t=1e-9){assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);numericalChecks++;}
async function fingerprints(){
  const paths=(await readdir(new URL('../dist/data/',import.meta.url))).map(p=>'dist/data/'+p).concat(['dist/js/science.js','dist/js/comparison-status.js','dist/js/terrain-search.js','dist/js/land-coverage.js','dist/js/land-geometry.js']);
  return Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))])));
}
const before=await fingerprints();
for(const id of ['jezero','amboy']){const path=`dist/data/${id}-terrain.json`,bytes=await readFile(new URL('../'+path,import.meta.url));grids[id]=JSON.parse(bytes);inputs.push({id,path,sha256:hash(bytes),center:grids[id].center,bounds:grids[id].bounds,source:grids[id].source});}
await mkdir(OUT,{recursive:true});await mkdir(new URL('sources/',OUT),{recursive:true});
let sourceManifest={};
if(process.argv.includes('--fetch-sources')){
  async function get(url,{start,end,max=16*1024*1024}={}){
    const headers=start===undefined?{}:{Range:`bytes=${start}-${end}`},r=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});
    assert.equal(r.status,start===undefined?200:206);if(start!==undefined)assert.ok(r.headers.get('content-range')?.startsWith(`bytes ${start}-${end}/`));
    const reader=r.body.getReader(),parts=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max)throw Error('Source exceeds bounded download size');parts.push(Buffer.from(value));}}finally{await reader.cancel();}
    const bytes=Buffer.concat(parts);if(start!==undefined)assert.equal(bytes.length,end-start+1);
    const name=url.split('/').at(-1)+(start===undefined?'':'.strip.bin'),file='sources/'+name;
    await writeFile(new URL(file,OUT),bytes);sourceManifest[url]={url,file,status:r.status,bytes:bytes.length,sha256:hash(bytes),byteRange:start===undefined?null:[start,end],retrievedAt:new Date().toISOString()};console.log(`${name}: ${bytes.length} source bytes saved`);return bytes;
  }
  await fetchMarsTerrain(SITES.find(s=>s.id==='jezero'),{readLabel:async url=>(await get(url,{max:128*1024})).toString('utf8'),readRange:(url,start,end)=>get(url,{start,end,max:4*1024*1024})});
  for(const f of grids.amboy.source.files)await get(f.url);
  await save('source-manifest.json',sourceManifest);
}else sourceManifest=JSON.parse(await readFile(new URL('source-manifest.json',OUT)));
async function source(url,range){
  const s=sourceManifest[url];assert.ok(s,`Missing saved source ${url}`);const bytes=await readFile(new URL(s.file,OUT));assert.equal(hash(bytes),s.sha256);if(range)assert.deepEqual(s.byteRange,range);return bytes;
}
const mars=await fetchMarsTerrain(SITES.find(s=>s.id==='jezero'),{readLabel:async url=>(await source(url)).toString('utf8'),readRange:(url,start,end)=>source(url,[start,end])});
// Offline replay is a new verification, not a new network retrieval.
for(const f of mars.source.files)f.retrievedAt=sourceManifest[f.url].retrievedAt;
assert.equal(mars.source.sha256ByteRange,grids.jezero.source.sha256ByteRange);assert.deepEqual(mars.source.byteRange,grids.jezero.source.byteRange);assert.deepEqual(mars.heights,grids.jezero.heights);
const hgtSource=grids.amboy.source.files[0],hgtCompressed=await source(hgtSource.url);assert.equal(hash(hgtCompressed),hgtSource.sha256);
const hgt=gunzipSync(hgtCompressed),side=Math.sqrt(hgt.length/2);assert.equal(side,3601);
const earth=grids.amboy;let maxEarthReconstructionError=0;
for(let r=0;r<65;r++)for(let c=0;c<65;c++){
  const {lat,lon}=terrainCoordinates(earth,c/64,r/64),x=(lon+116)*(side-1),y=(35-lat)*(side-1),ix=Math.floor(x),iy=Math.floor(y),tx=x-ix,ty=y-iy;
  function sample(dx,dy){assert.ok(ix+dx>=0&&ix+dx<side&&iy+dy>=0&&iy+dy<side);const h=hgt.readInt16BE(((iy+dy)*side+ix+dx)*2);assert.notEqual(h,-32768);return h;}
  const value=(sample(0,0)*(1-tx)+sample(1,0)*tx)*(1-ty)+(sample(0,1)*(1-tx)+sample(1,1)*tx)*ty,error=Math.abs(Math.round(value*100)/100-earth.heights[r*65+c]);
  close(error,0);maxEarthReconstructionError=Math.max(maxEarthReconstructionError,error);
}
function independent(t){
  const n=t.size,h=t.heights,step=t.widthMeters/(n-1),slopes=[],counts=Array(6).fill(0),edges=[2,5,10,20,35,90];
  assert.equal(step,500);assert.equal(t.depthMeters/(n-1),500);assert.equal(h.length,n*n);assert.ok(h.every(Number.isFinite));
  for(let r=1;r<n-1;r++)for(let c=1;c<n-1;c++){const i=r*n+c,dx=(h[i+1]-h[i-1])/1000,dy=(h[i+n]-h[i-n])/1000,a=Math.atan(Math.hypot(dx,dy))*180/Math.PI;slopes.push(a);counts[edges.findIndex(v=>a<v)]++;}
  const sorted=slopes.toSorted((a,b)=>a-b),min=Math.min(...h),max=Math.max(...h);
  return{min,max,relief:max-min,slopeMean:slopes.reduce((s,a)=>s+a,0)/slopes.length,slopeP90:sorted[Math.floor(.9*(sorted.length-1))],histogram:counts.map(c=>c/slopes.length),heightCount:h.length,slopeCount:slopes.length};
}
function verifyStats(t){const own=independent(t),app=analyzeTerrain(t);for(const k of ['min','max','relief','slopeMean','slopeP90'])close(own[k],app[k]);own.histogram.forEach((h,i)=>close(h,app.slopeHistogram[i]));return own;}
function pair(a,b,w){const sw=w.slope/(w.slope+w.relief),rd=Math.min(1,Math.abs(Math.log((a.relief+1)/(b.relief+1)))/Math.log(4)),sd=.5*a.histogram.reduce((s,v,i)=>s+Math.abs(v-b.histogram[i]),0),raw=100*(1-sw*sd-(1-sw)*rd);return{slopeDistance:sd,reliefDistance:rd,scoreUnrounded:raw,score:Math.round(raw*10)/10};}
const stats=Object.fromEntries(Object.entries(grids).map(([id,t])=>[id,verifyStats(t)])),profiles={...Object.fromEntries(Object.entries(TASK_PROFILES).map(([id,p])=>[id,p.weights])),'slope-only':{slope:1,relief:0},'relief-only':{slope:0,relief:1}},presets={};
for(const [name,w]of Object.entries(profiles)){const own=pair(stats.jezero,stats.amboy,w),app=compareTerrains(grids.jezero,grids.amboy,w);close(own.score,app.score);close(own.slopeDistance,app.slopeDistance);close(own.reliefDistance,app.reliefDistance);presets[name]={weights:w,...own};}
// Local extent/center sensitivity uses only existing samples. Each pair has the
// same posting/extent, but the two centers vary independently (not paired offsets).
function crop(t,width,offsetX,offsetY){
  const n=width/500+1,row=32-(n-1)/2-offsetY/500,col=32-(n-1)/2+offsetX/500;assert.ok(row>=0&&col>=0&&row+n<=65&&col+n<=65);
  const heights=[];for(let r=0;r<n;r++)heights.push(...t.heights.slice((row+r)*65+col,(row+r)*65+col+n));
  return{size:n,widthMeters:width,depthMeters:width,heights,descriptor:{widthMeters:width,offsetEastMeters:offsetX,offsetNorthMeters:offsetY,startRow:row,startColumn:col,center:terrainCoordinates(t,(col+(n-1)/2)/64,(row+(n-1)/2)/64)}};
}
const sensitivity=[];
for(const width of [16000,24000]){
  const subsets={};for(const id of ['jezero','amboy']){subsets[id]=[];for(const x of [-4000,-2000,0,2000,4000])for(const y of [-4000,-2000,0,2000,4000]){const t=crop(grids[id],width,x,y);subsets[id].push({grid:t,stats:verifyStats(t)});}}
  const results=[];for(const a of subsets.jezero)for(const b of subsets.amboy){const p=pair(a.stats,b.stats,profiles.terrain),app=compareTerrains(a.grid,b.grid,profiles.terrain);close(p.score,app.score);close(p.slopeDistance,app.slopeDistance);close(p.reliefDistance,app.reliefDistance);results.push({jezero:a.grid.descriptor,amboy:b.grid.descriptor,...p});}
  const sorted=results.toSorted((a,b)=>a.scoreUnrounded-b.scoreUnrounded),centered=results.find(p=>p.jezero.offsetEastMeters===0&&p.jezero.offsetNorthMeters===0&&p.amboy.offsetEastMeters===0&&p.amboy.offsetNorthMeters===0);
  sensitivity.push({extentKm:width/1000,independentCentersPerBody:25,pairs:results.length,scoreRange:{minimum:sorted[0].score,maximum:sorted.at(-1).score},centeredScore:centered.score,minimumCase:sorted[0],maximumCase:sorted.at(-1),results,note:'Overlapping deterministic subwindows, not independent observations, confidence intervals, error bars or probabilities. No threshold defines a good analog.'});
}
const coarse=JSON.parse(await readFile(new URL('../dist/data/land-mask.geojson',import.meta.url))),fineBytes=await readFile(new URL('../dist/data/land-mask-10m.geojson',import.meta.url));assert.equal(hash(fineBytes),DETAILED_MASK_SHA256);
const coverage=assessLandCoverage(earth.bounds,landWindowCoverage(earth.bounds,coarse),JSON.parse(fineBytes),{sha256:DETAILED_MASK_SHA256});assert.equal(coverage.status,'screened-land');
const diam=1500*.3048,height=250*.3048;
const result={schemaVersion:1,localDate:'2026-11-15',baselineCommit:execFileSync('git',['-c',`safe.directory=${fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'')}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Jezero–Amboy regional-terrain case study from the two existing 32 km windows. No new features, new terrain acquisition window, score calibration or overall analog certification.',inputs,statistics:stats,presets,
  condition:'Broad distributions of low kilometre-baseline slopes and regional elevation variation for a desktop reconnaissance and observation-planning exercise.',
  slopeShares:{jezeroUnder5:stats.jezero.histogram[0]+stats.jezero.histogram[1],amboyUnder5:stats.amboy.histogram[0]+stats.amboy.histogram[1],jezeroUnder10:stats.jezero.histogram.slice(0,3).reduce((a,b)=>a+b),amboyUnder10:stats.amboy.histogram.slice(0,3).reduce((a,b)=>a+b)},
  scale:{windowKm:32,postingMeters:500,gradientBaselineMeters:1000,amboyConeApproxDiameterMeters:diam,amboyConeApproxHeightMeters:height,coneDiameterInGridIntervals:diam/500,coneDimensionsSource:'https://www.blm.gov/visit/amboy-crater-national-natural-landmark',coneResolved:false},
  sourceVerification:{jezeroAll4225HeightsReconstructed:true,jezeroTopographyHashMatchesBundled:true,molaObservationSupport:mars.source.observationSupport,amboyAll4225HeightsReconstructed:true,amboyCompressedSourceHashMatchesBundled:true,maxEarthReconstructionErrorMeters:maxEarthReconstructionError,accuracyOrUncertaintyEstimated:false},
  spatialSensitivity:sensitivity,amboyCoverage:coverage,
  decision:{status:'supported_limited_desktop_terrain_exercise',wholeSiteEquivalenceValidated:false,geologicalEquivalenceValidated:false,physicalTraversabilityValidated:false,fieldDeploymentApproved:false,newAnalogDiscoveryClaim:false,claim:'The selected regional windows provide a reproducible example for comparing coarse slopes and relief and rehearsing how to justify reconnaissance choices. The result is conditional on the mapped extent and source limitations.',limits:['Jezero impact/lake/delta and Amboy volcanic landforms have different histories. No material or sedimentary equivalence is established.','The small Amboy cone, rocks, fractures, lava tubes and wheel/foot-scale hazards are not resolved by the 500 m grid or 1 km slope baseline.','MOLA contains interpolated bins; source counts are not accuracy, and matching heights does not validate real-world suitability.','Thermal equivalence, ice, biology, atmospheric/gravity effects, access and field safety are not measured by this terrain case.']},
  verification:{numericalChecks,sourceHashes:true,sourceHeightReconstruction:true,independentStatistics:true,independentFormula:true,matchedPostingForCrops:true,productionFilesUnchanged:true},productionFingerprints:before};
assert.deepEqual(await fingerprints(),before);await save('results.json',result);
console.log(JSON.stringify({default:presets.terrain,stats,spatial:sensitivity.map(x=>({extentKm:x.extentKm,pairs:x.pairs,range:x.scoreRange,centeredScore:x.centeredScore})),observationSupport:mars.source.observationSupport,coverage:{status:coverage.status,land:coverage.detailed.land,coastlineSegments:coverage.detailed.coastlineIntersections},numericalChecks,decision:result.decision.status},null,2));
