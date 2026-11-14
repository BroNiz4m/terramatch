/** Research-only candidate audit. --fetch retrieves bounded public sources; default verifies saved evidence offline. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {loadEarthWindow,decodeTerrarium,isLand,landWindowCoverage} from '../dist/js/terrain-search.js';
import {analyzeTerrain} from '../dist/js/science.js';

const OUT=new URL('../research/longyearbreen-audit-2026-11-15/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b.toString('utf8'));
const save=(name,data)=>writeFile(new URL(name,OUT),JSON.stringify(data,null,2)+'\n');
const CENTER={lat:78.17551,lon:15.47693}; // Rounded midpoint of the previously audited 2016 GLIMS bounds; not a surveyed field site.
const glacierBase='https://geodata.npolar.no/arcgis/rest/services/Temadata/I_Isbreer_Overflatetyper_og_utstrekning_Svalbard/MapServer';
const query=(sr,format)=>`${glacierBase}/4/query?${new URLSearchParams({geometry:'15.42,78.16,15.54,78.20',geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'*',returnGeometry:'true',outSR:String(sr),f:format})}`;
const earthUrl='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson';

async function fingerprints(){
  const paths=(await readdir(new URL('../dist/data/',import.meta.url))).map(p=>'dist/data/'+p).concat(['dist/js/science.js','dist/js/terrain-search.js']);
  return Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))])));
}
async function bounded(url,max=2*1024*1024){
  const r=await fetch(url,{signal:AbortSignal.timeout(30000)}),reader=r.body.getReader(),parts=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max)throw Error('Response exceeds audit byte limit.');parts.push(Buffer.from(value));}}catch(e){await reader.cancel();throw e;}
  const bytes=Buffer.concat(parts);
  return {bytes,metadata:{url,status:r.status,finalHost:new URL(r.url).host,contentType:r.headers.get('content-type'),bytes:bytes.length,sha256:hash(bytes),retrievedAt:new Date().toISOString()}};
}
async function acquire(){
  await mkdir(OUT,{recursive:true});await mkdir(new URL('sources/',OUT),{recursive:true});
  const sources={};
  for(const [name,url,max]of [['glacier-geographic',query(4326,'geojson'),2e6],['glacier-projected',query(25833,'json'),2e6],['natural-earth-10m',earthUrl,16e6]]){
    const r=await bounded(url,max);assert.equal(r.metadata.status,200);const d=json(r.bytes);assert.ok(!d.error,JSON.stringify(d.error));
    const file=`sources/${name}.json.gz`;await writeFile(new URL(file,OUT),gzipSync(r.bytes));sources[name]={...r.metadata,file};
    console.log(`${name}: ${r.bytes.length} source bytes saved`);
  }
  const meta=await bounded('https://api.npolar.no/dataset/1b8631bf-7710-449a-a56f-0da1a4fef608');
  const m=json(meta.bytes);sources.inventory={...meta.metadata,id:m.id,doi:m.doi,title:m.content.title,summary:m.content.summary,modified:m.modified,note:'Scientific metadata retained; contact details and user-account fields omitted.'};
  const full=await bounded('https://www.glims.org/services/glacierinfo_full?anlys_id=994985'),g=json(full.bytes);
  sources.glims2016={...full.metadata,glacier:g.glac_info,images:g.img_info,method:g.subm_info?.process_description,note:'Scientific metadata retained; personal contact details omitted. This is NOT the 2020 geometry source.'};
  const dl='https://www.glims.org/services/downloadprepare?'+new URLSearchParams({download_type:'id',clause:'994985',file_format:'kml',archive_type:'zip'});
  const auth=await bounded(dl);sources.glimsExport={requestedAnalysis:994985,status:auth.metadata.status,finalHost:auth.metadata.finalHost,contentType:auth.metadata.contentType,requiresEarthdataLogin:auth.metadata.finalHost==='urs.earthdata.nasa.gov',note:'No login, credentials or redirected session parameters retained; no GLIMS polygon downloaded.'};
  const tiles=[],nativeFetch=globalThis.fetch;
  // Archive exactly the PNG bytes consumed by the unchanged application loader.
  globalThis.fetch=async(...args)=>{
    const r=await nativeFetch(...args),url=String(args[0]);
    if(url.startsWith('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/')&&r.ok){
      const bytes=Buffer.from(await r.clone().arrayBuffer());assert.ok(bytes.length<2e6);
      const file='sources/tile-'+url.split('/').slice(-3).join('-');await writeFile(new URL(file,OUT),bytes);
      tiles.push({url,file,sha256:hash(bytes),bytes:bytes.length});
    }
    return r;
  };
  try{
    const mask=json(await readFile(new URL('../dist/data/land-mask.geojson',import.meta.url)));
    const {data}=await loadEarthWindow({...CENTER,name:'Longyearbreen candidate audit',country:'Svalbard',landmask:mask,onProgress:e=>{if(e.stage!=='tiles'||e.loaded===e.total)console.log(e.message);}});
    await save('terrain-window.json',data);
  }finally{globalThis.fetch=nativeFetch;}
  sources.tiles=tiles.sort((a,b)=>a.url.localeCompare(b.url));await save('sources.json',sources);
}

const polygons=geometry=>geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:(()=>{throw Error('Expected polygon geometry.');})();
function ringCheck(ring){
  assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));
  for(const p of ring)assert.ok(p.length>=2&&p.slice(0,2).every(Number.isFinite));
}
function signedArea(ring){const [ox,oy]=ring[0];let a=0;for(let i=1;i<ring.length;i++)a+=(ring[i-1][0]-ox)*(ring[i][1]-oy)-(ring[i][0]-ox)*(ring[i-1][1]-oy);return a/2;}
// Independent transverse-Mercator series for ETRS89 / UTM 33N (GRS80).
function utm33([lon,lat]){
  const a=6378137,e2=.00669438002290,k=.9996,p=lat*Math.PI/180,l=(lon-15)*Math.PI/180,ep=e2/(1-e2);
  const n=a/Math.sqrt(1-e2*Math.sin(p)**2),t=Math.tan(p)**2,c=ep*Math.cos(p)**2,A=Math.cos(p)*l;
  const m=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*p-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*p)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*p)-35*e2**3/3072*Math.sin(6*p));
  return [500000+k*n*(A+(1-t+c)*A**3/6+(5-18*t+t*t+72*c-58*ep)*A**5/120),k*(m+n*Math.tan(p)*(A*A/2+(5-t+9*c+4*c*c)*A**4/24+(61-58*t+t*t+600*c-330*ep)*A**6/720))];
}
function intersects(a,b,c,d){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const box=(p,q,r)=>r[0]>=Math.min(p[0],q[0])-1e-10&&r[0]<=Math.max(p[0],q[0])+1e-10&&r[1]>=Math.min(p[1],q[1])-1e-10&&r[1]<=Math.max(p[1],q[1])+1e-10;
  const v=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];
  if(v[0]*v[1]<0&&v[2]*v[3]<0)return true;
  return (Math.abs(v[0])<1e-10&&box(a,b,c))||(Math.abs(v[1])<1e-10&&box(a,b,d))||(Math.abs(v[2])<1e-10&&box(c,d,a))||(Math.abs(v[3])<1e-10&&box(c,d,b));
}
function simpleRing(ring){for(let i=0;i<ring.length-1;i++)for(let j=i+2;j<ring.length-1;j++){if(i===0&&j===ring.length-2)continue;assert.ok(!intersects(ring[i],ring[i+1],ring[j],ring[j+1]),`Self-intersecting polygon edges ${i},${j}`);}}
// Independent planar parity check, only used for small, non-antimeridian Svalbard polygons.
function insideRing(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function inside(x,y,geometry){return polygons(geometry).some(rings=>insideRing(x,y,rings[0])&&!rings.slice(1).some(r=>insideRing(x,y,r)));}
function independentStats(t){
  const h=t.heights,n=t.size,slopes=[],bins=Array(6).fill(0),edges=[2,5,10,20,35,90];
  for(let row=1;row<n-1;row++)for(let col=1;col<n-1;col++){const i=row*n+col,dx=(h[i+1]-h[i-1])/1000,dy=(h[i+n]-h[i-n])/1000,a=Math.atan(Math.hypot(dx,dy))*180/Math.PI;slopes.push(a);bins[edges.findIndex(e=>a<e)]++;}
  slopes.sort((a,b)=>a-b);return{min:Math.min(...h),max:Math.max(...h),relief:Math.max(...h)-Math.min(...h),slopeMean:slopes.reduce((a,b)=>a+b,0)/slopes.length,slopeP90:slopes[Math.floor(.9*(slopes.length-1))],slopeHistogram:bins.map(x=>x/slopes.length)};
}
async function verify(before){
  const sources=json(await readFile(new URL('sources.json',OUT))),decoded={};
  for(const name of ['glacier-geographic','glacier-projected','natural-earth-10m']){const s=sources[name],bytes=gunzipSync(await readFile(new URL(s.file,OUT)));assert.equal(hash(bytes),s.sha256);decoded[name]=json(bytes);}
  const collection=decoded['glacier-geographic'];assert.equal(collection.type,'FeatureCollection');assert.ok(!collection.exceededTransferLimit);
  const selected=collection.features.filter(f=>f.properties.NAME==='Longyearbreen'&&f.properties.IDENT===14204);assert.equal(selected.length,1);
  const glacier=selected[0];assert.equal(glacier.properties.YEAR,2020);assert.equal(glacier.properties.SOURCE,'Sentinel 2 2020 Mosaic');
  const rings=polygons(glacier.geometry).flat();for(const ring of rings){ringCheck(ring);simpleRing(ring);for(const [lon,lat]of ring)assert.ok(lon>15&&lon<16&&lat>78&&lat<79);}
  const projected=decoded['glacier-projected'];assert.equal(projected.spatialReference.wkid,25833);assert.ok(!projected.exceededTransferLimit);
  const matching=projected.features.filter(f=>f.attributes.IDENT===14204);assert.equal(matching.length,1);
  const native=matching[0];assert.equal(native.geometry.rings.length,rings.length);
  for(const ring of native.geometry.rings){ringCheck(ring);simpleRing(ring);}
  const projectedVertices=native.geometry.rings.flat();let maxRegistrationErrorMeters=0;
  for(const p of rings.flat()){const [x,y]=utm33(p),error=Math.min(...projectedVertices.map(q=>Math.hypot(x-q[0],y-q[1])));assert.ok(error<.1,'Geographic and native projected vertices must register within 0.1 m computational tolerance.');maxRegistrationErrorMeters=Math.max(maxRegistrationErrorMeters,error);}
  // ArcGIS uses clockwise shells / counterclockwise holes in its native polygon JSON.
  const area=Math.abs(native.geometry.rings.reduce((sum,r)=>sum+signedArea(r),0));
  assert.ok(Math.abs(area-glacier.properties.Shape_Area)<.01);assert.ok(Math.abs(area/1e6-glacier.properties.AREA)<1e-6);
  const terrain=json(await readFile(new URL('terrain-window.json',OUT))),b=terrain.bounds;
  assert.equal(terrain.size,65);assert.equal(terrain.heights.length,4225);assert.ok(terrain.heights.every(Number.isFinite));assert.ok(Math.abs(terrain.center.lat-CENTER.lat)<1e-10&&Math.abs(terrain.center.lon-CENTER.lon)<1e-10);
  for(const [lon,lat]of rings.flat())assert.ok(lon>=b.west&&lon<=b.east&&lat>=b.south&&lat<=b.north);
  assert.ok(inside(CENTER.lon,CENTER.lat,glacier.geometry),'Chosen study center must actually lie within the acquired glacier outline.');
  const tileMap=new Map();
  for(const s of sources.tiles){const bytes=await readFile(new URL(s.file,OUT));assert.equal(hash(bytes),s.sha256);const provenance=terrain.source.files.find(x=>x.url===s.url);assert.equal(provenance.sha256,s.sha256);tileMap.set(`${provenance.x}/${provenance.y}`,await decodeTerrarium(bytes));}
  assert.equal(tileMap.size,terrain.source.files.length);
  const z=terrain.source.zoom,scale=256*2**z;
  const pixel=(x,y)=>{const t=tileMap.get(`${Math.floor(x/256)}/${Math.floor(y/256)}`);assert.ok(t,'All interpolation neighbours must be in saved source tiles.');return t.heights[(y%256)*256+x%256];};
  let maximumGridErrorMeters=0;
  for(let r=0;r<65;r++)for(let c=0;c<65;c++){
    const lat=b.north+(b.south-b.north)*r/64,lon=b.west+(b.east-b.west)*c/64;
    const x=(lon+180)/360*scale-.5,y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*scale-.5,ix=Math.floor(x),iy=Math.floor(y),tx=x-ix,ty=y-iy;
    const value=(pixel(ix,iy)*(1-tx)+pixel(ix+1,iy)*tx)*(1-ty)+(pixel(ix,iy+1)*(1-tx)+pixel(ix+1,iy+1)*tx)*ty;
    const error=Math.abs(Math.round(value*100)/100-terrain.heights[r*65+c]);maximumGridErrorMeters=Math.max(maximumGridErrorMeters,error);assert.ok(error<1e-9);
  }
  const actual=analyzeTerrain(terrain),own=independentStats(terrain);
  for(const key of ['min','max','relief','slopeMean','slopeP90'])assert.ok(Math.abs(actual[key]-own[key])<1e-9);
  own.slopeHistogram.forEach((n,i)=>assert.ok(Math.abs(n-actual.slopeHistogram[i])<1e-12));
  const detailed=decoded['natural-earth-10m'];
  // Keep complete polygon parts whose bounding boxes intersect this study window. No clipping or invented coastline.
  const local={type:'FeatureCollection',features:[]};
  for(const f of detailed.features)for(const coordinates of polygons(f.geometry)){
    const p=coordinates[0],xs=p.map(p=>p[0]),ys=p.map(p=>p[1]);
    if(Math.max(...xs)>=b.west&&Math.min(...xs)<=b.east&&Math.max(...ys)>=b.south&&Math.min(...ys)<=b.north)local.features.push({type:'Feature',properties:{source:'Natural Earth 1:10m land; complete intersecting polygon part'},geometry:{type:'Polygon',coordinates}});
  }
  assert.ok(local.features.length);const coverage=landWindowCoverage(b,local);
  coverage.method='5 × 5 samples against Natural Earth 1:10 million land polygons. More detailed than the app 1:110m mask, still generalized cartography; not 10-metre resolution or a current coastline survey.';
  const disagreements=coverage.samples.filter((p,i)=>p.mappedLand!==terrain.source.landScreening.samples[i].mappedLand);
  for(const p of coverage.samples)assert.equal(p.mappedLand,local.features.some(f=>inside(p.lon,p.lat,f.geometry)));
  const gridSamples=[];let glacierGridPoints=0;
  for(let row=0;row<65;row++)for(let col=0;col<65;col++){
    const lat=b.north+(b.south-b.north)*row/64,lon=b.west+(b.east-b.west)*col/64,mappedLand=isLand(lon,lat,local),mappedGlacier=inside(lon,lat,glacier.geometry);
    if(mappedGlacier)glacierGridPoints++;gridSamples.push({row,col,lat,lon,mappedLand,mappedGlacier});
  }
  const landCount=gridSamples.filter(p=>p.mappedLand).length;
  assert.ok(disagreements.length>0);assert.equal(terrain.comparisonEligible,true);assert.equal(coverage.allLand,false);
  await save('longyearbreen-2020.geojson',{type:'FeatureCollection',attribution:'© Norwegian Polar Institute. Based on Copernicus Sentinel-2 imagery.',license:'CC BY 4.0',terms:'https://geodata.npolar.no/bruksvilkar/',source:sources['glacier-geographic'].url,features:[glacier]});await save('local-land-10m.geojson',local);await save('grid-screen.json',gridSamples);
  assert.deepEqual(await fingerprints(),before);
  const result={schemaVersion:1,localDate:'2026-11-15',scope:'Research-only candidate eligibility audit. Application files, production datasets, scores and live deployment unchanged.',centerSelection:'Rounded midpoint of audited 2016 GLIMS bounds; center verified inside NPI 2020 polygon. Not an optimized or field-approved location.',center:CENTER,bounds:b,
    glacier:{source:'NPI public ArcGIS 2020 inventory layer',doi:sources.inventory.doi,objectId:glacier.properties.OBJECTID,ident:14204,year:2020,sourceImagery:glacier.properties.SOURCE,observationPeriod:'July–September 2020 per inventory documentation; individual acquisition day not supplied by this feature',parts:polygons(glacier.geometry).length,rings:rings.length,holes:polygons(glacier.geometry).reduce((n,p)=>n+p.length-1,0),vertices:rings.reduce((n,r)=>n+r.length,0),maxRegistrationErrorMeters,areaProjectedM2:area,areaReportedKm2:glacier.properties.AREA,sourceAreaDifferenceM2:area-glacier.properties.Shape_Area,fullyInsideWindow:true,centerInside:true,topology:'All rings closed, finite and without detected nonadjacent segment intersections. No inner rings in this feature; none were discarded.',versionCaveat:'The cited 2021 catalogue record now says a revised 2026 version exists. The live ArcGIS layer exposes YEAR=2020 but no explicit inventory release version. Retain the exact returned bytes/hash; do not assert this is the newest release.'},
    glims2016:{analysisId:994985,glacierId:sources.glims2016.glacier.glacier_id,observationDate:sources.glims2016.glacier.source_timestamp,areaKm2:sources.glims2016.glacier.db_calculated_area,fullGeometryAcquired:false,exportRequiresLogin:sources.glimsExport.requiresEarthdataLogin,comparisonCaveat:'2016 GLIMS area and 2020 NPI area differ. They are distinct outlines/methods; no growth/retreat trend is established by comparing these two areas.'},
    terrain:{samples:4225,slopeSamples:3969,statistics:own,tiles:tileMap.size,zoom:z,tilePixelSpacingAtCenterMeters:terrain.source.nativePixelSpacingMetersAtCenter,maximumReconstructionErrorMeters:maximumGridErrorMeters,allSamplesReconstructed:true,verticalDatum:'Mixed-source Terrarium; no local vertical datum, acquisition epoch or accuracy guarantee established.',negativeElevations:terrain.heights.filter(h=>h<0).length,negativeElevationsAreWaterClassifier:false},
    coverage:{application110m:terrain.source.landScreening,independent10m:coverage,disagreements,fullGrid:{land:landCount,nonLand:4225-landCount,total:4225,mappedGlacierPoints:glacierGridPoints,note:'Point counts only; not exact land/water/glacier area fractions. One named glacier is mapped, not all glaciers in the window.'}},
    decision:{candidateStatus:'defer_as_ranked_reference',iceEvidenceStatus:'dated_outline_acquired',windowStatus:'mixed_land_water_requires_coverage_review',releaseReady:false,rankingEligibleForThisAudit:false,reasons:['A more detailed independent coastline contradicts the app coarse all-land result; this 32 km window cannot be represented as a verified wholly terrestrial analog.','A real historical glacier polygon supports separately labelled mapped extent, not contemporary ice, thickness, purity or lunar ice equivalence.','Resolve inventory release attribution and use an approved terrestrial window before adding a bundled reference.'],next:'Seek an inland polar candidate/window with verified ice geometry and land coverage, or design an explicit coverage-aware comparison method separately. Do not bypass the land gate or silently shift this candidate.'},
    productionFingerprints:before,productionFilesUnchanged:true,checks:{sourceHashes:true,polygonRegistrationAndTopology:true,projectedArea:true,independentLandParity:true,fullGridReconstruction:true,independentTerrainStatistics:true}};
  await save('results.json',result);console.log(JSON.stringify({decision:result.decision,glacier:result.glacier,land110m:25,land10m:coverage.land,fullGrid:result.coverage.fullGrid,terrain:result.terrain},null,2));
}

const before=await fingerprints();
if(process.argv.includes('--fetch'))await acquire();
await verify(before);
