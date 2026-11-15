/** Repackage official numeric DEMs for same-origin browser access; no generated terrain. */
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {pdsField} from './lib/planetary-terrain.mjs';
import {analyzeTerrain} from '../dist/js/science.js';

const OUT=new URL('../dist/data/search-atlas/',import.meta.url);
const RAW=new URL('../../output/search-atlas-sources/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const PRODUCTS=[
 {body:'mars',id:'mola',product:'megt90n000fb',base:'https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg032/',ppd:32,width:11520,height:5760,little:false,scale:1,radius:3396000,datum:'Topography relative to the Mars areoid; IAU2000 planetocentric, east-positive longitude.',info:'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html'},
 {body:'moon',id:'lola',product:'ldem_16',base:'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/',ppd:16,width:5760,height:2880,little:true,scale:.5,radius:1737400,datum:'Height relative to a 1,737,400 m sphere; Mean Earth/polar axis of DE421, east-positive longitude.',info:'https://pds-geosciences.wustl.edu/missions/lro/lola.htm'}
];
async function acquire(url,destination,expected){
 try{const data=await readFile(destination);if(!expected||data.length===expected)return data;}catch{}
 if(!process.argv.includes('--fetch'))throw Error('Missing original source; run with --fetch: '+url);
 const response=await fetch(url,{signal:AbortSignal.timeout(600000)});if(!response.ok)throw Error(response.status+' '+url);
 await pipeline(Readable.fromWeb(response.body),createWriteStream(fileURLToPath(destination)));
 const data=await readFile(destination);if(expected&&data.length!==expected)throw Error('Incomplete original source '+url);
 return data;
}
function nativeValue(raw,p,x,y){x=((x%p.width)+p.width)%p.width;if(y<0||y>=p.height)throw Error('Outside source latitude range');const i=(y*p.width+x)*2;const dn=p.little?raw.readInt16LE(i):raw.readInt16BE(i);if(dn===-32768||dn===32767)throw Error('Source sentinel requires review');return dn*p.scale;}
function windowAt(raw,p,lat,lon){
 const half=16000/p.radius*180/Math.PI,dlon=half/Math.cos(lat*Math.PI/180),heights=[];
 for(let row=0;row<17;row++)for(let col=0;col<17;col++){
  const y=(90-(lat+half-row/16*half*2))*p.ppd-.5,x=((lon-dlon+col/16*dlon*2+360)%360)*p.ppd-.5,a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;
  heights.push((nativeValue(raw,p,a,b)*(1-u)+nativeValue(raw,p,a+1,b)*u)*(1-v)+(nativeValue(raw,p,a,b+1)*(1-u)+nativeValue(raw,p,a+1,b+1)*u)*v);
 }
 return {size:17,widthMeters:32000,depthMeters:32000,heights};
}
export async function main(){
 await mkdir(RAW,{recursive:true});await mkdir(OUT,{recursive:true});
 const manifest={version:'planetary-search-atlas-v1',createdAt:new Date().toISOString(),method:{extentMeters:32000,gridSpacingMeters:2000,gradientBaselineMeters:4000,indexStepDegrees:3,latitudeLimit:75},bodies:{}};
 for(const p of PRODUCTS){
  console.log('Acquiring official '+p.body+' DEM…');
  const labelBytes=await acquire(p.base+p.product+'.lbl',new URL(p.product+'.lbl',RAW));const label=labelBytes.toString('utf8');
  for(const [key,value]of Object.entries({LINES:p.height,LINE_SAMPLES:p.width,SAMPLE_TYPE:p.little?'LSB_INTEGER':'MSB_INTEGER',SAMPLE_BITS:16,MAP_RESOLUTION:p.ppd}))if(Number.isFinite(value)?Number(pdsField(label,key))!==value:pdsField(label,key)!==value)throw Error('Unexpected '+key);
  if(p.little&&Number(pdsField(label,'SCALING_FACTOR'))!==p.scale)throw Error('Unexpected LOLA height scale');
  const raw=await acquire(p.base+p.product+'.img',new URL(p.product+'.img',RAW),p.width*p.height*2);
  const directory=new URL(p.body+'/',OUT);await mkdir(directory,{recursive:true});await writeFile(new URL(p.body+'.lbl',OUT),labelBytes);
  const tiles={},tileSize=20*p.ppd;
  for(let ty=0;ty<9;ty++)for(let tx=0;tx<18;tx++){
   const bytes=Buffer.alloc(tileSize*tileSize*2);
   // Exact reversible signed-16 row deltas. No averaging, quantization or AI.
   for(let y=0;y<tileSize;y++){let previous=0;for(let x=0;x<tileSize;x++){const offset=((ty*tileSize+y)*p.width+tx*tileSize+x)*2,value=p.little?raw.readInt16LE(offset):raw.readInt16BE(offset);bytes.writeInt16LE(((value-previous+32768)&65535)-32768,(y*tileSize+x)*2);previous=value;}}
   const zipped=gzipSync(bytes,{level:9});if(!gunzipSync(zipped).equals(bytes))throw Error('Lossless roundtrip failed');
   const name=ty+'-'+tx+'.bin.gz';await writeFile(new URL(name,directory),zipped);tiles[ty+'-'+tx]={file:p.body+'/'+name,sha256:hash(zipped),bytes:zipped.length};
  }
  const index=[];for(let lat=-73.5;lat<=73.5;lat+=3)for(let lon=-178.5;lon<180;lon+=3){const s=analyzeTerrain(windowAt(raw,p,lat,lon));index.push({lat,lon,relief:s.relief,slopeMean:s.slopeMean,slopeP90:s.slopeP90,slopeHistogram:s.slopeHistogram});}
  const indexBytes=Buffer.from(JSON.stringify(index)),indexGzip=gzipSync(indexBytes,{level:9});await writeFile(new URL(p.body+'-index.json.gz',OUT),indexGzip);
  manifest.bodies[p.body]={body:p.body,id:p.id,product:p.product,pixelsPerDegree:p.ppd,width:p.width,height:p.height,tileSize,tileColumns:18,tileRows:9,scale:p.scale,radiusMeters:p.radius,datum:p.datum,infoUrl:p.info,source:{url:p.base+p.product+'.img',sha256:hash(raw),bytes:raw.length,labelUrl:p.base+p.product+'.lbl',labelSha256:hash(labelBytes),productVersion:pdsField(label,'PRODUCT_VERSION_ID'),observationStart:pdsField(label,'START_TIME'),observationStop:pdsField(label,'STOP_TIME'),retrievedAt:(await stat(new URL(p.product+'.img',RAW))).mtime.toISOString()},encoding:'gzip signed little-endian int16 horizontal row deltas, modulo 65536; first value in each row is absolute DN',tiles,index:{file:p.body+'-index.json.gz',sha256:hash(indexGzip),count:index.length,stepDegrees:3},caveat:'Source gridding interpolates between instrument tracks. No per-cell observation counts or uncertainty layer acquired. Pixel spacing is not measurement accuracy. Search is regional terrain comparison, not rover-scale hazard or landing assessment.'};
  console.log(p.body+': '+index.length+' indexed centers, '+Object.values(tiles).reduce((s,t)=>s+t.bytes,0)+' compressed bytes.');
 }
 await writeFile(new URL('manifest.json',OUT),JSON.stringify(manifest,null,2));console.log('Search atlas complete.');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await main();
