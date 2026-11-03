/**
 * Errors worth someone's attention: written to the server log as one JSON
 * line, and, if MOSSLINE_ALERT_WEBHOOK is set, posted there too (Slack,
 * Discord, ntfy and most chat tools accept it). At most one alert per place
 * every ten minutes, so a bad night doesn't become a flood.
 */
const lastSent=new Map<string,number>();
export function reportError(where:string,error:unknown,detail:Record<string,unknown>={}):void{
  const message=error instanceof Error?error.message:String(error);
  console.error(JSON.stringify({level:"error",where,message,...detail,at:new Date().toISOString()}));
  const hook=process.env.MOSSLINE_ALERT_WEBHOOK;
  if(!hook)return;
  const now=Date.now();
  if(now-(lastSent.get(where)??0)<10*60_000)return;
  lastSent.set(where,now);
  const text="Mossline: "+where+" failed: "+message.slice(0,300);
  void fetch(hook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,content:text})}).catch(()=>{});
}
