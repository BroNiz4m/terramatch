/** Reproduce and audit the existing index; never changes app data, weights or source files. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {SITES,TARGETS,EARTH_SITES,TASK_PROFILES,analyzeTerrain,compareTerrains} from '../dist/js/science.js';

const OUT=new URL('../research/analog-validation-2026-11-15/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const fixtures=new Map(),measurements=new Map(),provenance=[];
let numericalChecks=0;
function close(actual,expected,tolerance=1e-10){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);numericalChecks++;}

// Recompute directly from grid differences rather than using analyzeTerrain's outputs.
function independent(grid){
  const n=grid.size,heights=grid.heights,slopes=[],counts=Array(6).fill(0),edges=[2,5,10,20,35,90];
  const stepX=grid.widthMeters/(n-1),stepY=grid.depthMeters/(n-1);
  assert.equal(n,65);assert.equal(stepX,500);assert.equal(stepY,500);assert.equal(heights.length,4225);assert.ok(heights.every(Number.isFinite));
  for(let r=1;r<n-1;r++)for(let c=1;c<n-1;c++){
    const dx=(heights[r*n+c+1]-heights[r*n+c-1])/(2*stepX),dy=(heights[(r+1)*n+c]-heights[(r-1)*n+c])/(2*stepY);
    const angle=Math.atan(Math.sqrt(dx*dx+dy*dy))*180/Math.PI;
    const bin=edges.findIndex(upper=>angle<upper);assert.ok(bin>=0);counts[bin]++;slopes.push(angle);
  }
  const min=Math.min(...heights),max=Math.max(...heights),sorted=slopes.toSorted((a,b)=>a-b);
  return {min,max,relief:max-min,slopeMean:slopes.reduce((a,b)=>a+b,0)/slopes.length,slopeP90:sorted[Math.floor(.9*(sorted.length-1))],histogram:counts.map(n=>n/slopes.length)};
}
function distances(a,b){return {slope:.5*a.histogram.reduce((sum,v,i)=>sum+Math.abs(v-b.histogram[i]),0),relief:Math.min(1,Math.abs(Math.log(a.relief+1)-Math.log(b.relief+1))/Math.log(4))};}
const rawScore=(d,w)=>100*(1-(w*d.slope+(1-w)*d.relief));
const appRound=score=>Math.round(score*10)/10;

for(const site of SITES){
  const bytes=await readFile(new URL('../dist/'+site.terrainFile,import.meta.url)),grid=JSON.parse(bytes),own=independent(grid),actual=analyzeTerrain(grid);
  for(const key of ['min','max','relief','slopeMean','slopeP90'])close(actual[key],own[key]);actual.slopeHistogram.forEach((v,i)=>close(v,own.histogram[i]));
  fixtures.set(site.id,grid);measurements.set(site.id,own);
  provenance.push({id:site.id,name:site.name,body:site.body,path:'dist/'+site.terrainFile,sha256:hash(bytes),center:grid.center,source:grid.source,statistics:own,comparisonEligible:grid.comparisonEligible!==false});
}
const cases=[...Object.entries(TASK_PROFILES).map(([id,p])=>({id,weights:p.weights})),{id:'slope-only',weights:{slope:1,relief:0}},{id:'relief-only',weights:{slope:0,relief:1}}];
const report={localDate:'2026-11-15',timezone:'Asia/Taipei',baselineCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Six bundled planetary windows against the three eligible bundled Earth references only. Browser-local searches and unknown Earth locations are not evaluated.',scoreIsProbability:false,weightsCalibrated:false,productionFilesChanged:false,inputs:provenance,targets:[]};

for(const target of TARGETS){
  const a=measurements.get(target.id),pairs=EARTH_SITES.map((site,order)=>({id:site.id,name:site.name,order,distances:distances(a,measurements.get(site.id))}));
  function ranking(w){
    const scored=pairs.map(pair=>{
      const production=compareTerrains(fixtures.get(target.id),fixtures.get(pair.id),{slope:w,relief:1-w}),unrounded=rawScore(pair.distances,w);
      close(production.slopeDistance,pair.distances.slope);close(production.reliefDistance,pair.distances.relief);close(production.score,appRound(unrounded));
      return {...pair,score:production.score,unroundedScore:unrounded};
    }).sort((a,b)=>b.score-a.score||a.order-b.order);
    const exact=scored.toSorted((a,b)=>b.unroundedScore-a.unroundedScore||a.order-b.order),best=exact[0].unroundedScore;
    return {slopeWeight:w,reliefWeight:1-w,ranking:scored,roundedTopTies:scored.filter(p=>p.score===scored[0].score).map(p=>p.id),unroundedTopTies:exact.filter(p=>Math.abs(p.unroundedScore-best)<1e-9).map(p=>p.id),unroundedMargin:best-exact[1].unroundedScore,displayMargin:scored[0].score-scored[1].score};
  }
  const presets=cases.map(c=>({id:c.id,...ranking(c.weights.slope/(c.weights.slope+c.weights.relief))}));
  const sweep=Array.from({length:101},(_,i)=>ranking(i/100)),crossovers=[];
  for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){
    const left=pairs[i],right=pairs[j],da=left.distances,db=right.distances,denominator=(da.slope-da.relief)-(db.slope-db.relief);
    if(Math.abs(denominator)<1e-12)continue;
    const w=(db.relief-da.relief)/denominator;
    if(w>=-1e-12&&w<=1+1e-12){const weight=Math.max(0,Math.min(1,w));close(rawScore(da,weight),rawScore(db,weight));crossovers.push({slopeWeight:weight,candidates:[left.id,right.id],scoreAtIntersection:rawScore(da,weight),topAtIntersection:ranking(weight).unroundedTopTies});}
  }
  const boundaries=[...new Set([0,...crossovers.map(c=>c.slopeWeight),1])].sort((a,b)=>a-b),segments=[];
  for(let i=0;i<boundaries.length-1;i++){
    const start=boundaries[i],end=boundaries[i+1],top=ranking((start+end)/2).unroundedTopTies;
    if(segments.length&&segments.at(-1).winnerIds.join()===top.join())segments.at(-1).endSlopeWeight=end;
    else segments.push({startSlopeWeight:start,endSlopeWeight:end,winnerIds:top,endpoints:'Open intervals. Evaluate boundary ties separately; these are parameter spans, not probabilities.'});
  }
  const dominance=[];
  for(const left of pairs)for(const right of pairs)if(left!==right&&left.distances.slope<=right.distances.slope&&left.distances.relief<=right.distances.relief&&(left.distances.slope<right.distances.slope||left.distances.relief<right.distances.relief))dominance.push({dominant:left.id,dominated:right.id,note:'Dominance on the two measured distances only, not physical or mission suitability.'});
  const full=presets.find(p=>p.id==='terrain'),unique=sweep.filter(p=>p.unroundedTopTies.length===1),tieWeights=sweep.filter(p=>p.roundedTopTies.length>1).map(p=>p.slopeWeight);
  report.targets.push({id:target.id,name:target.name,statistics:a,pairs,presets,weightSweep:sweep,analyticCrossovers:crossovers,unroundedLeaderIntervals:segments,dominance,allReliefDistancesSaturated:pairs.every(p=>p.distances.relief===1),saturatedReliefCandidates:pairs.filter(p=>p.distances.relief===1).map(p=>p.id),defaultTop:full.ranking[0].id,defaultRoundedMargin:full.displayMargin,uniqueLeaderScenarioCounts:Object.fromEntries(pairs.map(p=>[p.id,unique.filter(s=>s.unroundedTopTies[0]===p.id).length])),roundedTopTieWeights:tieWeights});
  assert.throws(()=>compareTerrains(fixtures.get(target.id),fixtures.get('lanzarote')),/excluded/);
  assert.throws(()=>compareTerrains(fixtures.get(target.id),fixtures.get(EARTH_SITES[0].id),{slope:0,relief:0}),/positive/);
}

// Fingerprint production inputs again after all analyses, including excluded Lanzarote.
for(const input of provenance)assert.equal(hash(await readFile(new URL('../'+input.path,import.meta.url))),input.sha256);
report.verification={numericalChecks,productionInputHashesPreserved:true,coastalExclusionPreserved:true,emptyMetricSelectionRejected:true,independentStatisticsRecomputed:true};
await mkdir(OUT,{recursive:true});await writeFile(new URL('results.json',OUT),JSON.stringify(report,null,2));
const n=(v,d=1)=>Number(v).toFixed(d),name=id=>SITES.find(s=>s.id===id)?.name??id;
let summary='# Reproducible terrain ranking results\n\nSix bundled targets; three eligible bundled Earth windows. These are terrain indices, not probabilities or validated analog suitability.\n\n';
summary+='| Target | Default top | Default index | Runner-up | Gap | Navigation top/index | Fieldwork top/index |\n| --- | --- | ---: | --- | ---: | --- | --- |\n';
for(const target of report.targets){const d=target.presets.find(p=>p.id==='terrain'),navigation=target.presets.find(p=>p.id==='navigation'),fieldwork=target.presets.find(p=>p.id==='fieldwork');summary+=`| ${target.name} | ${name(d.ranking[0].id)} | ${n(d.ranking[0].score)} | ${name(d.ranking[1].id)} | ${n(d.displayMargin)} | ${name(navigation.ranking[0].id)} / ${n(navigation.ranking[0].score)} | ${name(fieldwork.ranking[0].id)} / ${n(fieldwork.ranking[0].score)} |\n`;}
for(const target of report.targets){summary+=`\n## ${target.name}\n\n| Candidate | Slope distance | Relief distance | Default index |\n| --- | ---: | ---: | ---: |\n`;for(const p of target.presets.find(p=>p.id==='terrain').ranking)summary+=`| ${p.name} | ${n(p.distances.slope,6)} | ${n(p.distances.relief,6)} | ${n(p.score)} |\n`;summary+='\nUnrounded leader intervals (boundary ties must be read separately):\n\n';for(const segment of target.unroundedLeaderIntervals)summary+=`- Slope weight ${n(segment.startSlopeWeight,6)}–${n(segment.endSlopeWeight,6)}: ${segment.winnerIds.map(name).join(' / ')}.\n`;summary+=`\nAll relief distances saturated: ${target.allReliefDistancesSaturated}. Rounded top-tie weights in the 101-scenario sweep: ${target.roundedTopTieWeights.length?target.roundedTopTieWeights.join(', '):'none'}.\n`;}
summary+=`\nIndependent numerical comparisons passed: ${numericalChecks}. All ten production terrain-file SHA-256 values were unchanged after analysis. Full data, hashes, all presets, the 101-weight sweep, analytic intersections and tie sets are in results.json.\n`;
await writeFile(new URL('summary.md',OUT),summary);
console.log(summary.split('\n').slice(0,12).join('\n'));
console.log(JSON.stringify({numericalChecks,allReliefSaturation:report.targets.filter(t=>t.allReliefDistancesSaturated).map(t=>t.id),leaderIntervals:report.targets.map(t=>({id:t.id,intervals:t.unroundedLeaderIntervals})),output:OUT.pathname}));
