import {loadLocationImagery,imageryRequestPlan} from './location-imagery.js';
import {escapeHTML as esc} from './icons.js';
const key=(site,data)=>JSON.stringify([site.id,site.body,site.lat,site.lon,data?.widthMeters,data?.depthMeters,data?.bounds]);
export function locationFigureHTML(site,dem,scale){return `<figure class="location-visual" data-location-imagery="${esc(site.id)}"><div class="location-visual-toolbar"><span>North up · Full study area</span><div class="segmented" aria-label="Location preview"><button type="button" data-imagery-view="imagery" aria-pressed="true">Imagery</button><button type="button" data-imagery-view="elevation" aria-pressed="false">Elevation</button></div></div><img class="terrain-preview-image" src="${esc(dem)}" alt="Elevation-derived terrain map for ${esc(site.name)}" decoding="async"><figcaption><strong data-imagery-title>Loading imagery · elevation shown</strong><span data-imagery-detail>${esc(scale)} · Regional data; fine features unresolved</span><span data-imagery-credit hidden></span><span data-imagery-status role="status" aria-live="polite"></span><a data-imagery-source hidden target="_blank" rel="noopener noreferrer">Imagery source &amp; coverage ↗</a><button class="text-link" data-imagery-retry hidden>Retry imagery</button></figcaption></figure>`;}
export function createLocationImageryUI({getSite,getData,load=loadLocationImagery}={}){
 const cache=new Map(),records=new Map(),fallbacks=new WeakMap();let controller=null;
 function mount(root){
  controller?.abort();for(const [k,record]of records)if(record.status==='loading')records.set(k,{...record,status:'cancelled',reason:'The selected view changed before imagery finished.'});controller=new AbortController();const signal=controller.signal;
  for(const figure of root.querySelectorAll('[data-location-imagery]')){
   const site=getSite(figure.dataset.locationImagery),data=site&&getData(site.id);if(!site||!data)continue;
   const img=figure.querySelector('img');if(!fallbacks.has(figure))fallbacks.set(figure,img.src);
   const dem=fallbacks.get(figure),title=figure.querySelector('[data-imagery-title]'),detail=figure.querySelector('[data-imagery-detail]'),credit=figure.querySelector('[data-imagery-credit]'),status=figure.querySelector('[data-imagery-status]'),retry=figure.querySelector('[data-imagery-retry]');
   const demDetail=detail.textContent,k=key(site,data);let mode='imagery',result=cache.get(k)||null,failed=null,pending=false;
   if(result){cache.delete(k);cache.set(k,result);}
   function render(){
    if(signal.aborted||!figure.isConnected)return;
    figure.querySelectorAll('[data-imagery-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.imageryView===mode)));
    const actual=mode==='imagery'&&result;img.src=actual?result.url:dem;img.alt=actual?`Observed ${site.body==='earth'?'satellite':'orbital'} imagery for ${site.name}`:`Elevation-derived terrain map for ${site.name}`;
    title.textContent=actual?(site.body==='earth'?'Satellite imagery':'Orbital imagery'):mode==='elevation'?'Elevation map · shaded relief':failed?'Imagery unavailable · elevation shown':'Loading imagery · elevation shown';
    detail.textContent=actual?`${data.widthMeters/1000} × ${data.depthMeters/1000} km · ${result.metadata.period}`:demDetail;
    credit.hidden=!actual;credit.textContent=actual?result.metadata.credit:'';
    status.textContent=mode==='imagery'?(failed||(!result?'Reading imagery for these coordinates…':'')):'';
    retry.hidden=!(mode==='imagery'&&failed&&!pending);
    const link=figure.querySelector('[data-imagery-source]');link.hidden=!actual;if(actual)link.href=result.metadata.sourceURL;
   }
   async function retrieve(){
    if(pending||result)return;pending=true;failed=null;records.set(k,{siteId:site.id,status:'loading'});render();
    try{imageryRequestPlan(site,data);const loaded=await load(site,data,{signal});if(signal.aborted)return;
     result={url:URL.createObjectURL(loaded.blob),metadata:loaded.metadata};cache.set(k,result);records.set(k,{siteId:site.id,status:'available',...loaded.metadata});
     while(cache.size>12){const oldest=cache.keys().next().value;URL.revokeObjectURL(cache.get(oldest).url);cache.delete(oldest);records.delete(oldest);}
    }catch(error){if(signal.aborted)return;failed=error.name==='AbortError'?'The imagery request timed out. Retry or inspect the elevation map.':error.message||'Imagery is unavailable. Elevation is shown instead.';records.set(k,{siteId:site.id,status:'unavailable',reason:failed});}
    finally{pending=false;render();}
   }
   figure.querySelectorAll('[data-imagery-view]').forEach(button=>button.onclick=()=>{mode=button.dataset.imageryView;render();if(mode==='imagery')void retrieve();});retry.onclick=()=>void retrieve();render();if(!result)void retrieve();
  }
 }
 return{mount,snapshot:sites=>sites.map(site=>records.get(key(site,getData(site.id)))||{siteId:site.id,status:'not-requested'}),dispose(){controller?.abort();for(const entry of cache.values())URL.revokeObjectURL(entry.url);cache.clear();records.clear();}};
}
