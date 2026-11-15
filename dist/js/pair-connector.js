/** A selected comparison relationship, anchored to the actual visible globe point. */
export function createPairConnector({stage,peeks,getPair,projectSite,isEnabled=()=>true}){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.classList.add('pair-connector');svg.setAttribute('role','img');svg.setAttribute('aria-label','Selected terrain comparison');svg.setAttribute('hidden','');
 svg.innerHTML='<path class="pair-connector-outline"/><path class="pair-connector-line"/><circle class="pair-connector-start" r="7"/><circle class="pair-connector-end" r="5"/><text class="pair-connector-label">Terrain match</text>';
 stage.append(svg);
 function hide(){svg.setAttribute('hidden','');svg.setAttribute('aria-hidden','true');}
 function update(){
  const pair=getPair();
  peeks.querySelectorAll('[data-pair-body]').forEach(button=>{const selected=isEnabled()&&button.dataset.pairBody===pair?.target.site.body;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
  if(!pair||!isEnabled()){hide();return;}
  const point=projectSite?.(pair.earth.site),preview=peeks.querySelector('[data-pair-body="'+pair.target.site.body+'"] img');
  if(!point?.visible||point.body!=='earth'||!preview){hide();return;}
  const box=stage.getBoundingClientRect(),target=preview.getBoundingClientRect();
  if(!box.width||!box.height||!target.width||!target.height){hide();return;}
  const x=point.clientX-box.left,y=point.clientY-box.top,tx=target.left-box.left+target.width*.12,ty=target.top-box.top+target.height*.5;
  if(![x,y,tx,ty].every(Number.isFinite)||x<0||y<0||x>box.width||y>box.height){hide();return;}
  svg.setAttribute('viewBox','0 0 '+box.width+' '+box.height);
  // This curve is UI linkage, not a trajectory, distance or spatial alignment.
  const bend=Math.min(120,Math.abs(tx-x)*.35),path='M '+x+' '+y+' C '+(x+bend)+' '+y+', '+(tx-bend)+' '+ty+', '+tx+' '+ty;
  svg.querySelectorAll('path').forEach(p=>p.setAttribute('d',path));
  const start=svg.querySelector('.pair-connector-start'),end=svg.querySelector('.pair-connector-end');
  start.setAttribute('cx',x);start.setAttribute('cy',y);end.setAttribute('cx',tx);end.setAttribute('cy',ty);
  const label=svg.querySelector('text');label.setAttribute('x',(x+tx)/2);label.setAttribute('y',(y+ty)/2-12);
  svg.dataset.pairId=pair.id;svg.dataset.targetBody=pair.target.site.body;
  svg.setAttribute('aria-label',pair.earth.site.name+' linked to '+pair.target.site.country+' terrain area. Terrain comparison, not a travel route.');
  svg.setAttribute('aria-hidden','false');svg.removeAttribute('hidden');
 }
 return{svg,update,hide};
}
