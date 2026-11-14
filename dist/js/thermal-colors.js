// Fixed, shared absolute scale. Grey is missing data, never a cold temperature.
export const THERMAL_SCALE_K=Object.freeze([40,400]);
const stops=[[.145,.227,.569],[.271,.784,.816],[.894,.863,.506],[.863,.357,.196]];
export function thermalColor(valueK){
  if(!Number.isFinite(valueK))return [.28,.32,.35];
  const t=Math.max(0,Math.min(1,(valueK-40)/360))*3,index=Math.min(2,Math.floor(t)),fraction=t-index;
  return stops[index].map((v,i)=>v+(stops[index+1][i]-v)*fraction);
}
