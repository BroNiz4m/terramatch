const NAME='terramatch-numeric-elevation-v1',MAX_ITEMS=6;
export async function readElevationCache(url,storage=globalThis.caches){
 try{if(!storage)return null;const response=await(await storage.open(NAME)).match(url);if(!response)return null;const bytes=await response.arrayBuffer();if(bytes.byteLength>12000000)return null;return {bytes,retrievedAt:response.headers.get('X-TerraMatch-Retrieved'),sha256:response.headers.get('X-TerraMatch-SHA256')};}catch{return null;}
}
export async function writeElevationCache(url,bytes,metadata,storage=globalThis.caches){
 try{if(!storage)return;const cache=await storage.open(NAME);await cache.put(url,new Response(bytes.slice(0),{headers:{'Content-Type':'image/tiff','X-TerraMatch-Retrieved':metadata.retrievedAt,'X-TerraMatch-SHA256':metadata.sha256||''}}));const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-MAX_ITEMS)))await cache.delete(key);}catch{/* Storage denial/quota must not prevent use of a valid DEM. */}
}
export async function deleteElevationCache(url,storage=globalThis.caches){try{if(storage)await(await storage.open(NAME)).delete(url);}catch{}}
