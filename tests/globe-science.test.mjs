import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BODY_SHAPES,validateGlobeDEM,loadGlobeDEM,sampleGlobeElevation,sampleGlobeRadius,earthGeodeticPosition,planetocentricPosition,surfacePosition,inversePosition,normalizeLongitude} from '../dist/js/globe-science.js';
import {resamplePlanetaryNative} from '../scripts/fetch-globe-dem.mjs';
const data={};for(const body of['earth','mars','moon'])data[body]=JSON.parse(await readFile(new URL(`../dist/data/${body}-globe-dem.json`,import.meta.url),'utf8'));
const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} versus ${expected}`);

test('official body shapes preserve WGS84 flattening and NAIF planetary radii',()=>{
 assert.equal(BODY_SHAPES.earth.axesMeters[0],6378137);close(BODY_SHAPES.earth.axesMeters[2],6356752.314245179,1e-6);assert.deepEqual(BODY_SHAPES.mars.axesMeters,[3396190,3396190,3376200]);assert.deepEqual(BODY_SHAPES.moon.axesMeters,[1737400,1737400,1737400]);
 for(const body of['mars','moon'])assert.deepEqual(data[body].source.shapeProvenance.parsedRadiiMeters[body],BODY_SHAPES[body].axesMeters);
});
test('all three agency numeric global datasets are complete with authenticated byte provenance',()=>{
 for(const [body,grid]of Object.entries(data)){assert.equal(validateGlobeDEM(grid),grid);assert.equal(grid.body,body);assert.equal(grid.width,361);assert.equal(grid.height,181);assert.equal(grid.heightsMeters.length,65341);assert.ok(grid.heightsMeters.every(Number.isFinite));assert.equal(grid.verticalExaggeration,1);for(const file of grid.source.files){assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.ok(file.bytes>0);assert.match(file.url,/noaa\.gov|pds-geosciences\.wustl\.edu/);}assert.match(grid.source.shapeProvenance.sha256,/^[a-f0-9]{64}$/);}
});
test('global longitude seams and polar vertices close without arbitrary terrain patches',()=>{
 for(const grid of Object.values(data)){
  for(let row=0;row<grid.height;row++)close(grid.heightsMeters[row*grid.width],grid.heightsMeters[row*grid.width+grid.width-1]);
  for(const row of[0,grid.height-1])for(let col=1;col<grid.width;col++)close(grid.heightsMeters[row*grid.width],grid.heightsMeters[row*grid.width+col]);
  close(sampleGlobeElevation(grid,20,-180),sampleGlobeElevation(grid,20,180));close(sampleGlobeElevation(grid,-30,540),sampleGlobeElevation(grid,-30,-180));
 }
});
test('WGS84 ECEF positions have correct equatorial and polar radii',()=>{
 const equator=earthGeodeticPosition(0,0),east=earthGeodeticPosition(0,90),north=earthGeodeticPosition(90,0);
 close(equator[0],6378137);close(equator[1],0);close(equator[2],0);close(east[1],6378137);close(north[2],BODY_SHAPES.earth.polarRadiusMeters);close(Math.hypot(...earthGeodeticPosition(0,0,1000)),6379137);
});
test('geodetic inverse returns the original Earth angles and altitude rather than geocentric latitude',()=>{
 for(const [lat,lon,h]of[[0,0,0],[45,77,1234],[-60,-179.2,-400],[84.5,120,8000],[90,0,500],[-90,0,-200]]){const point=earthGeodeticPosition(lat,lon,h),inverse=inversePosition('earth',point);close(inverse.lat,lat,1e-8);close(inverse.lon,normalizeLongitude(lon),1e-8);close(inverse.heightMeters,h,1e-5);}
 const point=earthGeodeticPosition(45,0,0),geocentric=Math.atan2(point[2],Math.hypot(point[0],point[1]))*180/Math.PI;assert.ok(Math.abs(geocentric-45)>0.1);
});
test('Mars geometry uses original planetary radius, never areoid height plus ellipsoid',()=>{
 const grid=data.mars;assert.equal(grid.radiiMeters.length,65341);
 for(const [lat,lon]of[[0,0],[18.38,77.58],[-45,135],[90,0]]){const point=surfacePosition(grid,lat,lon),r=sampleGlobeRadius(grid,lat,lon),inverse=inversePosition('mars',point);close(Math.hypot(...point),r,1e-6);close(inverse.lat,lat,1e-8);if(Math.abs(lat)<90)close(inverse.lon,normalizeLongitude(lon),1e-8);}
 const r=sampleGlobeRadius(grid,0,0),wrong=BODY_SHAPES.mars.equatorialRadiusMeters+sampleGlobeElevation(grid,0,0);assert.ok(Math.abs(r-wrong)>100);
});
test('Moon geometry adds actual LOLA radial height to the stated1737.4km sphere',()=>{
 for(const [lat,lon]of[[0,0],[-89.67,129.78],[40,-150]]){const height=sampleGlobeElevation(data.moon,lat,lon),point=surfacePosition(data.moon,lat,lon);close(Math.hypot(...point),1737400+height,1e-6);const inverse=inversePosition('moon',point);close(inverse.lat,lat,1e-8);close(inverse.lon,normalizeLongitude(lon),1e-8);close(inverse.heightMeters,height,1e-6);}
});
test('Earth keeps official ocean bathymetry and explicitly records the uncorrected geoid approximation',()=>{
 assert.match(data.earth.source.title,/NOAA ETOPO1/);assert.ok(sampleGlobeElevation(data.earth,0,-140)<-1000);assert.match(data.earth.datum.vertical,/Mean Sea Level/);assert.match(data.earth.geometryAccuracy,/geoid undulation/);const lat=40,lon=-100,point=surfacePosition(data.earth,lat,lon);close(inversePosition('earth',point).heightMeters,sampleGlobeElevation(data.earth,lat,lon),1e-5);
});
test('native planetary pixel-center resampling preserves constant data and uses the longitude seam correctly',()=>{
 const constant=resamplePlanetaryNative(()=>123);assert.equal(constant.length,65341);assert.ok(constant.every(v=>v===123));
 const longitudinal=resamplePlanetaryNative(x=>Math.cos((x+.5)/4*Math.PI/180)*1000);close(longitudinal[90*361+180],999.998,0.001);close(longitudinal[90*361],longitudinal[90*361+360]);close(longitudinal[0],0,1e-6);
});
test('bilinear elevation sampling is distinct from nearest-cell lookup',()=>{
 const grid={body:'moon',width:3,height:3,registration:{latitudeStart:90,latitudeStep:-90,longitudeStart:-180,longitudeStep:180},heightsMeters:[0,0,0,100,300,100,0,0,0]};close(sampleGlobeElevation(grid,45,-90),100);close(sampleGlobeElevation(grid,0,0),300);
});
test('reference planetocentric ellipsoid utility and invalid inputs are handled explicitly',()=>{
 close(Math.hypot(...planetocentricPosition('mars',0,0)),3396190);close(Math.hypot(...planetocentricPosition('mars',90,0)),3376200);assert.throws(()=>surfacePosition(data.moon,91,0),RangeError);assert.throws(()=>inversePosition('earth',[0,0,0]),RangeError);assert.throws(()=>validateGlobeDEM({...data.mars,radiiMeters:[]}),/radius/);assert.throws(()=>validateGlobeDEM({...data.moon,registration:{}}),/grid/);
});
test('bundled global DEM loader uses real records and honors cancellation',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async url=>new Response(await readFile(url));assert.equal((await loadGlobeDEM('earth')).source.id,'noaa-etopo1');assert.equal((await loadGlobeDEM('mars')).radiiMeters.length,65341);assert.equal((await loadGlobeDEM('moon')).source.id,'nasa-lola-global');await assert.rejects(()=>loadGlobeDEM('pluto'),RangeError);await assert.rejects(()=>loadGlobeDEM('earth',{signal:AbortSignal.abort()}),{name:'AbortError'});}finally{globalThis.fetch=original;}
});
