// Retain only the recognition file, without opening a camera or creating an AR engine.
// The same pending/completed request is shared until release() or cancel().
export function createEntryPreload({fetchImpl=globalThis.fetch,cryptoImpl=globalThis.crypto,limit=48*1024*1024}={}) {
  if(typeof fetchImpl!=='function'||!Number.isSafeInteger(limit)||limit<100)throw new TypeError('인식 자료 설정 오류');
  let current=null;
  const aborted=()=>new DOMException('취소됨','AbortError');
  function describe(bank){
    const url=bank?.mind??bank?.url;
    if(typeof url!=='string'||!url.trim())throw new Error('인식 자료 주소 오류');
    const resolved=new URL(url,globalThis.location?.href??'https://entry.invalid/');
    if(!['http:','https:'].includes(resolved.protocol))throw new Error('인식 자료 주소 오류');
    const bytes=bank.bytes??0,sha256=bank.sha256??'';
    if(bytes!==0&&(!Number.isSafeInteger(bytes)||bytes<100||bytes>limit))throw new Error('인식 자료 크기가 올바르지 않아요.');
    if(typeof sha256!=='string'||(sha256&&!/^[a-f\d]{64}$/i.test(sha256)))throw new Error('인식 자료 버전 정보 오류');
    return{url,bytes,sha256:sha256.toLowerCase(),key:JSON.stringify([resolved.href,bytes,sha256.toLowerCase()])};
  }
  function report(entry,received,total){
    if(entry.abort.signal.aborted)return;
    entry.progress={received,total};
    for(const listener of entry.listeners)try{listener({...entry.progress});}catch{}
  }
  async function download(entry,bank){
    const signal=entry.abort.signal;
    const check=()=>{if(signal.aborted)throw aborted();};
    const response=await fetchImpl(bank.url,{signal});check();
    if(!response.ok)throw new Error('인식 자료를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    const advertised=Number(response.headers?.get('Content-Length'))||0;
    const total=bank.bytes||advertised;
    if(total>limit){await response.body?.cancel?.();throw new Error('인식 자료 크기가 올바르지 않아요.');}
    let bytes,reader,finished=false;
    const cancelReader=()=>{try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}};
    try{
      if(response.body?.getReader){
        reader=response.body.getReader();
        signal.addEventListener('abort',cancelReader,{once:true});
        // Known-size banks use one allocation, avoiding a second complete copy.
        const buffer=bank.bytes?new Uint8Array(bank.bytes):null,chunks=[];
        let received=0;
        while(true){
          const {done,value}=await reader.read();check();
          if(done){finished=true;break;}
          received+=value.byteLength;
          if(received>limit||(bank.bytes&&received>bank.bytes))throw new Error('인식 자료 크기가 올바르지 않아요.');
          if(buffer)buffer.set(value,received-value.byteLength);else chunks.push(value);
          report(entry,received,total);
        }
        if(bank.bytes&&received!==bank.bytes)throw new Error('인식 자료가 완전히 내려받아지지 않았어요. 다시 시도해 주세요.');
        bytes=buffer??new Uint8Array(received);
        if(!buffer){let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}}
      }else{bytes=new Uint8Array(await response.arrayBuffer());check();}
    }finally{
      signal.removeEventListener('abort',cancelReader);
      if(reader){if(!finished)try{await reader.cancel();}catch{}try{reader.releaseLock();}catch{}}
    }
    check();
    if(bytes.byteLength<100||bytes.byteLength>limit||(bank.bytes&&bytes.byteLength!==bank.bytes))throw new Error('인식 자료가 완전히 내려받아지지 않았어요. 다시 시도해 주세요.');
    if(bank.sha256&&cryptoImpl?.subtle){
      const digest=await cryptoImpl.subtle.digest('SHA-256',bytes);check();
      const hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
      if(hash!==bank.sha256)throw new Error('인식 자료의 버전이 달라요. 새로고침한 뒤 다시 시도해 주세요.');
    }
    report(entry,bytes.byteLength,total||bytes.byteLength);
    return bytes;
  }
  function cancel(){const entry=current;current=null;entry?.abort.abort();}
  function release(){
    if(!current)return;
    if(current.complete)current=null;
    else current.releaseOnSettle=true;
  }
  function load(bank,{onProgress}={}){
    let description;try{description=describe(bank);}catch(error){return Promise.reject(error);}
    if(current&&current.key!==description.key)cancel();
    if(!current){
      const entry={key:description.key,abort:new AbortController(),listeners:new Set(),progress:{received:0,total:description.bytes},complete:false,releaseOnSettle:false,promise:null};
      current=entry;
      let rejectAbort;
      const cancellation=new Promise((_,reject)=>{rejectAbort=()=>reject(aborted());});
      entry.abort.signal.addEventListener('abort',rejectAbort,{once:true});
      entry.promise=Promise.race([download(entry,description),cancellation]).then(bytes=>{
        if(entry.abort.signal.aborted)throw aborted();
        entry.complete=true;return bytes;
      },error=>{if(current===entry)current=null;throw error;}).finally(()=>{
        entry.abort.signal.removeEventListener('abort',rejectAbort);entry.listeners.clear();
        if(entry.releaseOnSettle&&current===entry)current=null;
      });
    }
    const entry=current;
    if(typeof onProgress==='function'){
      if(!entry.complete)entry.listeners.add(onProgress);
      try{onProgress({...entry.progress});}catch{}
    }
    return entry.promise;
  }
  return{load,release,cancel};
}
