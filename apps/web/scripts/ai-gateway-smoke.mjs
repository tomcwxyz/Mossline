// Temporary preview-only diagnostic. Remove after inspecting the build result.
// Uses synthetic text, never customer records, and never prints credentials.
if (process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/general-dataset-grouping-20261023") {
  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (!key) {
    console.log("[Gateway smoke] FAIL: API key absent in build environment");
  } else {
    for (const model of ["openai/text-embedding-3-small","alibaba/qwen3-embedding-0.6b","google/gemini-embedding-001","voyage/voyage-3.5-lite"]) {
      const size=1;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),20000);
      try {
        const response=await fetch("https://ai-gateway.vercel.sh/v1/embeddings",{
          method:"POST",signal:controller.signal,
          headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},
          body:JSON.stringify({model,
            input:Array.from({length:size},(_,i)=>"Synthetic network record "+i),
            encoding_format:"float"}),
        });
        const body=await response.json().catch(()=>null);
        const rows=body?.data;
        const good=response.ok&&Array.isArray(rows)&&rows.length===size &&
          rows.every(row=>Array.isArray(row.embedding)&&row.embedding.length===1536);
        const err=body?.error;
        console.log("[Gateway smoke]",JSON.stringify({model,size,status:response.status,ok:good,
          count:Array.isArray(rows)?rows.length:null,
          format:rows?.[0]&&typeof rows[0].embedding,
          length:rows?.[0]?.embedding?.length,
          errorCode:typeof err?.code==="string"?err.code:null,
          errorType:typeof err?.type==="string"?err.type:null,
          errorName:typeof err?.param?.name==="string"?err.param.name:null,
          errorMessage:typeof err?.message==="string"?err.message.slice(0,300):null}));
      }catch(error){
        console.log("[Gateway smoke]",JSON.stringify({model,size,ok:false,
          errorType:error?.name||"UnknownError"}));
      }finally{clearTimeout(timer);}
    }
  }
}
