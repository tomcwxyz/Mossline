/** Choose enough backing pixels for smooth point sprites and vector labels,
 * without allocating unbounded mobile GPU framebuffers. Dimensions and all
 * world/camera coordinates remain in CSS pixels.
 */
export function canvasPixelRatio(width:number,height:number,
 devicePixelRatio:number,maxPixels=4_200_000):number{
 const w=Math.max(1,Number.isFinite(width)?width:1);
 const h=Math.max(1,Number.isFinite(height)?height:1);
 const dpr=Number.isFinite(devicePixelRatio)&&devicePixelRatio>0?devicePixelRatio:1;
 const budget=Number.isFinite(maxPixels)&&maxPixels>0?maxPixels:4_200_000;
 const desired=Math.min(2.5,Math.max(1.5,dpr));
 const budgetRatio=Math.sqrt(budget/(w*h));
 return Math.max(1,Math.min(desired,budgetRatio));
}
/** Physical GPU point sprites are independent of CSS pixel dimensions.
 * Feed this value to the shader so marks have a consistent visual size
 * on standard, Retina and Android canvases. */
export function pointDiameterPixels(cssDiameter:number,ratio:number):number{
 const size=Number.isFinite(cssDiameter)?cssDiameter:3.5;
 const scale=Number.isFinite(ratio)&&ratio>0?ratio:1;
 return Math.max(2*scale,Math.min(24*scale,size*scale));
}
