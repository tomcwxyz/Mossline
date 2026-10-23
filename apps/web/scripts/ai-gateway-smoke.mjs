// Temporary preview-only diagnostic. Remove after inspecting the build result.
// Uses synthetic text, never customer records, and never prints credentials.
if (process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/general-dataset-grouping-20261023") {
  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (!key) {
    console.log("[Gateway smoke] FAIL: API key absent in build environment");
  } else {
    for (const model of ["alibaba/qwen3-embedding-0.6b"]) {
      const size=48;
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
          rows.every(row=>Array.isArray(row.embedding)&&row.embedding.length===rows[0].embedding.length&&row.embedding.length>0);
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
    for (const model of ["alibaba/qwen-3-14b","google/gemini-2.5-flash-lite"]) {
      try{
        const response=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{
          method:"POST",signal:AbortSignal.timeout(18000),
          headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},
          body:JSON.stringify({model,messages:[{role:"user",content:"Reply with the word OK."}],max_tokens:80,temperature:0})
        });
        const body=await response.json().catch(()=>null);
        const message=body?.choices?.[0]?.message?.content;
        const err=body?.error;
        console.log("[Gateway chat smoke]",JSON.stringify({model,status:response.status,
          hasAnswer:typeof message==="string"&&message.length>0,
          errorType:err?.type||null,errorName:err?.param?.name||null,
          errorMessage:typeof err?.message==="string"?err.message.slice(0,230):null}));
      }catch(e){console.log("[Gateway chat smoke]",JSON.stringify({model,errorType:e?.name||"unknown"}));}
    }
  }
}
