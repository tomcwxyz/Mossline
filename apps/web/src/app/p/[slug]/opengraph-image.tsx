import {ImageResponse} from "next/og";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {getPublished} from "../../../lib/hosted-db";
import {isHostedConfigured,validPublicationId} from "../../../lib/hosted-auth";
import {previewText} from "../../../lib/preview-text";
import {seeded} from "../../../components/atlas/marginalia";

export const runtime="nodejs";
export const alt="A preview of a map published with Mossline";
export const size={width:1200,height:630};
export const contentType="image/png";

const font=(name:string)=>readFile(join(process.cwd(),"assets/og",name));
const C={paper:"#F2F1EC",ink:"#1E2622",muted:"#4A5049",margin:"#8A4A1C",moss:"#4F6F3E",line:"#B8BCAF"};

/**
 * The card a link shows when it's shared (chat, email, social media): the
 * title, a line about it, and either the story's uploaded cover or a small
 * drawing of a network with a pencil ring, in the atlas's colours.
 */
export default async function Image({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const [serif,sans,sansMedium]=await Promise.all([font("newsreader-latin-500-normal.woff"),
    font("ibm-plex-sans-latin-400-normal.woff"),font("ibm-plex-sans-latin-500-normal.woff")]);
  let text={kind:"Mossline",title:"A map of connected work",description:"Published with Mossline.",counts:"",cover:null as null|{src:string}};
  if(validPublicationId(slug)&&isHostedConfigured()){
    try{const p=await getPublished(slug);if(p)text=previewText(p.snapshot);}catch{/* the plain card below */}
  }
  const rand=seeded(slug);
  const dots=Array.from({length:26},()=>({x:40+rand()*360,y:60+rand()*500,r:5+rand()*9,c:rand()>0.7?"#2E6E8E":rand()>0.4?"#4F7A3E":"#B07A3A"}));
  const links=dots.slice(1).map((d,i)=>{const o=dots[Math.floor(rand()*(i+1))];return `M${o.x} ${o.y}L${d.x} ${d.y}`;}).join(" ");
  const ring=`M150 210 C 260 150, 350 230, 330 320 S 170 420, 120 330 S 110 230, 185 196`;
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",background:C.paper,fontFamily:"Plex"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"64px 56px 56px 72px"}}>
        <div style={{display:"flex",fontSize:22,letterSpacing:4,textTransform:"uppercase",color:C.margin,fontWeight:500}}>{text.kind}</div>
        <div style={{display:"flex",fontFamily:"Newsreader",fontSize:text.title.length>60?54:68,lineHeight:1.06,color:C.ink,marginTop:22}}>{text.title}</div>
        <div style={{display:"flex",fontSize:27,lineHeight:1.4,color:C.muted,marginTop:24}}>{text.description}</div>
        <div style={{flex:1,display:"flex"}}/>
        <div style={{display:"flex",alignItems:"center",gap:14,fontSize:22,color:C.muted}}>
          <svg width="34" height="34" viewBox="0 0 26 26"><path d="M3 19C8 19 9 8 14 8S20 15 23 6" stroke={C.ink} strokeWidth="1.6" fill="none"/>
            <circle cx="3.5" cy="19" r="2.6" fill="#4F7A3E"/><circle cx="14" cy="8" r="2.6" fill="#2E6E8E"/><circle cx="22.6" cy="6.4" r="2.6" fill="#B07A3A"/></svg>
          <span style={{fontWeight:500,color:C.ink}}>Mossline</span>{text.counts&&<span>· {text.counts}</span>}
        </div>
      </div>
      {text.cover
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={text.cover.src} width={440} height={630} style={{objectFit:"cover"}} alt=""/>
        : <svg width="440" height="630" viewBox="0 0 440 630" style={{background:"#E9E6DC"}}>
            <path d={links} stroke={C.line} strokeWidth="1.5" fill="none"/>
            {dots.map((d,i)=><circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c}/>)}
            <path d={ring} stroke={C.margin} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          </svg>}
    </div>,
    {...size,fonts:[{name:"Newsreader",data:serif,weight:500,style:"normal"},
      {name:"Plex",data:sans,weight:400,style:"normal"},{name:"Plex",data:sansMedium,weight:500,style:"normal"}]}
  );
}
