// Experimental staged recognition. All 39 areas remain eligible for discovery.
// Tracking data stays unchanged; only extra matching scales arrive on demand.
export function createProgressiveTargets({manifest,targets,matchingDataList,decode,apply,signal,onStatus=()=>{},fetchBytes,now=()=>performance.now()}) {
  const loaded=new Set(),queued=new Set(),queue=[],retryAfter=new Map();
  let active=false,dirty=false,disposed=false,lastSeen=now(),lastExpansion=now(),cursor=0;
  const order=[];
  const groups=[...new Set(targets.map(t=>t.sourceBank))].map(bank=>targets.filter(t=>t.sourceBank===bank).map(t=>t.targetIndex));
  for(let n=0;n<Math.max(...groups.map(g=>g.length));n++)for(const group of groups)if(n<group.length)order.push(group[n]);
  const alive=()=>!disposed&&!signal.aborted;
  async function pump(){
    if(active||!alive())return;active=true;
    try{
      while(queue.length&&alive()){
        const index=queue.shift(),patch=manifest.patches[index];
        try{
          const bytes=await fetchBytes(patch,signal);
          if(!alive())break;
          const data=decode(bytes);
          if(data.length!==1||data[0].matchingData.length!==patch.levels.length)throw Error('구역 자료 형식 오류');
          const merged=[];
          manifest.baseLevels.forEach((level,n)=>{merged[level]=matchingDataList[index][n];});
          patch.levels.forEach((level,n)=>{merged[level]=data[0].matchingData[n];});
          if(merged.filter(Boolean).length!==merged.length)throw Error('구역 자료 누락');
          matchingDataList[index]=merged;loaded.add(index);dirty=true;
          onStatus('다른 친구도 천천히 비춰 보세요.');
        }catch(error){if(alive()){retryAfter.set(index,now()+15000);onStatus('표시가 보이지 않으면 잠시 멈춰 비춰 주세요.');}}
        finally{queued.delete(index);}
      }
    }finally{active=false;}
  }
  function request(index,priority=false){
    if(!alive()||loaded.has(index)||queued.has(index)||(retryAfter.get(index)||0)>now())return;
    if(!manifest.patches[index]||manifest.patches[index].targetIndex!==index)throw Error('구역 번호 오류');
    queued.add(index);priority?queue.unshift(index):queue.push(index);void pump();
  }
  function matched(index){
    if(!alive())return;
    if(index>=0){
      lastSeen=now();const t=targets[index];
      const near=[...targets].sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y)).slice(0,3);
      request(index,true);for(const n of near)request(n.targetIndex);
    }else if(now()-lastSeen>6000&&now()-lastExpansion>2500){
      lastExpansion=now();
      for(let n=0;n<order.length;n++){const index=order[cursor++%order.length];if(!loaded.has(index)&&!queued.has(index)){request(index);break;}}
    }
  }
  return {
    matched,
    beforeMatch(){if(alive()&&dirty){apply(matchingDataList);dirty=false;}},
    dispose(){disposed=true;queue.length=0;queued.clear();},
    stats(){return{loaded:loaded.size,queued:queued.size,active,disposed};}
  };
}

export async function fetchPatch(patch,signal){
  const abort=new AbortController(),cancel=()=>abort.abort();
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  const timer=setTimeout(cancel,20000);
  try{
    const response=await fetch(patch.url,{signal:abort.signal});
    if(!response.ok)throw Error('인식 보충 자료 다운로드 실패');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength!==patch.bytes||bytes.byteLength>2*1024*1024)throw Error('인식 보충 자료 크기 오류');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!==patch.sha256)throw Error('인식 보충 자료 버전 오류');
    return bytes;
  }finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);}
}
