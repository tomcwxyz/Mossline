/// <reference lib="webworker" />
import {listRecoveryMaps,omitRecoveryMap,readMapLibraryForRecovery,
  type StoredMapLibraryRecovery} from "@mossline/graph-core";

type Message={type:"inspect"|"remove"|"commit";raw?:string;id?:string;requestId:number};
let current:StoredMapLibraryRecovery|null=null;
let pending:StoredMapLibraryRecovery|null=null;

self.onmessage=(event:MessageEvent<Message>)=>{
  const {type,raw,id,requestId}=event.data;
  try{
    if(type==="inspect"){
      if(typeof raw!=="string")throw Error("No saved map library available");
      current=readMapLibraryForRecovery(raw);pending=null;
      self.postMessage({type:"listed",requestId,activeId:current.activeId,
        maps:listRecoveryMaps(current)});
    }else if(type==="remove"){
      if(!current||!id)throw Error("Map library is not ready");
      pending=omitRecoveryMap(current,id);
      self.postMessage({type:"candidate",requestId,
        nextRaw:pending.maps.length?JSON.stringify(pending):null,
        maps:listRecoveryMaps(pending),activeId:pending.activeId});
    }else if(type==="commit"){
      if(pending){current=pending;pending=null;}
    }
  }catch(error){
    pending=null;
    self.postMessage({type:"error",requestId,
      message:error instanceof Error?error.message:"Could not process saved maps"});
  }
};
