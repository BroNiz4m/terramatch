/** Elevation-derived previews. Rendering adds pixels, never source observations. */
export function createTerrainPreviewRaster(data,{width=256,body=data?.body}={}){
  const n=data?.size,heights=data?.heights;
  if(!Number.isInteger(n)||n<3||heights?.length!==n*n||!heights.every(Number.isFinite)||!(data.widthMeters>0)||!(data.depthMeters>0))throw Error('A complete source terrain grid is required for a preview.');
  if(!Number.isInteger(width)||width<32||width>2048)throw Error('Preview width must be between 32 and 2048 pixels.');
  const height=Math.max(32,Math.min(2048,Math.round(width*data.depthMeters/data.widthMeters)));
  const dx=data.widthMeters/(n-1),dy=data.depthMeters/(n-1),shades=new Float32Array(n*n),eastSlopes=new Float32Array(n*n),southSlopes=new Float32Array(n*n);
  let min=Infinity,max=-Infinity;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,value=heights[i];min=Math.min(min,value);max=Math.max(max,value);
    const west=Math.max(0,x-1),east=Math.min(n-1,x+1),north=Math.max(0,y-1),south=Math.min(n-1,y+1);
    const de=(heights[y*n+east]-heights[y*n+west])/((east-west)*dx),ds=(heights[south*n+x]-heights[north*n+x])/((south-north)*dy);
    eastSlopes[i]=de;southSlopes[i]=ds;
    // Northwest light at 45 degrees; slopes use physical metre spacing, at 1x relief.
    const light=Math.max(0,(.5*de+.5*ds+Math.SQRT1_2)/Math.hypot(de,ds,1));
    shades[i]=.4+.6*light;
  }
  const sample=(values,x,y)=>{
    const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(n-1,x0+1),y1=Math.min(n-1,y0+1),u=x-x0,v=y-y0;
    return (values[y0*n+x0]*(1-u)+values[y0*n+x1]*u)*(1-v)+(values[y1*n+x0]*(1-u)+values[y1*n+x1]*u)*v;
  };
  const palettes={moon:[[70,79,88],[213,219,224]],mars:[[112,64,43],[237,192,142]],earth:[[86,83,63],[224,207,165]]};
  const [low,high]=palettes[body]||palettes.earth,pixels=new Uint8ClampedArray(width*height*4);
  const targetStep=(max-min)/8,power=10**Math.floor(Math.log10(targetStep||1)),ratio=targetStep/power;
  const contourIntervalMeters=max-min>=10?Math.max(5,(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*power):null;
  for(let row=0;row<height;row++)for(let col=0;col<width;col++){
    const x=col/(width-1)*(n-1),y=row/(height-1)*(n-1),value=sample(heights,x,y),level=max>min?(value-min)/(max-min):.5,shade=sample(shades,x,y),i=(row*width+col)*4;
    for(let channel=0;channel<3;channel++)pixels[i+channel]=(low[channel]+(high[channel]-low[channel])*level)*shade;
    if(contourIntervalMeters){
      const contour=Math.round(value/contourIntervalMeters)*contourIntervalMeters;
      const perPixel=Math.hypot(sample(eastSlopes,x,y)*data.widthMeters/(width-1),sample(southSlopes,x,y)*data.depthMeters/(height-1));
      const halfWidth=perPixel*.65*Math.max(1,width/360);
      if(contour>min&&contour<max&&Math.abs(value-contour)<halfWidth)for(let channel=0;channel<3;channel++)pixels[i+channel]=pixels[i+channel]*.45+[22,42,54][channel]*.55;
    }
    pixels[i+3]=255;
  }
  return {width,height,pixels,min,max,sourceSize:n,gridSpacingMeters:data.widthMeters/(n-1),contourIntervalMeters,method:'Full study area; bilinear elevation tint, physical-slope hillshade and interpolated display contours where relief permits. Colors scaled independently within each area. No added terrain observations.'};
}
