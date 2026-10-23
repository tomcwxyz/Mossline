// Temporary Vercel Preview smoke: calls the real Next.js route handlers with
// synthetic records. No uploaded user data or secret values are logged.
if (process.env.VERCEL_ENV==="preview" &&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/general-dataset-grouping-20261023") {
  const {POST:embed}=await import("../src/app/api/discovery/embed/route");
  const {POST:ask}=await import("../src/app/api/discovery/ask/route");
  const documents=Array.from({length:48},(_,i)=>({
    id:"synthetic-"+i,text:"An example charitable organisation supporting community arts and open local spaces, record "+i
  }));
  const response=await embed(new Request("https://preview.example/api/discovery/embed",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({documents})
  }));
  const result=await response.json();
  const vectors=result.vectors as number[][]|undefined;
  const valid=response.status===200&&result.model==="alibaba/qwen3-embedding-0.6b"&&
    Array.isArray(vectors)&&vectors.length===48&&
    vectors.every(row=>Array.isArray(row)&&row.length===1024&&row.every(Number.isFinite));
  console.log("[Mossline route smoke]",JSON.stringify({route:"embed",http:response.status,
    model:result.model||null,ok:valid,records:vectors?.length||0,
    error:typeof result.error==="string"?result.error.slice(0,170):null}));
  if(!valid)process.exitCode=1;
  const answer=await ask(new Request("https://preview.example/api/discovery/ask",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({question:"What does this example organisation support?",
      sources:[{id:"synthetic-0",label:"Example charity",type:"organisation",
        text:"An example charitable organisation supporting community arts and open local spaces."}],
      relations:[]})
  }));
  const data=await answer.json();
  const passed=answer.status===200&&data.model==="google/gemini-2.5-flash-lite"&&
    typeof data.answer==="string"&&data.answer.length>0;
  console.log("[Mossline route smoke]",JSON.stringify({route:"ask",http:answer.status,
    model:data.model||null,ok:passed,hasAnswer:typeof data.answer==="string"&&!!data.answer,
    error:typeof data.error==="string"?data.error.slice(0,170):null}));
  if(!passed)process.exitCode=1;
}
