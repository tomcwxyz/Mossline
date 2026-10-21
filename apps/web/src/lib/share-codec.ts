import { parsePublishedSnapshot, type PublishedSnapshot } from "@mossline/graph-core";

/** URL fragments are never sent with HTTP requests. They are NOT confidential:
 * anyone receiving the link can decode its complete snapshot. Nothing is stored
 * in our server, and fragments cannot be revoked or updated remotely.
 */
export const MAX_FRAGMENT_LENGTH=7500;
const MAX_JSON_BYTES=150000;

export async function encodeShareSnapshot(data:PublishedSnapshot):Promise<string>{
  if(typeof CompressionStream==="undefined")throw Error("This browser does not support compressed share links.");
  const json=JSON.stringify(parsePublishedSnapshot(data));
  if(new TextEncoder().encode(json).length>MAX_JSON_BYTES)throw Error("This view is too large to share as a link.");
  const stream=new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  let binary="";
  for(let i=0;i<bytes.length;i+=8192)
    binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const encoded=btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  if(encoded.length>MAX_FRAGMENT_LENGTH)
    throw Error("This view is too large for a reliable share link. Reduce the map with filters or use Export views.");
  return encoded;
}

export async function decodeShareSnapshot(fragment:string):Promise<PublishedSnapshot>{
  if(typeof DecompressionStream==="undefined")throw Error("This browser cannot read compressed share links.");
  if(!/^[A-Za-z0-9_-]{1,7500}$/.test(fragment))
    throw Error("The share link is missing or is too large.");
  const binary=atob(fragment.replace(/-/g,"+").replace(/_/g,"/"));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const source=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader=source.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let json="",size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_JSON_BYTES)throw Error("The shared view exceeds the safe size limit.");
      json+=decoder.decode(value,{stream:true});
    }
    json+=decoder.decode();
    return parsePublishedSnapshot(JSON.parse(json));
  } finally {void reader.cancel().catch(()=>{});}
}
