/** Internal IndexedDB adapter for browser-local complete networks.
 *
 * General maps and funding datasets deliberately keep their existing database
 * names, store names, record shapes and backup formats. Consolidating how we
 * access the browser must not silently migrate or replace user data.
 *
 * IDB transactions auto-close if an unrelated promise is awaited. Every write
 * schedules all requests synchronously and resolves only on transaction commit.
 */
export type IndexedDbStoreSpec=Readonly<{
  database:string;store:string;version:1;
  unavailable:string;openError:string;blocked:string;
}>;

export async function withIndexedDb<T>(
  spec:IndexedDbStoreSpec,operation:(db:IDBDatabase)=>Promise<T>
):Promise<T>{
  if(typeof indexedDB==="undefined")throw Error(spec.unavailable);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(spec.database,spec.version);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(spec.store))
        request.result.createObjectStore(spec.store,{keyPath:"id"});
    };
    request.onerror=()=>reject(request.error??Error(spec.openError));
    request.onblocked=()=>reject(Error(spec.blocked));
    request.onsuccess=()=>resolve(request.result);
  });
  try{return await operation(db);}finally{db.close();}
}

export async function getIndexedDbRecord<T>(
  spec:IndexedDbStoreSpec,id:string,errorMessage:string
):Promise<T|undefined>{
  return withIndexedDb(spec,db=>new Promise<T|undefined>((resolve,reject)=>{
    const request=db.transaction(spec.store,"readonly").objectStore(spec.store).get(id);
    request.onsuccess=()=>resolve(request.result as T|undefined);
    request.onerror=()=>reject(request.error??Error(errorMessage));
  }));
}

export async function getAllIndexedDbRecords<T>(
  spec:IndexedDbStoreSpec,errorMessage:string
):Promise<T[]>{
  return withIndexedDb(spec,db=>new Promise<T[]>((resolve,reject)=>{
    const request=db.transaction(spec.store,"readonly").objectStore(spec.store).getAll();
    request.onsuccess=()=>resolve(request.result as T[]);
    request.onerror=()=>reject(request.error??Error(errorMessage));
  }));
}

/** Cursor-based metadata scan, still performed in a worker for large graphs. */
export async function scanIndexedDbRecords<T,U>(
  spec:IndexedDbStoreSpec,project:(record:T)=>U|undefined,errorMessage:string
):Promise<U[]>{
  return withIndexedDb(spec,db=>new Promise<U[]>((resolve,reject)=>{
    const entries:U[]=[];
    const request=db.transaction(spec.store,"readonly").objectStore(spec.store).openCursor();
    request.onerror=()=>reject(request.error??Error(errorMessage));
    request.onsuccess=()=>{
      const cursor=request.result;
      if(!cursor){resolve(entries);return;}
      const item=project(cursor.value as T);
      if(item!==undefined)entries.push(item);
      cursor.continue();
    };
  }));
}

export type WriteMessages=Readonly<{
  aborted:string;
  constraint?:string;
}>;
/** Atomic put/add; any failed add aborts all rows, preserving existing datasets. */
export async function writeIndexedDbRecords<T>(
  spec:IndexedDbStoreSpec,records:readonly T[],mode:"put"|"add",messages:WriteMessages
):Promise<void>{
  if(!records.length)return;
  await withIndexedDb(spec,db=>new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(spec.store,"readwrite");
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error?.name==="ConstraintError"&&messages.constraint?
      Error(messages.constraint):tx.error??Error(messages.aborted));
    tx.onerror=()=>{/* Transaction abort owns the error and rollback. */};
    try{
      const store=tx.objectStore(spec.store);
      for(const row of records)store[mode](row);
    }catch(error){
      try{tx.abort();}catch{/* Already aborted. */}
      reject(error);
    }
  }));
}

export async function deleteIndexedDbRecord(
  spec:IndexedDbStoreSpec,id:string,errorMessage:string
):Promise<void>{
  await withIndexedDb(spec,db=>new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(spec.store,"readwrite");
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error??Error(errorMessage));
    tx.onerror=()=>{/* Abort callback reports transaction failure. */};
    tx.objectStore(spec.store).delete(id);
  }));
}
