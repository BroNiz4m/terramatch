import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadPlanetaryThermal,samplePlanetaryThermal,validatePlanetaryThermal,PLANETARY_THERMAL_SOURCES} from '../dist/js/planetary-thermal.js';
import {parseDivinerRow,parseCSVLine,distanceMeters} from '../scripts/fetch-planetary-thermal.mjs';
import {terrainCoordinates} from '../dist/js/science.js';

const moon=JSON.parse(await readFile(new URL('../dist/data/shackleton-thermal.json',import.meta.url),'utf8'));
const mars=JSON.parse(await readFile(new URL('../dist/data/jezero-thermal.json',import.meta.url),'utf8'));
const terrain=JSON.parse(await readFile(new URL('../dist/data/shackleton-terrain.json',import.meta.url),'utf8'));

test('both bundled planetary records are available, sourced surface thermal context',()=>{
 for(const record of [moon,mars]){assert.equal(record.available,true);assert.equal(validatePlanetaryThermal(record),record);assert.equal(record.quantity,'surface-temperature');assert.equal(record.unit,'K');assert.equal(record.comparability.scoreEligible,false);assert.match(record.source.url,/pds-geosciences|nmsu/);}
});
test('Diviner parser reads surface temp_max rather than the 2 cm temp_avg field',()=>{
 const row=Array(210).fill(' ');const put=(start,text)=>{for(let i=0;i<text.length;i++)row[start+i]=text[i];};put(126,'129.559707642');put(143,'-89.667678833');put(160,'-2.770453930');put(177,'  50.218');put(187,'  85.199');
 const result=parseDivinerRow(row.join(''));assert.equal(result.valueK,85.199);assert.notEqual(result.valueK,50.218);assert.equal(result.lat,-89.667678833);assert.throws(()=>parseDivinerRow('short'),/Short/);
});
test('lunar thermal raster iscomplete65×65andmatches actual terrain projection',()=>{
 assert.equal(moon.raster.size,65);assert.equal(moon.raster.valuesK.length,4225);assert.deepEqual(moon.raster.projection,terrain.projection);assert.ok(moon.raster.valuesK.every(value=>Number.isFinite(value)&&value>0));assert.ok(moon.raster.sourceDistancesMeters.every(value=>value<=450));assert.equal(moon.quality.sourceField,'temp_max');assert.match(moon.quality.ignoredField,/2 cm/);
});
test('lunar source-ranges carry exact lengths andSHA256whilemodelstatisticsremainexplicit',()=>{
 assert.equal(moon.source.slices.length,71);for(const slice of moon.source.slices){assert.equal(slice.bytes,slice.byteRange[1]-slice.byteRange[0]+1);assert.match(slice.sha256,/^[a-f0-9]{64}$/);}
 assert.equal(moon.statistic,'annual-maximum');assert.equal(moon.temporal.startUTC,null);assert.equal(moon.temporal.endUTC,null);assert.equal(moon.quality.directInstantaneousObservation,false);assert.equal(moon.summary.minK,45.332);assert.equal(moon.summary.maxK,347.495);
});
test('geographic lunar sampling returns the correspondingmodelcellwithoutfalseout-of-boundsvalues',()=>{
 for(const [col,row]of[[0,0],[32,32],[64,64],[10,45]]){const {lat,lon}=terrainCoordinates(terrain,col/64,row/64),sample=samplePlanetaryThermal(moon,lat,lon);assert.ok(sample);assert.equal(sample.row,row);assert.equal(sample.col,col);assert.equal(sample.valueK,moon.raster.valuesK[row*65+col]);assert.ok(Math.abs(sample.valueC-(sample.valueK-273.15))<1e-9);}
 assert.equal(samplePlanetaryThermal(moon,-70,0),null);assert.equal(samplePlanetaryThermal(moon,NaN,0),null);
});
test('MEDA temperatures come fromcalibratedGROUND_TEMPandnotAIR_TEMP',()=>{
 assert.equal(mars.source.field,'GROUND_TEMP');assert.match(mars.source.title,/calibrated/);assert.match(mars.source.url,/CAL_TIRS.*P04\.CSV$/);assert.equal(mars.summary.minK,187.53);assert.equal(mars.summary.maxK,278.85);assert.equal(mars.summary.meanK,220.457);assert.match(mars.source.sha256,/^[a-f0-9]{64}$/);assert.match(mars.source.md5,/^[a-f0-9]{32}$/);assert.match(PLANETARY_THERMAL_SOURCES.find(source=>source.id==='meda-thermal').title,/calibrated/);
});
test('MEDA retained observations and half-hour bin counts remain distinct',()=>{
 assert.equal(mars.quality.rawRows,51247);assert.equal(mars.summary.sampleCount,50954);assert.equal(mars.summary.validCount,50954);assert.equal(mars.summary.binCount,37);assert.equal(mars.series.length,48);assert.equal(mars.series.filter(item=>item.valueK!==null).length,37);assert.equal(mars.series.filter(item=>item.valueK===null).length,11);assert.equal(mars.series.reduce((sum,item)=>sum+item.count,0),50954);assert.equal(mars.quality.excluded.qualityFlags,293);
});
test('MEDA bin labels andnumericpositionspreserve30minutesolar-timegaps',()=>{
 mars.series.forEach((item,index)=>{assert.equal(item.lmstSeconds,index*1800+900);assert.equal(item.hour,item.lmstSeconds/3600);assert.match(item.time,index%2?/:45 LMST$/:/:15 LMST$/);assert.equal(item.binEndLmstSeconds-item.binStartLmstSeconds,1800);if(item.valueK===null){assert.equal(item.count,0);assert.equal(item.missing,true);}});assert.match(mars.seriesStatistic,/means/);assert.match(mars.temporal.note,/not gap-filled/);
});
test('incompleteadvisoryqualityflagsareUNKNOWNnotassumedgood',()=>{
 assert.equal(mars.quality.qualityComplete,false);assert.equal(mars.quality.unknownFlagCounts.WHEEL_OUTSIDE_TIRS_DOWNWARD_LOOKING_FOV,51247);assert.ok(mars.quality.requiredFlags.includes('ROVER_STILL'));assert.match(mars.quality.note,/UNKNOWN/);assert.match(mars.source.caveat,/advisory flags/);
});
test('Marsroverobservationsarenotpaintedasacrater-widethermalmap',()=>{
 assert.equal(mars.raster,undefined);assert.equal(mars.spatialSupport,'rover-point-time-series');assert.equal(samplePlanetaryThermal(mars,18.38,77.58),null);assert.equal(mars.coordinates.lat,18.44516437);assert.equal(mars.coordinates.lon,77.4518217);assert.equal(mars.source.waypoints.sol,29);assert.match(mars.coordinates.note,/not exact/);assert.equal(mars.temporal.startUTC,'2021-03-19T23:33:20.096Z');
});
test('thermalvalidationacceptsexplicitgapsbutrejectsallmissingseriesorwrongquantities',()=>{
 assert.equal(validatePlanetaryThermal({available:false,reason:'No data'}).available,false);assert.throws(()=>validatePlanetaryThermal({...mars,quantity:'air-temperature'}),/quantity/);assert.throws(()=>validatePlanetaryThermal({...mars,series:[{valueK:null}]}),/series/);assert.throws(()=>validatePlanetaryThermal({...mars,summary:{...mars.summary,meanK:NaN}}),/summary/);assert.throws(()=>validatePlanetaryThermal({...moon,raster:{...moon.raster,valuesK:[0]}}),/raster/);
});
test('CSVparserpreservesmissingfieldsandquotedcommas',()=>{
 assert.deepEqual(parseCSVLine('123,"a,b",,42'),['123','a,b','','42']);assert.deepEqual(parseCSVLine('"a""b",'),['a"b','']);assert.ok(distanceMeters(-89.67,129.78,-89.67,129.78)<1e-9);assert.ok(distanceMeters(-89.67,179,-89.67,-179)<1000);
});
test('planetaryloaderfetchesbundledrecordsandunsupportedtargetsremainexplicitlyunavailable',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async url=>new Response(await readFile(url));const loaded=await loadPlanetaryThermal('jezero');assert.equal(loaded.summary.sampleCount,50954);assert.equal((await loadPlanetaryThermal({id:'shackleton'})).raster.size,65);assert.equal((await loadPlanetaryThermal('wadi-rum')).available,false);const signal=AbortSignal.abort();await assert.rejects(()=>loadPlanetaryThermal('jezero',{signal}),{name:'AbortError'});}finally{globalThis.fetch=original;}
});
