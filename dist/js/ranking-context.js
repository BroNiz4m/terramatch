// Explain existing rounded results without changing scores, weights or tie order.
export function describeRanking(rankings,{selectedId=null,loadedCandidateIds=rankings.map(r=>r.site.id),excludedCandidateIds=[],weights={slope:.65,relief:.35}}={}){
  const counts=new Map();
  for(const item of rankings){if(!Number.isFinite(item.score))throw new Error('A finite existing score is required for ranking context.');counts.set(item.score,(counts.get(item.score)||0)+1);}
  const first=rankings[0],points=(a,b)=>Math.round((a-b)*10)/10;
  const rows=rankings.map((item,index)=>({id:item.site.id,name:item.site.name,score:item.score,rank:rankings.filter(other=>other.score>item.score).length+1,tied:counts.get(item.score)>1,tieCount:counts.get(item.score),gapFromLeadingPoints:points(first.score,item.score),reliefAtCap:item.reliefDistance===1,displayOrder:index+1}));
  const total=weights.slope+weights.relief,reliefWeight=total>0?weights.relief/total:0;
  const topRows=first?rows.filter(row=>row.score===first.score):[],saturated=rows.filter(row=>row.reliefAtCap);
  return {scope:{kind:'loaded-candidates-only',rankedCount:rows.length,loadedCount:loadedCandidateIds.length,coverageReviewCount:excludedCandidateIds.length,rankedCandidateIds:rows.map(row=>row.id),loadedCandidateIds:[...loadedCandidateIds],excludedCandidateIds:[...excludedCandidateIds],exhaustive:false},
    display:{decimalPlaces:1,rankingBasis:'Existing scores rounded to one decimal before stable sorting.',tiePolicy:'Equal displayed scores share a competition rank. Display order within a tie is not evidence of a better match.'},
    rows,topCandidateIds:topRows.map(row=>row.id),topTie:topRows.length>1,firstSecondGapPoints:rows.length>=2?points(rows[0].score,rows[1].score):null,
    selected:rows.find(row=>row.id===selectedId)||{id:selectedId,rank:null,score:null,gapFromLeadingPoints:null,status:'unranked'},
    relief:{active:reliefWeight>0,normalizedWeight:reliefWeight,saturatedCandidateIds:saturated.map(row=>row.id),saturatedCount:saturated.length,allSaturated:rows.length>0&&saturated.length===rows.length,distanceCap:1},
    significanceAssessed:false,note:'Point gaps describe this index only. No uncertainty or statistical-significance threshold is established. These are not probabilities or validated mission recommendations.'};
}

export function rankingMessages(context){
  const {scope,rows,selected,relief}=context,top=rows[0],gap=context.firstSecondGapPoints;
  const messages={scope:`Only ${scope.rankedCount} eligible loaded Earth windows are ranked, out of ${scope.loadedCount} loaded Earth windows; ${scope.coverageReviewCount} require coverage review and have no score. This is not an exhaustive Earth search.`,
    leading:!top?'No eligible loaded candidates are ranked.':gap===null?'Only one candidate is ranked; a first–second gap is unavailable.':context.topTie?`No unique leader at displayed precision. The first two rows have a ${gap.toFixed(1)} point gap.`:`Leading displayed score: ${top.name}, ${top.score.toFixed(1)} / 100. Gap from first to second: ${gap.toFixed(1)} index points.`,
    selected:selected.rank===null?'The selected window is unranked; no rank or gap is assigned.':`Selected candidate: ${selected.name}, ${selected.tied?'shared ':''}rank ${selected.rank} of ${scope.rankedCount}; ${selected.gapFromLeadingPoints.toFixed(1)} index points below the leading displayed score.`,
    ties:rows.some(row=>row.tied)?'Equal scores at one decimal share a rank. Order within a tie does not indicate a better match.':null,
    relief:null,limits:context.note};
  if(!relief.active)messages.relief='Relief is switched off and contributes no weight to these scores.';
  else if(relief.allSaturated)messages.relief=`Relief distance reaches its cap of 1 for all ${scope.rankedCount} ranked candidates. It cannot distinguish them. ${relief.normalizedWeight===1?'With relief only, all scores are 0.0 and there is no unique leader.':'Any differences in this ranking come from slope distribution.'}`;
  else if(relief.saturatedCount)messages.relief=`Relief distance reaches its cap of 1 for ${relief.saturatedCount} of ${scope.rankedCount} ranked candidates. Larger relief mismatches beyond that cap receive the same maximum component penalty.`;
  return messages;
}

export function rankingContextReport(context){
  const messages=rankingMessages(context),cell=value=>String(value).replaceAll('|','\\|').replace(/[\r\n]+/g,' ');
  return '\n\n## Loaded ranking interpretation\n\n'+Object.values(messages).filter(Boolean).join('\n\n')+'\n\n| Shared rank | Candidate | Displayed index | Gap from leading score | Relief distance at cap |\n| --- | --- | ---: | ---: | --- |\n'+context.rows.map(row=>`| ${row.tied?'Tied ':''}${row.rank} | ${cell(row.name)} | ${row.score.toFixed(1)} | ${row.gapFromLeadingPoints.toFixed(1)} points | ${row.reliefAtCap?'Yes'+(context.relief.active?'':' (inactive)'):'No'} |`).join('\n')+'\n';
}
