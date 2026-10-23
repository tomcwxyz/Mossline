/** Low-noise labels shared by WebGL overlay and Canvas 2D.
 * Labels remain presentation-only and never alter network records.
 */
export interface NetworkLabel {x:number;y:number;label:string;index:number}
export function drawNetworkLabels(
  ctx:CanvasRenderingContext2D,
  labels:readonly NetworkLabel[],
  isHub:(index:number)=>boolean,
  width:number,height:number,
  zoom=1
):void {
  if(width<40||height<40)return;
  ctx.save();
  ctx.textBaseline="middle";
  ctx.textAlign="left";
  const occupied:{x:number;y:number;w:number;h:number}[]=[];
  const hubs=labels.filter(item=>isHub(item.index));
  const ordinary=labels.filter(item=>!isHub(item.index));
  // At landscape scale show the structure, not a screenful of text.
  // Zooming reveals progressively more names; hub labels take precedence.
  const limit=zoom<.3?0:zoom<.75?Math.min(3,ordinary.length):
    zoom<1.5?Math.min(width<650?5:10,ordinary.length):
    Math.min(width<650?12:25,ordinary.length);
  const candidates=[...hubs.slice(0,width<650?6:12),...ordinary.slice(0,limit)];
  for(const item of candidates){
    const hub=isHub(item.index);
    ctx.font=hub?"600 13px system-ui, sans-serif":"500 11px system-ui, sans-serif";
    const maxWidth=Math.min(hub?195:155,width-24);
    let label=item.label.trim().replace(/\\s+/g," ");
    if(!label)continue;
    while(label.length>1&&ctx.measureText(label).width>maxWidth)
      label=label.slice(0,-1);
    if(label!==item.label.trim().replace(/\\s+/g," "))label=label.trimEnd()+"…";
    const w=Math.min(maxWidth,ctx.measureText(label).width),h=hub?21:18;
    const positions=[
      {x:item.x+11,y:item.y-h/2},
      {x:item.x-w-11,y:item.y-h/2},
      {x:item.x-w/2,y:item.y-h-13},
      {x:item.x-w/2,y:item.y+12}
    ];
    const at=positions.find(p=>p.x>=8&&p.y>=8&&p.x+w<=width-8&&p.y+h<=height-8&&
      !occupied.some(o=>p.x<o.x+o.w+9&&p.x+w+9>o.x&&
        p.y<o.y+o.h+6&&p.y+h+6>o.y));
    if(!at)continue;
    occupied.push({...at,w,h});
    // A fine dark halo keeps lettering legible over thousands of edges
    // without turning the network into a pile of opaque rectangles.
    ctx.lineJoin="round";
    ctx.lineWidth=hub?3.5:3;
    ctx.strokeStyle="rgba(9,31,28,.96)";
    ctx.strokeText(label,at.x,at.y+h/2);
    ctx.fillStyle=hub?"#fff0ce":"#dce7df";
    ctx.fillText(label,at.x,at.y+h/2);
  }
  ctx.restore();
}
