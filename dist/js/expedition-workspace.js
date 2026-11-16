import {escapeHTML as esc} from './icons.js';

export function thermalViewAvailable(record){return record?.body==='earth'?!!record.summary?.validCount:!!(record?.available&&record.raster);}

/** Layout controls delegate to the existing expedition and scientific data modules. */
export function createExpeditionWorkspace(options){
 const $=s=>document.querySelector(s),view=$('#expedition-view'),details=$('#expedition-details'),layer=$('#expedition-layer');
 let activePanel=null,request=0,lastTrigger=null;
 function focusScene(){options.getExpedition()?.renderer?.domElement.focus({preventScroll:true});}
 function closeDetails({focus=true}={}){activePanel=null;details.classList.add('hidden');view.classList.remove('details-open');$('#expedition-layer-info').setAttribute('aria-expanded','false');$('#expedition-controls').setAttribute('aria-expanded','false');$('#expedition-notes').setAttribute('aria-expanded','false');if(focus)lastTrigger?.focus?.();options.getExpedition()?.resize();}
 function describeLayer(){
  const exp=options.getExpedition(),record=options.thermal.records.get(exp?.site?.id),name=exp?.layer||'surface';
  const copy={surface:exp?.site?.body==='moon'?'LRO orbital imagery follows this study area’s coordinates and DEM projection when coverage is available. Image contrast is adjusted for display. Fine regolith, rock shapes/positions and sunlight are illustrations; they do not classify geology or change the DEM. Original image shadows are retained, so lighting is not a photometric reconstruction.':exp?.site?.body==='mars'?'MRO CTX monochrome imagery follows this study area’s exact coordinates. Contrast is adjusted for display. The warm-grey tint, fine regolith, rocks and sunlight are illustrations, not measured soil colours, composition or dune classification. Terrain heights come from the DEM.':'Terrain heights come from the selected elevation dataset. Surface colours, textures and scattered rocks are illustrations, not mapped materials.',slope:'Regional slope is calculated from the elevation grid. It describes kilometre-scale terrain, not individual rocks or wheel contact.',elevation:'Colours show relative height within this study area. Heights retain their source datum; absolute elevations across planets are not directly compared.',temperature:'Temperature retains the source product’s own footprint, date and statistic. It is independent of the terrain similarity index.'};
  $('#expedition-layer-description').textContent=copy[name]||copy.surface;
  const notice=$('#expedition-thermal-availability');notice.hidden=thermalViewAvailable(record);
  notice.textContent=record?(record.reason||record.error?.message||(record.body==='mars'&&record.available?'Local rover thermal observations are available in Compare. They do not map this terrain area.':'No usable temperature field is available for this location.')):'Temperature availability is checked when you select Temperature. No temperature values are inferred from terrain colours.';
 }
 function openDetails(panel,trigger){
  if(options.isEvidenceOpen())options.closeEvidence();activePanel=panel;
  const origin=trigger||document.activeElement;if(!details.contains(origin))lastTrigger=origin;
  details.classList.remove('hidden');view.classList.add('details-open');
  for(const node of details.querySelectorAll('[data-expedition-section]'))node.hidden=node.dataset.expeditionSection!==panel;
  for(const button of details.querySelectorAll('[data-expedition-tab]'))button.setAttribute('aria-pressed',String(button.dataset.expeditionTab===panel));
  $('#expedition-layer-info').setAttribute('aria-expanded',String(panel==='layer'));$('#expedition-controls').setAttribute('aria-expanded',String(panel==='controls'));$('#expedition-notes').setAttribute('aria-expanded',String(panel==='data'));
  describeLayer();const exp=options.getExpedition();exp?.keys?.clear();exp?.resize();$('#expedition-details-close').focus();
 }
 async function chooseLayer(value){
  const exp=options.getExpedition();if(!exp?.site){layer.value='surface';return;}
  const id=++request,siteId=exp.site.id;
  if(value==='temperature'){
   layer.disabled=true;$('#expedition-layer-state').textContent='Checking temperature data…';
   try{
    const record=await options.thermal.load(exp.site);if(id!==request||siteId!==exp.site.id||view.classList.contains('hidden'))return;
    if(!thermalViewAvailable(record)){layer.value=exp.layer;openDetails('layer',layer);return;}
    await options.thermal.activateLayer();if(id!==request||siteId!==exp.site.id||view.classList.contains('hidden'))return;
   }finally{if(id===request){layer.disabled=false;$('#expedition-layer-state').textContent='';}}
  }else options.selectLayer(value);
  if(id!==request)return;layer.value=exp.layer;describeLayer();
  for(const button of view.querySelectorAll('[data-layer]'))button.classList.toggle('active',button.dataset.layer===exp.layer);
  $('#terrain-legend').classList.toggle('hidden',['surface','temperature'].includes(exp.layer));
  // Temperature controls and its source/date legend are on demand in the same drawer.
  if(value==='temperature')openDetails('layer',layer);
  else{if(activePanel==='layer')describeLayer();focusScene();}
 }
 layer.onchange=()=>void chooseLayer(layer.value);
 $('#expedition-layer-info').onclick=()=>activePanel==='layer'?closeDetails():openDetails('layer',$('#expedition-layer-info'));
 $('#expedition-controls').onclick=()=>activePanel==='controls'?closeDetails():openDetails('controls',$('#expedition-controls'));
 $('#expedition-notes').onclick=()=>activePanel==='data'?closeDetails():openDetails('data',$('#expedition-notes'));
 $('#expedition-details-close').onclick=()=>closeDetails();
 details.querySelectorAll('[data-expedition-tab]').forEach(button=>button.onclick=()=>openDetails(button.dataset.expeditionTab,button));
 $('#expedition-thermal-records').onclick=options.thermalCompare;$('#expedition-provenance').onclick=()=>{const site=options.getExpedition()?.site;if(site)options.provenance(site);};
 $('#expedition-map-toggle').onclick=()=>{const map=$('.expedition-minimap-slot'),obscured=!!activePanel||options.isEvidenceOpen(),visible=obscured||map.classList.contains('hidden');if(obscured){closeDetails({focus:false});if(options.isEvidenceOpen())options.closeEvidence();}map.classList.toggle('hidden',!visible);$('#expedition-map-toggle').setAttribute('aria-pressed',String(visible));};
 $('#expedition-pause').onclick=()=>options.pause(true);$('#expedition-exit').onclick=()=>{options.getExpedition()?.keys?.clear();closeDetails({focus:false});options.exit();};
 $('#camera-mode').onchange=()=>{const exp=options.getExpedition();if(!exp)return;if(exp.follow!==($('#camera-mode').value==='follow'))exp.changeCamera();focusScene();};
 // Escape closes the requested panel first. Reading help must not drive the rover behind it.
 window.addEventListener('keydown',event=>{if(view.classList.contains('hidden')||!activePanel||document.querySelector('.modal-backdrop')||!$('#pause-overlay').classList.contains('hidden'))return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeDetails();return;}if(details.contains(document.activeElement)&&/^(w|a|s|d|shift|arrowup|arrowdown|arrowleft|arrowright)$/i.test(event.key))event.stopImmediatePropagation();},true);
 function reset(site,data,stats){
  ++request;layer.disabled=false;layer.value='surface';$('#expedition-layer-state').textContent='';closeDetails({focus:false});$('#expedition-surface-record')?.remove();
  $('#expedition-coordinates').textContent=`${Math.abs(site.lat).toFixed(3)}°${site.lat<0?'S':'N'}, ${Math.abs(site.lon).toFixed(3)}°${site.lon<0?'W':'E'}`;
  $('#expedition-title').textContent=site.id.startsWith('survey-')?({moon:'Lunar area',mars:'Martian area',earth:'Earth area'}[site.body]):site.name;$('#expedition-title').title=site.name;
  $('#expedition-body').textContent=site.country;$('#expedition-world-icon').src='assets/official-'+site.body+'.jpg';$('#expedition-world-icon').alt=site.country;
  $('#camera-mode').value=options.getExpedition()?.follow===false?'survey':'follow';
  $('.expedition-minimap-slot').classList.remove('hidden');$('#expedition-map-toggle').setAttribute('aria-pressed','true');$('.minimap').classList.remove('expanded');$('#expand-map').setAttribute('aria-expanded','false');
  $('#expedition-visual-description').innerHTML=(site.body==='moon'?'<p>Terrain geometry uses the selected elevation grid. LRO image coverage is recorded below. Fine regolith, rocks, vehicles and landing effects are illustrative.</p>':site.body==='mars'?'<p>Terrain geometry uses the selected elevation grid. MRO CTX monochrome imagery coverage is recorded below. Colour tint, fine regolith, rocks, vehicles and landing effects are illustrative.</p>':'<p>Terrain geometry uses the selected source elevation grid. The surface texture, rocks, rover, cargo lander and landing effects are illustrative.</p>')+'<p>The explorer is enlarged for navigation. Vehicle motion, wheel articulation and lighting are not validated engineering or environmental simulations.</p><p><strong>Analysis:</strong> '+esc(data.gridSpacingMeters)+' m grid · '+esc(stats.gradientBaselineMeters.x/1000)+' km slope baseline · '+esc(data.widthMeters/1000)+' × '+esc(data.depthMeters/1000)+' km area.</p>';
  $('#expedition-data-source').textContent=data.source?.title||data.source?.product||data.source?.agency||({moon:'NASA LOLA',mars:'NASA MOLA',earth:'Mapzen / Tilezen elevation tiles'}[site.body]);
  $('#surface-material-note').textContent='Surface: illustration · Heights: DEM';surface(options.getExpedition()?.surfaceRecord);describeLayer();
 }
 function surface(record){
  const exp=options.getExpedition();if(!record||record.siteId!==exp?.site?.id)return;
  const sourceName=exp.site.body==='mars'?'CTX':'LRO';
  $('#surface-material-note').textContent=record.status==='available'?sourceName+' imagery · '+(exp.site.body==='mars'?'Tint/detail':'Detail & lighting')+': illustration':record.status==='loading'?'Loading '+sourceName+' imagery · Detail: illustration':sourceName+' unavailable · Detail: illustration';
  let section=$('#expedition-surface-record');
  if(!section){section=document.createElement('div');section.id='expedition-surface-record';$('#expedition-visual-description').after(section);}
  section.innerHTML=record.status==='available'?`<h3>Location-specific surface image</h3><p>${esc(record.product)} · ${esc(record.period)}</p><p>${esc(record.credit)}</p><p>${esc(record.resolution||'Source resolution varies.')} · contrast adjusted for display.</p>${record.colourCaveat?`<p>${esc(record.colourCaveat)}</p>`:''}${record.deliveryFallback?.length?`<p>The imagery service required a lower display grid for the same footprint. Preview sampling: ${esc(Math.round(record.previewSamplingMeters||0))} m/px; no extra source detail is implied.</p>`:''}<p>Microdetail and decorative rocks are illustrative. Sunlight is chosen for readability; no present-day or permanent-shadow calculation is implied.</p><a class="text-link" href="${esc(record.sourceURL)}" target="_blank" rel="noopener noreferrer">Open ${esc(sourceName)} imagery source ↗</a>`:`<h3>Surface image availability</h3><p>${esc(record.reason||record.note||'Reading '+sourceName+' imagery for these coordinates.')}</p>`;
  describeLayer();
 }
 function stage(phase){view.dataset.expeditionPhase=phase;$('#touch-controls').classList.toggle('hidden',phase!=='explore'||!view.classList.contains('touch-mode'));}
 return{reset,stage,closeDetails,chooseLayer,openDetails,surface,get activePanel(){return activePanel;}};
}
