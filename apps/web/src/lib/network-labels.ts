/** Shared full-network labelling for WebGL-overlay and Canvas 2D renderers.
 * Labels are presentation-only; source names and graph records are untouched.
 */
export interface NetworkLabel {
  x:number;y:number;label:string;index:number;
}
export function drawNetworkLabels(
  context:CanvasRenderingContext2D,
  labels:readonly NetworkLabel[],
  isHub:(index:number)=>boolean,
  width:number,height:number
):void {
  if(width<20||height<20)return;
  const occupied:{x:number;y:number;width:number;height:number}[]=[];
  context.save();
  context.textAlign="left";
  context.textBaseline="middle";
  // Prominent hubs win collision priority; other labels remain available
  // on zoom, selection and through the accessible entity explorer.
  for(const item of [...labels].sort((a,b)=>Number(isHub(b.index))-Number(isHub(a.index)))){
    const hub=isHub(item.index);
    const font=hub?"600 12px system-ui, sans-serif":"500 11px system-ui, sans-serif";
    context.font=font;
    const maxWidth=Math.min(hub?210:158,width-24);
    if(maxWidth<24)continue;
    let text=item.label.trim();
    while(text.length>1&&context.measureText(text).width>maxWidth-18)
      text=text.slice(0,-1);
    if(text!==item.label.trim())text=text.trimEnd()+"…";
    const w=Math.min(maxWidth,context.measureText(text).width+16);
    const h=hub?25:21;
    // Try nearby readable positions before discarding a label. This is
    // especially useful for dense hubs, where a fixed right-hand label
    // would hide most neighbouring entities.
    const offsets:[[number,number],...[number,number][]]=[
      [10,-h/2],[-w-10,-h/2],[10,-h-8],[-w-10,-h-8],
      [10,8],[-w-10,8]
    ];
    let placement:{x:number;y:number}|null=null;
    for(const [dx,dy] of offsets){
      const x=item.x+dx,y=item.y+dy;
      if(x<6||y<6||x+w>width-6||y+h>height-6)continue;
      if(occupied.some(r=>x<r.x+r.width+5&&x+w+5>r.x&&
        y<r.y+r.height+4&&y+h+4>r.y))continue;
      placement={x,y};
      break;
    }
    if(!placement)continue;
    const {x,y}=placement;
    occupied.push({x,y,width:w,height:h});
    context.fillStyle=hub?"rgba(16,54,43,.96)":"rgba(16,44,38,.86)";
    context.beginPath();
    context.roundRect(x,y,w,h,hub?7:5);
    context.fill();
    if(hub){
      context.fillStyle="#dfbd76";
      context.fillRect(x+1,y+5,3,h-10);
    }
    context.fillStyle=hub?"#fff1cb":"#e6f0e3";
    context.fillText(text,x+9,y+h/2);
  }
  context.restore();
}
