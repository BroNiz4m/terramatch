import {deflateSync} from 'node:zlib';
const table=Uint32Array.from({length:256},(_,c)=>{for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([size,tag,data,crc]);}
// Generated fixtures only. They are never shipped as application measurements.
export function terrainPNG(tileX=0,tileY=0){const n=256,stride=n*3+1,raw=Buffer.alloc(stride*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const elevation=400+(tileX*256+x)*.001+(tileY*256+y)*.002,value=elevation+32768,i=y*stride+1+x*3;raw[i]=Math.floor(value/256);raw[i+1]=Math.floor(value)%256;raw[i+2]=Math.floor((value-Math.floor(value))*256);}const header=Buffer.alloc(13);header.writeUInt32BE(n,0);header.writeUInt32BE(n,4);header[8]=8;header[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
