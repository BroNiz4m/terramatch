/** User-facing distances retain the selected dataset's sampling scale. */
export function formatDistanceMeters(value){
  if(!Number.isFinite(value)||value<=0)return 'Unavailable';
  const km=value>=1000,number=new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(km?value/1000:value);
  return number+(km?' km':' m');
}
export function samplingLabels(info={}){
  return {grid:formatDistanceMeters(info.gridSpacingMeters),baseline:formatDistanceMeters(info.baselineMeters)};
}
export function sourceUsageLabel(id,inUse){
  if(['copernicus','csa','jaxa','esa-catalogue'].includes(id))return 'CHALLENGE RESOURCE · NOT USED IN THIS RELEASE';
  if(['earthdata','worldview'].includes(id))return 'DATA DISCOVERY / BROWSE RESOURCE';
  return inUse.has(id)?'ANALYSIS DATA / DOCUMENTATION':'REFERENCE / CONTEXT';
}
