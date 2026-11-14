/** Offline verification of saved source bytes and every research-grid sample. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {analyzeTerrain,terrainCoordinates} from '../dist/js/science.js';

const dir=new URL('../research/planetary-target-audit-2026-11-15/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const report=JSON.parse(await readFile(new URL('probes.json',dir),'utf8'));
assert.equal(report.applicationChanged,false);assert.equal(report.candidates.length,4);
let samples=0;
for(const item of report.candidates){
  assert.equal(item.status,'complete-source-grid-extracted');
  const gridBytes=await readFile(new URL(item.gridFile,dir));assert.equal(hash(gridBytes),item.gridSha256);
  const grid=JSON.parse(gridBytes),raw=await readFile(new URL(grid.source.localFile,dir));
  assert.equal(hash(raw),grid.source.sha256);assert.equal(raw.length,grid.source.bytes);
  const labelBytes=await readFile(new URL(grid.source.labelLocalFile,dir));assert.equal(hash(labelBytes),grid.source.labelSha256);
  const label=labelBytes.toString('utf8'),number=key=>Number(label.match(new RegExp('^\\s*'+key+'\\s*=\\s*([\\d.+-]+)','m'))?.[1]);
  const cols=number('LINE_SAMPLES'),startRow=grid.source.byteRange[0]/(cols*2);
  assert.ok(Number.isInteger(startRow));assert.equal(grid.heights.length,4225);assert.equal(grid.auditOnly,true);
  const moon=grid.body==='moon',coordinates=[];
  for(let row=0;row<65;row++)for(let col=0;col<65;col++){
    // Re-derive source addressing from geolocated output points and label fields.
    const p=terrainCoordinates(grid,col/64,row/64);let sourceX,sourceY;
    if(moon){
      const rho=2*1737400*Math.tan((90+p.lat)*Math.PI/360);
      sourceX=number('SAMPLE_PROJECTION_OFFSET')+rho*Math.sin(p.lon*Math.PI/180)/number('MAP_SCALE');
      sourceY=number('LINE_PROJECTION_OFFSET')-rho*Math.cos(p.lon*Math.PI/180)/number('MAP_SCALE');
    }else{
      const east=(p.lon+360)%360;
      sourceX=(east-number('WESTERNMOST_LONGITUDE'))*number('MAP_RESOLUTION')-.5;
      sourceY=(number('MAXIMUM_LATITUDE')-p.lat)*number('MAP_RESOLUTION')-.5;
    }
    const x=Math.floor(sourceX),y=Math.floor(sourceY),u=sourceX-x,v=sourceY-y;
    const positions=[[x,y],[x+1,y],[x,y+1],[x+1,y+1]],weights=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
    const expected=positions.reduce((sum,[a,b],i)=>{
      const at=((b-startRow)*cols+a)*2;
      return sum+weights[i]*(moon?raw.readInt16LE(at)*.5:raw.readInt16BE(at));
    },0);
    assert.ok(Math.abs(expected-grid.heights[row*65+col])<=.005001,`${item.id} ${row},${col}`);
    coordinates.push(positions);samples++;
  }
  const stats=analyzeTerrain(grid);
  for(const key of ['min','max','relief','slopeMean','slopeP90'])assert.ok(Math.abs(stats[key]-item.statistics[key])<1e-9);
  if(!moon){
    const support=item.observationSupport,c=await readFile(new URL(support.source.localFile,dir));assert.equal(hash(c),support.source.sha256);
    const cl=await readFile(new URL(support.source.labelLocalFile,dir));assert.equal(hash(cl),support.source.labelSha256);
    const index=(a,b)=>(b-startRow)*cols+a,unique=new Set(coordinates.flat().map(([a,b])=>index(a,b)));
    assert.equal(unique.size,support.uniqueSourceCells);
    assert.equal([...unique].filter(i=>c[i]===0).length,support.zeroCountCells);
    assert.equal(coordinates.filter(ps=>ps.some(([a,b])=>c[index(a,b)]===0)).length,support.gridSamplesWithAnyZeroCountCorner);
    assert.equal(coordinates.filter(ps=>ps.every(([a,b])=>c[index(a,b)]===0)).length,support.gridSamplesWithAllZeroCountCorners);
  }
  console.log(`Verified ${item.id}: 4,225 heights, source/label/grid hashes, statistics and ${moon?'polar registration':'observation counts'}.`);
}
assert.equal(samples,16900);console.log(`Verified all ${samples} research samples offline. No application files changed.`);
