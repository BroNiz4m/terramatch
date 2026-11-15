/** Evidence-led multi-candidate research. No app writes. --fetch acquires terrain; default replays saved PNGs offline. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadEarthWindow,decodeTerrarium,generateSearchCenters} from '../dist/js/terrain-search.js';
import {analyzeTerrain,compareTerrains,SITES,TARGETS,TASK_PROFILES} from '../dist/js/science.js';
import {landWindowCoverage} from '../dist/js/land-geometry.js';
import {assessLandCoverage,DETAILED_MASK_SHA256} from '../dist/js/land-coverage.js';
import {comparisonStatus} from '../dist/js/comparison-status.js';

const OUT=new URL('../research/earth-analog-survey-2026-11-15/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const save=(name,value)=>writeFile(new URL(name,OUT),JSON.stringify(value,null,2)+'\n');
const proposed=JSON.parse(await readFile(new URL('candidates.json',OUT)));
const controls=['amboy','wadi-rum','al-wahbah'].map(id=>{const s=SITES.find(s=>s.id===id);return{id,name:s.name+' (control)',lat:s.lat,lon:s.lon,country:s.country,coordinateSource:'Existing project reference coordinate',coordinateNote:'Control fetched again through the same Terrarium pipeline as new candidates, not reused from Skadi.',evidenceSources:s.sourceIds,condition:'Control for the current regional terrain heuristic',uses:'Measure whether new evidence changes the shortlist',limits:s.limitations.join(' '),control:true};});
const searchRegion={name:'Southern Idaho terrain survey',bounds:{north:44,south:42.8,west:-114.4,east:-112.8},stepDegrees:.4,maxCandidates:12,note:'Analyst-chosen bounded region near the Idaho operations-study context. No claim that every sampled point is basalt or lies in a published BASALT footprint.'};
const selectionMask=JSON.parse(await readFile(new URL('../dist/data/land-mask.geojson',import.meta.url)));
const centers=generateSearchCenters(searchRegion.bounds,searchRegion,selectionMask);
const sampled=centers.map((p,i)=>({id:'idaho-sample-'+String(i+1).padStart(2,'0'),name:`Idaho sample ${i+1} (${p.lat.toFixed(3)}, ${p.lon.toFixed(3)})`,...p,country:'United States',generated:true,coordinateSource:'Deterministic grid selection within recorded research bounds',coordinateNote:'Research-generated regional sample, not a named/verified field site.',evidenceSources:[],condition:'Regional terrain-only reconnaissance candidate',literatureEvidence:'No site-specific process/material/operations evidence acquired for this sampled window.',uses:'Prioritize further mapped-geology and footprint review if terrain measurements warrant it.',limits:'No geological equivalence, access, field suitability or scientific discovery established.'}));
const candidates=[...proposed,...controls,...sampled];
async function fingerprints(){const paths=(await readdir(new URL('../dist/data/',import.meta.url))).map(p=>'dist/data/'+p).concat(['dist/js/science.js','dist/js/terrain-search.js','dist/js/comparison-status.js','dist/js/land-geometry.js','dist/js/land-coverage.js']);return Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))])));}
const before=await fingerprints();await mkdir(new URL('sources/',OUT),{recursive:true});await mkdir(new URL('windows/',OUT),{recursive:true});
const records=[],failures=[];
if(process.argv.includes('--fetch')){
  const nativeFetch=globalThis.fetch,archive=[];let networkRequests=0;
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(String(input));if(url.protocol==='file:')return new Response(await readFile(url));
    assert.match(url.href,/^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\/\d+\/\d+\/\d+\.png$/);
    assert.ok(++networkRequests<=96,'Research source-request budget exceeded');
    const r=await nativeFetch(input,options);if(r.ok){const bytes=Buffer.from(await r.clone().arrayBuffer());assert.ok(bytes.length<2*1024*1024);const file='sources/'+url.pathname.split('/').slice(-3).join('-');await writeFile(new URL(file,OUT),bytes);archive.push({url:url.href,file,sha256:hash(bytes),bytes:bytes.length});}return r;
  };
  try{for(const candidate of candidates){try{const item=await loadEarthWindow({...candidate,origin:'manual'});const file='windows/'+candidate.id+'.json';await save(file,{candidate,site:item.site,data:item.data});records.push({id:candidate.id,file});console.log(`${candidate.id}: ${item.data.source.files.length} tiles; ${item.site.comparisonEligible?'coastline screens pass':'coverage review'}`);}catch(e){failures.push({id:candidate.id,message:e.message});console.log(candidate.id+': failed '+e.message);}}}finally{globalThis.fetch=nativeFetch;}
  await save('retrieval.json',{retrievedAt:new Date().toISOString(),networkRequests,records,failures,files:[...new Map(archive.map(s=>[s.url,s])).values()]});
}
const manifest=JSON.parse(await readFile(new URL('retrieval.json',OUT))),tiles=new Map();
for(const f of manifest.files){const bytes=await readFile(new URL(f.file,OUT));assert.equal(hash(bytes),f.sha256);tiles.set(f.url,{...await decodeTerrarium(bytes),sha256:f.sha256});}
let checks=0;
function close(a,b,t=1e-9){assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);checks++;}
function ownStats(t){
  const n=t.size,h=t.heights,angles=[],counts=Array(6).fill(0),edges=[2,5,10,20,35,90],step=t.widthMeters/(n-1);assert.equal(step,500);assert.equal(t.depthMeters/(n-1),500);assert.equal(h.length,n*n);assert.ok(h.every(Number.isFinite));
  for(let r=1;r<n-1;r++)for(let c=1;c<n-1;c++){const i=r*n+c,a=Math.atan(Math.hypot((h[i+1]-h[i-1])/1000,(h[i+n]-h[i-n])/1000))*180/Math.PI;angles.push(a);counts[edges.findIndex(e=>a<e)]++;}
  angles.sort((a,b)=>a-b);return{min:Math.min(...h),max:Math.max(...h),relief:Math.max(...h)-Math.min(...h),slopeMean:angles.reduce((a,b)=>a+b)/angles.length,slopeP90:angles[Math.floor(.9*(angles.length-1))],histogram:counts.map(c=>c/angles.length)};
}
function stats(t){const a=ownStats(t),b=analyzeTerrain(t);for(const k of ['min','max','relief','slopeMean','slopeP90'])close(a[k],b[k]);a.histogram.forEach((v,i)=>close(v,b.slopeHistogram[i]));return a;}
function independent(a,b,w){const slope=.5*a.histogram.reduce((s,v,i)=>s+Math.abs(v-b.histogram[i]),0),relief=Math.min(1,Math.abs(Math.log((a.relief+1)/(b.relief+1)))/Math.log(4));return{score:Math.round(100*(1-(w.slope*slope+w.relief*relief)/(w.slope+w.relief))*10)/10,slopeDistance:slope,reliefDistance:relief};}
function cropped(t,km){const n=km*2+1,start=(65-n)/2,h=[];for(let r=0;r<n;r++)h.push(...t.heights.slice((start+r)*65+start,(start+r)*65+start+n));return{size:n,widthMeters:km*1000,depthMeters:km*1000,heights:h};}
const targets=[];for(const site of TARGETS){const bytes=await readFile(new URL('../dist/'+site.terrainFile,import.meta.url)),data=JSON.parse(bytes);targets.push({site,data,sha256:hash(bytes),stats:stats(data)});}
const coarseMask=JSON.parse(await readFile(new URL('../dist/data/land-mask.geojson',import.meta.url))),fineBytes=await readFile(new URL('../dist/data/land-mask-10m.geojson',import.meta.url));assert.equal(hash(fineBytes),DETAILED_MASK_SHA256);const fineMask=JSON.parse(fineBytes);
const windows=[];let reconstructedHeights=0;
for(const record of manifest.records){
  const saved=JSON.parse(await readFile(new URL(record.file,OUT))),t=saved.data,z=t.source.zoom,scale=256*2**z,byKey=new Map();
  assert.deepEqual(saved.candidate,candidates.find(c=>c.id===record.id),'Saved window must match the recorded candidate selection.');
  close(t.center.lat,saved.candidate.lat,1e-5);close(t.center.lon,saved.candidate.lon,1e-5);
  const coverage=assessLandCoverage(t.bounds,landWindowCoverage(t.bounds,coarseMask),fineMask,{sha256:DETAILED_MASK_SHA256}),old=t.source.coverageAssessment;
  assert.equal(coverage.status,old.status);assert.equal(coverage.coarse.land,old.coarse.land);assert.equal(coverage.detailed.land,old.detailed.land);assert.equal(coverage.detailed.coastlineIntersections,old.detailed.coastlineIntersections);assert.equal(old.detailed.source.sha256,DETAILED_MASK_SHA256);
  for(const f of t.source.files){const tile=tiles.get(f.url);assert.ok(tile);assert.equal(tile.sha256,f.sha256);byKey.set(`${f.x}/${f.y}`,tile);}
  const read=(x,y)=>{const total=256*2**z;x=((x%total)+total)%total;y=Math.max(0,Math.min(total-1,y));const tile=byKey.get(`${Math.floor(x/256)}/${Math.floor(y/256)}`);assert.ok(tile);return tile.heights[(y%256)*256+x%256];};
  for(let r=0;r<65;r++)for(let c=0;c<65;c++){
    const lat=t.bounds.north+(t.bounds.south-t.bounds.north)*r/64,lon=t.bounds.west+(t.bounds.east-t.bounds.west)*c/64,x=(lon+180)/360*scale-.5,y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*scale-.5,ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;
    close(Math.round(((read(ix,iy)*(1-u)+read(ix+1,iy)*u)*(1-v)+(read(ix,iy+1)*(1-u)+read(ix+1,iy+1)*u)*v)*100)/100,t.heights[r*65+c]);reconstructedHeights++;
  }
  const currentStatus=comparisonStatus(saved.site,t);
  windows.push({...saved,stats:stats(t),terrainEngineEligible:currentStatus.scoreEligible,researchRankingEligible:currentStatus.scoreEligible&&!saved.candidate.withholdTerrainScore,researchReviewReason:currentStatus.reason||saved.candidate.withholdReason||null});
}
const profiles={terrain:TASK_PROFILES.terrain.weights,navigation:TASK_PROFILES.navigation.weights,fieldwork:TASK_PROFILES.fieldwork.weights};
const comparisons=[];
for(const target of targets){
  const ranked=[];for(const item of windows){
    if(!item.researchRankingEligible)continue;const presets={};
    for(const [name,w]of Object.entries(profiles)){const app=compareTerrains(target.data,item.data,w),own=independent(target.stats,item.stats,w);close(app.score,own.score);close(app.slopeDistance,own.slopeDistance);close(app.reliefDistance,own.reliefDistance);presets[name]=own;}
    const centeredExtentScores={};for(const km of [16,24]){const a=cropped(target.data,km),b=cropped(item.data,km),own=independent(stats(a),stats(b),profiles.terrain);close(own.score,compareTerrains(a,b,profiles.terrain).score);centeredExtentScores[km]=own;}
    ranked.push({id:item.candidate.id,name:item.candidate.name,control:!!item.candidate.control,presets,centeredExtentScores,condition:item.candidate.condition,scope:'Regional terrain only; geological/material/operational evidence evaluated separately in the report.'});
  }
  ranked.sort((a,b)=>b.presets.terrain.score-a.presets.terrain.score);
  comparisons.push({targetId:target.site.id,name:target.site.name,source:target.data.source,inputSha256:target.sha256,ranked:ranked.map(r=>({...r,rank:1+ranked.filter(x=>x.presets.terrain.score>r.presets.terrain.score).length})),excluded:windows.filter(w=>!w.researchRankingEligible).map(w=>({id:w.candidate.id,reason:w.researchReviewReason}))});
}
const controlPipelineComparison=[];
for(const id of ['amboy','wadi-rum','al-wahbah']){const item=windows.find(w=>w.candidate.id===id);if(!item?.researchRankingEligible)continue;const original=JSON.parse(await readFile(new URL('../dist/data/'+id+'-terrain.json',import.meta.url)));controlPipelineComparison.push({id,existingSkadiStatistics:stats(original),freshTerrariumStatistics:item.stats,jezeroExistingSkadiIndex:compareTerrains(targets.find(t=>t.site.id==='jezero').data,original).score,jezeroFreshTerrariumIndex:compareTerrains(targets.find(t=>t.site.id==='jezero').data,item.data).score,note:'Same center/posting and extent, but different source/resampling pipelines; differences are not an accuracy estimate.'});}
assert.deepEqual(await fingerprints(),before);
const result={schemaVersion:1,localDate:'2026-11-15',baselineCommit:execFileSync('git',['-c',`safe.directory=${fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'')}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Six literature-led new Earth regions, three controls and twelve generated Idaho terrain windows; six existing planetary windows. Bounded purposive survey, not exhaustive/global discovery or a scientifically calibrated winner.',selectionRule:'Published process/material/operations evidence chooses named candidates before terrain scoring. The added bounded grid generates unnamed terrain candidates independently; these do not inherit geological evidence from nearby named sites. A terrain score cannot validate a different evidence class.',regionalSearch:{...searchRegion,sampling:centers.metadata},windows:windows.map(w=>({candidate:w.candidate,file:manifest.records.find(r=>r.id===w.candidate.id).file,center:w.data.center,bounds:w.data.bounds,statistics:w.stats,source:w.data.source,terrainEngineEligible:w.terrainEngineEligible,researchRankingEligible:w.researchRankingEligible,researchReviewReason:w.researchReviewReason})),failures:manifest.failures,comparisons,controlPipelineComparison,verification:{numericalChecks:checks,reconstructedHeights,archivedPngFiles:manifest.files.length,sourceHashesVerified:true,productionFilesUnchanged:true},productionFingerprints:before};
await save('results.json',result);
let summary='# Reproducible multi-candidate terrain survey\n\nSix new literature-led regions, three controls and twelve generated Idaho windows; same 32 km extent, 500 m posting and terrain formulas. Scores are terrain-only; geological/process evidence is separate.\n\n| Earth window | Research rank eligible | Relief m | Mean slope deg | Coarse land /25 | Detailed land /4225 |\n| --- | --- | ---: | ---: | ---: | ---: |\n';
for(const w of windows)summary+=`| ${w.candidate.name} | ${w.researchRankingEligible} | ${w.stats.relief.toFixed(2)} | ${w.stats.slopeMean.toFixed(3)} | ${w.data.source.landScreening.land} | ${w.data.source.coverageAssessment.detailed.land??'unavailable'} |\n`;
for(const t of comparisons){summary+=`\n## ${t.name}\n\n| Rank | Candidate | Default | Navigation | Fieldwork | Centered 16 km | Centered 24 km |\n| --- | --- | ---: | ---: | ---: | ---: | ---: |\n`;for(const r of t.ranked)summary+=`| ${r.rank} | ${r.name} | ${r.presets.terrain.score.toFixed(1)} | ${r.presets.navigation.score.toFixed(1)} | ${r.presets.fieldwork.score.toFixed(1)} | ${r.centeredExtentScores[16].score.toFixed(1)} | ${r.centeredExtentScores[24].score.toFixed(1)} |\n`;}
summary+=`\n${checks} numerical comparisons passed; ${reconstructedHeights} heights reconstructed; ${manifest.files.length} original PNGs checked. No production changes. Full source/coverage evidence and failures are retained in results.json.\n`;await writeFile(new URL('summary.md',OUT),summary);
console.log(summary.split('\n').slice(0,17).join('\n'));console.log(JSON.stringify({targets:comparisons.map(t=>({id:t.targetId,top:t.ranked.slice(0,3).map(r=>({id:r.id,score:r.presets.terrain.score}))})),controls:controlPipelineComparison.map(c=>({id:c.id,original:c.jezeroExistingSkadiIndex,new:c.jezeroFreshTerrariumIndex})),verification:result.verification}));
