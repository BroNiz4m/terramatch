/** Fetch unchanged, keyless NASA source records, then derive explicitly dated context. */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildEarthEnvironmentURL,parseEarthEnvironment,buildEarthEventsURL,parseEarthEvents} from '../dist/js/environment-data.js';
const output=new URL('../dist/data/',import.meta.url);
const sites=[{id:'wadi-rum',lat:29.575,lon:35.419},{id:'al-wahbah',lat:22.9,lon:41.138},{id:'amboy',lat:34.557,lon:-115.78},{id:'lanzarote',lat:28.995,lon:-13.74}];
const hash=text=>createHash('sha256').update(text).digest('hex');
async function get(url){const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);const text=await response.text();return{text,data:JSON.parse(text),retrievedAt:new Date().toISOString(),sha256:hash(text),cors:response.headers.get('access-control-allow-origin')};}
await mkdir(output,{recursive:true});
for(const site of sites){const url=buildEarthEnvironmentURL(site),raw=await get(url),record=parseEarthEnvironment(raw.data,site,{requestUrl:url,retrievedAt:raw.retrievedAt,rawResponseSHA256:raw.sha256,retrievalMode:'bundled'});if(!['ready','partial'].includes(record.status))throw Error(`${site.id}: ${record.status}`);record.source.rawFile=`earth-environment-${site.id}-raw.json`;record.source.verifiedCORS=raw.cors;await writeFile(new URL(record.source.rawFile,output),raw.text);await writeFile(new URL(`earth-environment-${site.id}.json`,output),JSON.stringify(record,null,2)+'\n');console.log(site.id,record.status,record.summary.coverage);}
// The event snapshot is deliberately separate from the historical 2025 meteorology.
const query={days:30,limit:100,status:'open',category:'severeStorms'},url=buildEarthEventsURL(query),raw=await get(url),record=parseEarthEvents(raw.data,{...query,requestUrl:url,retrievedAt:raw.retrievedAt,rawResponseSHA256:raw.sha256,retrievalMode:'bundled-reference'});
record.source.rawFile='earth-events-reference-raw.json';record.source.verifiedCORS=raw.cors;record.limitations.unshift('Bundled event catalogue snapshot. Use its retrieval timestamp and individual event dates; it is not the current catalogue.');await writeFile(new URL(record.source.rawFile,output),raw.text);await writeFile(new URL('earth-events-reference.json',output),JSON.stringify(record,null,2)+'\n');console.log('EONET snapshot',record.status,record.events.length,record.retrievedAt,fileURLToPath(output));
