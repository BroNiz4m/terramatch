import {escapeHTML as esc,icon} from './icons.js';

/** Reuse the live search and comparison controls; never duplicate their state or terrain. */
export function createManualWorkspace(options){
 const $=selector=>document.querySelector(selector),view=$('#explore-view'),manual=$('#manual-search-panel');
 const mission=$('.mission-panel'),workspace=$('.explore-workspace'),header=$('.globe-header');
 const heading=$('.page-heading h1'),subtitle=$('.page-subtitle'),originalHeading=heading.innerHTML,originalSubtitle=subtitle.textContent;
 const discoveryTitle=$('.discovery-title'),originalTitle=discoveryTitle.innerHTML;
 const targetToggle=$('.destination-toggle'),targetSelect=$('#target-select'),taskSelect=$('#task-select');
 const brief=$('#task-brief'),thermal=$('#thermal-mission-prompt'),metricLabels=[$('#metric-slope').closest('label'),$('#metric-relief').closest('label')];
 const rank=$('#find-analogs'),method=$('#method-link');
 const steps=document.createElement('div');steps.className='manual-steps';manual.prepend(steps);
 const earthStep=document.createElement('section');earthStep.className='manual-earth-step';earthStep.setAttribute('aria-labelledby','manual-earth-heading');
 earthStep.innerHTML='<h2 id="manual-earth-heading"><span class="manual-step-number">2</span> Find a place on Earth</h2>';
 // Retain existing form listeners and result IDs, including the actual asynchronous tile loader.
 for(const node of [...manual.children])if(node!==steps)earthStep.append(node);
 mission.replaceChildren();mission.setAttribute('aria-label','Choose the planetary area');
 mission.innerHTML='<h2><span class="manual-step-number">1</span> Choose the planetary area</h2>';
 mission.append(targetToggle);
 const targetLabel=document.createElement('label');targetLabel.className='field-label';targetLabel.htmlFor='target-select';targetLabel.textContent='Planetary area';
 const targetNote=document.createElement('p');targetNote.className='manual-target-note';targetNote.id='manual-target-note';targetNote.setAttribute('aria-live','polite');
 mission.append(targetLabel,targetSelect,targetNote);steps.append(mission,earthStep);
 const settings=document.createElement('details');settings.className='manual-disclosure manual-settings';settings.id='manual-settings';
 settings.innerHTML='<summary>Comparison settings <span id="manual-measures-summary">Slope patterns + elevation range</span></summary><div class="manual-settings-body"><div class="manual-profile"></div><fieldset><legend>Terrain measures</legend></fieldset><p class="manual-settings-note">Profiles change the terrain weights only. Thermal records are reviewed separately in Compare; materials are not scored.</p></div>';
 const profileLabel=document.createElement('label');profileLabel.htmlFor='task-select';profileLabel.textContent='Weight profile';settings.querySelector('.manual-profile').append(profileLabel,taskSelect,brief);
 settings.querySelector('fieldset').append(...metricLabels);
 rank.innerHTML='Apply comparison settings';settings.querySelector('.manual-settings-body').append(rank,method,thermal);manual.append(settings);
 const saved=document.createElement('details');saved.className='manual-disclosure manual-saved';saved.id='manual-saved-areas';
 saved.innerHTML='<summary>Saved &amp; reference areas <span>Optional</span></summary><p class="manual-saved-help">Choose an already loaded Earth area instead of running a new search. Selecting an area compares it with the planetary area chosen above.</p>';
 const tray=$('.candidate-tray');saved.append(tray);$('.globe-panel').append(saved);
 const mapOptions=document.createElement('details');mapOptions.className='manual-disclosure manual-map-options';mapOptions.id='manual-map-options';mapOptions.innerHTML='<summary>Map options</summary><div class="manual-map-options-body"></div>';$('.globe-panel').append(mapOptions);
 const top=$('.globe-top'),controls=$('.globe-data-controls'),layers=$('.globe-layer-buttons'),actions=$('.globe-header-actions'),expand=$('#globe-expand');
 const mapBar=document.createElement('div');mapBar.className='manual-map-bar';mapBar.innerHTML='<h2 id="manual-map-title">Your selected Earth location</h2><div class="manual-map-actions"></div>';header.append(mapBar);
 const panel=document.createElement('aside');panel.id='manual-comparison';panel.className='panel manual-comparison';panel.setAttribute('aria-label','Your manual comparison');workspace.append(panel);
 const form=$('#manual-search-form');$('#place-search-button').textContent='Find place';$('#place-query').placeholder='Place name or latitude, longitude';
 $('#manual-help').innerHTML='Enter a name or decimal coordinates. Each analysis covers a 32 × 32 km area.';
 let mode='automatic';
 function refresh(){
  if(mode!=='manual')return;
  const c=options.context(),search=c.search,phase=search?.manualPhase||'idle';
  if(search?.mode!=='manual')return;
  const pending=['editing','finding','selected','loading','error'].includes(phase);
  const ready=!!c.chosen&&!pending&&!!c.targetData&&!!c.earthData;
  const searched=site=>Boolean(site.origin||site.id.startsWith('survey-'));
  targetNote.textContent=`${c.target.country} · ${searched(c.target)?'Loaded search area':'Reference area'} · 32 × 32 km`;
  const slope=c.weights.slope>0,relief=c.weights.relief>0;
  $('#manual-measures-summary').textContent=slope&&relief?'Slope patterns + elevation range':slope?'Slope patterns':relief?'Elevation range':'Choose at least one measure';
  const targetOptions=[...targetSelect.options];for(const option of targetOptions){const site=c.targets.find(s=>s.id===option.value);if(site)option.textContent=site.name+(searched(site)?' · Search area':' · Reference');}
  const mapBody=c.globeBody==='earth'?'Earth':c.globeBody==='moon'?'Moon':'Mars';$('#manual-map-title').textContent=`Your selected ${mapBody} location`;
  const row=(site,label)=>`<div class="manual-location-row"><img src="${options.thumbnail(site)}" alt="${esc(site.name)} elevation shaded relief"><div><span class="manual-body-tag ${site.body==='earth'?'earth':'planet'}">${label}</span><h3>${esc(site.name)}</h3><p>${esc(site.body==='earth'?site.country:searched(site)?'Loaded search area':'Reference area')}</p><small>${esc(c.coordinates(site))}</small></div></div>`;
  const stateText=phase==='finding'?'Finding a place…':phase==='loading'?'Reading elevation data…':phase==='selected'?(search?.selected?'Analyze your selected location':'Choose a search result'):phase==='error'?'Search needs attention':'Choose an Earth location';
  panel.innerHTML='<div class="panel-title"><h2>Your comparison</h2><span class="status-pill">'+(ready?(c.eligible?'TERRAIN READY':'REVIEW COVERAGE'):'SETUP')+'</span></div>'+
   (ready?row(c.earth,'EARTH')+'<span class="manual-pair-arrow" aria-hidden="true">↓</span>':`<div class="manual-empty">${icon('pin')}<h3>${stateText}</h3><p>${phase==='error'?'Read the search message above. Choose another location or retry; no substitute terrain is used.':search?.selected?esc(search.selected.name)+' · '+esc(search.selected.country)+'. Use Analyze this area to load its terrain.':'Search by place name or coordinates, pick a point on Earth, or choose a saved area below the globe.'}</p></div>`)+
   row(c.target,c.target.body.toUpperCase())+'<section class="manual-compare-measures"><h3>What will be compared?</h3><ul>'+(slope?'<li>'+icon('terrain')+'Slope patterns</li>':'')+(relief?'<li>'+icon('source')+'Elevation range</li>':'')+'</ul><p>'+(!slope&&!relief?'Enable a terrain measure in Comparison settings.':ready?'Both areas: '+c.spacing.toLocaleString('en-US')+' m analysis grid · '+c.spacing*2/1000+' km slope baseline.':'Both areas will use the same analysis scale.')+'</p></section>'+
   (ready&&!c.eligible?'<p class="manual-coverage-note">Land coverage needs review. Open the evidence to inspect it; the terrain score is withheld.</p>':'')+
   '<div class="manual-comparison-actions"><button class="button button-primary" id="manual-compare-pair" '+(!ready?'disabled':'')+'>'+(ready&&!c.eligible?'Review pair evidence':'Compare this pair')+'</button><button class="button button-outline" id="manual-explore-target" '+(!c.targetData?'disabled':'')+'>'+icon('terrain')+'Explore target in 3D</button></div><p class="manual-limitation">Candidate terrain analog. Geological suitability needs further evidence.</p><button class="text-link" id="manual-sources">Data sources &amp; coverage ↗</button>';
  $('#manual-compare-pair').onclick=options.compare;$('#manual-explore-target').onclick=()=>options.explore(c.target);$('#manual-sources').onclick=options.sources;
  options.onPins?.(ready?c.earth:null,search?.selected,pending);
 }
 function setMode(value){
  mode=value;const enabled=value==='manual';view.classList.toggle('manual-search-mode',enabled);panel.hidden=!enabled;saved.hidden=!enabled;mapOptions.hidden=!enabled;mapBar.hidden=!enabled;
  heading.innerHTML=enabled?'Compare a place on Earth<span>.</span>':originalHeading;subtitle.textContent=enabled?'Choose a lunar or Martian area, then investigate an Earth location.':originalSubtitle;
  discoveryTitle.innerHTML=enabled?icon('search')+'<span>Manual comparison</span>':originalTitle;
  if(enabled){mapOptions.querySelector('.manual-map-options-body').append(top,controls);mapBar.querySelector('.manual-map-actions').append(layers,expand);}
  else{header.prepend(top,controls);controls.prepend(layers);actions.append(expand);}
  refresh();requestAnimationFrame(()=>options.resize?.());
 }
 // Saved cards retain their original callbacks. Clear pending manual searches before selecting one.
 tray.addEventListener('click',event=>{if(event.target.closest('[data-candidate]')){options.clearSelection?.();refresh();}});
 form.addEventListener('input',()=>{if(searchDirty())options.invalidate?.();});
 function searchDirty(){return options.context().search?.manualPhase==='ready';}
 for(const label of metricLabels)label.querySelector('input').addEventListener('change',()=>rank.click());
 setMode(options.mode||'automatic');return{refresh,setMode};
}
