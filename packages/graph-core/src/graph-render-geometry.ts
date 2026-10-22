/** GPU-ready screen-space stroke mesh. Each original segment becomes
 * smoothly curved anti-aliased triangles without changing graph topology.
 * WebGL1 cannot guarantee high-quality wide gl.LINES on every GPU.
 * Each vertex is [x0,y0,x1,y1,curve_t,side,curve_direction].
 */
export const STROKE_STRIDE=7;
const VERTICES_PER_STEP=6;
export function buildSmoothStrokeVertices(
 segments:Float32Array,sourceEdgeIndices?:Uint32Array
):Float32Array{
 if(segments.length%4!==0)throw Error("Stroke segments must be endpoint pairs");
 const count=segments.length/4;
 if(sourceEdgeIndices&&sourceEdgeIndices.length!==count)
   throw Error("Source edge indices must match stroke segment count");
 // Keep dense 100k-edge datasets bounded: no edges are dropped, but
 // smaller curves use fewer triangles.
 const steps=count>25_000?2:count>10_000?3:4;
 const out=new Float32Array(count*steps*VERTICES_PER_STEP*STROKE_STRIDE);
 let cursor=0;
 for(let e=0;e<count;e++){
  const a=segments[e*4],b=segments[e*4+1],
   c=segments[e*4+2],d=segments[e*4+3];
  if(![a,b,c,d].every(Number.isFinite))
   throw Error("Stroke coordinates must be finite");
  if(Math.abs(c-a)+Math.abs(d-b)<1e-8)continue;
  const original=sourceEdgeIndices?.[e]??e;
  const bend=original%2===0?1:-1;
  for(let step=0;step<steps;step++){
   const t0=step/steps,t1=(step+1)/steps;
   for(const [t,side] of [
    [t0,-1],[t0,1],[t1,-1],
    [t1,-1],[t0,1],[t1,1]
   ]){
    out[cursor++]=a;out[cursor++]=b;
    out[cursor++]=c;out[cursor++]=d;
    out[cursor++]=t;out[cursor++]=side;
    out[cursor++]=bend;
   }
  }
 }
 return cursor===out.length?out:out.slice(0,cursor);
}
export function prominentNetworkIndices(degree:Uint32Array,limit=40):Uint32Array{
 const n=degree.length;
 if(!n)return new Uint32Array();
 let max=0;
 for(const value of degree)max=Math.max(max,value);
 if(max<5)return new Uint32Array();
 const order=Array.from({length:n},(_,i)=>i)
  .sort((a,b)=>degree[b]-degree[a]||a-b);
 const median=degree[order[Math.floor(n/2)]]??0;
 // Flat-degree graphs have no evidence-based prominent hubs.
 if(max<median*1.45)return new Uint32Array();
 const threshold=Math.max(5,Math.ceil(max*.19),Math.ceil(median*1.6));
 const cap=Math.min(Math.max(1,limit),Math.max(8,Math.ceil(Math.sqrt(n)/4)));
 return Uint32Array.from(order.filter(i=>degree[i]>=threshold).slice(0,cap));
}
