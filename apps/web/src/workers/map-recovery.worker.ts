/// <reference lib="webworker" />
import {listRecoveryMaps,omitRecoveryMap,readMapLibraryForRecovery,
  MAP_LIBRARY_STORAGE_KEY,LEGACY_GRAPH_STORAGE_KEY,
  type StoredMapLibraryRecovery} from "@mossline/graph-core";

type Message={type:"inspect"|"remove"|"commit"|"restore";raw?:string;id?:string;requestId:number};
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
    }else if(type==="restore"){
      if(typeof raw!=="string")throw Error("No backup file was supplied.");
      const backup:unknown=JSON.parse(raw);
      if(!backup||typeof backup!=="object")throw Error("Not a Mossline map backup.");
      const object=backup as Record<string,unknown>;
      if(object.format!=="mossline-browser-recovery-backup"||object.version!==1)
        throw Error("Unsupported map-library backup format.");
      if(!object.values||typeof object.values!=="object")
        throw Error("Backup is missing browser map values.");
      const values=object.values as Record<string,unknown>;
      const library=values[MAP_LIBRARY_STORAGE_KEY],legacy=values[LEGACY_GRAPH_STORAGE_KEY];
      if(library!==null&&typeof library!=="string"&&library!==undefined)
        throw Error("Invalid map-library backup content.");
      if(legacy!==null&&typeof legacy!=="string"&&legacy!==undefined)
        throw Error("Invalid legacy-map backup content.");
      if(!library&&!legacy)throw Error("This backup does not contain any saved maps.");
      const restored=library?readMapLibraryForRecovery(library):null;
      if(legacy){
        const legacyGraph:unknown=JSON.parse(legacy);
        if(!legacyGraph||typeof legacyGraph!=="object"||
          !Array.isArray((legacyGraph as Record<string,unknown>).nodes)||
          !Array.isArray((legacyGraph as Record<string,unknown>).edges))
          throw Error("The legacy map backup is incomplete.");
      }
      self.postMessage({type:"restorable",requestId,
        nextRaw:library??null,legacyRaw:legacy??null,
        maps:restored?listRecoveryMaps(restored):[],
        activeId:restored?.activeId??""});
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
