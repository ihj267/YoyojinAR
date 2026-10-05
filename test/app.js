import './catalog-migrations.js';
import './worksheet.js';
import {createTargetSearchOrder} from './ar-target-search.js';
import {createStablePins} from './vendor/yoyojin/stable-pins.js?v=20261005';
import {showArtworkPair,resetArtworkPair} from './artwork-pair.js?v=exhibition-20260929';
const $ = s => document.querySelector(s);
const preview = false; // Use the prepared GitHub snapshot.
const lightMode = new URLSearchParams(location.search).get('ar') !== 'full';
const DRAFT_KEY = 'yoyojin.mural.draft.v1';
const state = {catalog:null, targets:null, view:'ready', galleryPage:0, zoom:1, ar:null, session:0, starting:false, cameraAbort:null, introTimer:null, guide:null, guidePromise:null, reduceOverlap:false};
const worksheetTools=window.YoyojinWorksheet;
const titleOf = worksheetTools.titleOf;
const visibleItems = () => state.catalog.items.filter(i => preview || i.publish === true);
const mappedItems = () => visibleItems().filter(i => i.mapping && (preview || i.mapping.confirmed === true) && Number.isFinite(i.mapping.x) && Number.isFinite(i.mapping.y));
async function json(url) { const r=await fetch(url); if(!r.ok)throw new Error(`자료를 불러오지 못했습니다 (${r.status})`); return r.json(); }
function validDraft(d, source) {
  if(d?.version!==1 || !Array.isArray(d.items) || d.items.length!==source.items.length)return false;
  const seen=new Set();
  return d.items.every(i=>{
    const original=source.items.find(s=>s.id===i.id);
    if(!original||seen.has(i.id)||i.sourcePage!==original.sourcePage||i.image!==original.image||i.thumbnail!==original.thumbnail)return false;
    seen.add(i.id);
    try{worksheetTools.validate(i.worksheet,{publicView:true});}catch{return false;}
    return ['title','displayName','story'].every(k=>typeof i[k]==='string'&&i[k].length<=10000)&&typeof i.publish==='boolean'&&(!i.mapping||(typeof i.mapping.confirmed==='boolean'&&['x','y'].every(k=>Number.isFinite(i.mapping[k])&&i.mapping[k]>=0&&i.mapping[k]<=1)));
  });
}
function switchView(view) {
  if(state.view==='camera'||state.starting) stopCamera();
  state.view=view;
  ['ready','map','gallery','camera'].forEach(v=>$(`#${v}-view`).hidden=v!==view);
  $('#bottom-nav').hidden=view==='ready'||view==='camera';
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(view==='gallery') renderGallery();
  if(view==='map') renderMap();
  if(view!=='camera'){window.scrollTo(0,0);(view==='ready'?$('#start-camera'):$('main h2#'+view+'-title'))?.focus({preventScroll:true});}
}
function point(item) {
  const b=document.createElement('button'); b.className='point'+(item.mapping?.confirmed?'':' candidate'); b.textContent=item.id;
  if(preview&&!item.mapping?.confirmed)b.title='위치 후보 · 작가 확인 전';
  b.setAttribute('aria-label',`${titleOf(item)} 원화 열기`); b.onclick=()=>openArtwork(item); return b;
}
function renderMap() {
  $('#wall-map').src=state.catalog.wall.image;
  const layer=$('#map-points'); layer.replaceChildren();
  for(const item of mappedItems()){const b=point(item);b.style.left=`${item.mapping.x*100}%`;b.style.top=`${item.mapping.y*100}%`;layer.append(b);}
  const n=mappedItems().length;
  const pending=mappedItems().filter(i=>!i.mapping.confirmed).length;
  $('#mapping-status').textContent=n?(preview&&pending?`${n}개의 이야기 · 위치 확인 전 ${pending}개`:`${n}개의 이야기`):'벽화 속 이야기를 준비하고 있어요.';
}
function renderGallery() {
  const q=$('#search').value.trim();
  const items=visibleItems().filter(i=>!q||i.id.includes(q)||String(i.sourcePage)===q||worksheetTools.questions.some(f=>i.worksheet?.[f.key]?.text.includes(q)));
  const pages=Math.max(1,Math.ceil(items.length/24));state.galleryPage=Math.min(state.galleryPage,pages-1);
  $('#gallery-count').textContent=`${items.length}개의 그림${preview?' · 원본 참여지 검수용':''}`;
  const grid=$('#gallery-grid');grid.replaceChildren();
  for(const item of items.slice(state.galleryPage*24,(state.galleryPage+1)*24)){
    const b=document.createElement('button'); b.className='art-card';b.onclick=()=>openArtwork(item);
    const img=document.createElement('img');img.src=item.thumbnail;img.alt=titleOf(item);img.loading='lazy';img.decoding='async';
    const id=document.createElement('span');id.className='card-id';id.textContent=`NO. ${item.id}`;
    const title=document.createElement('strong');title.textContent=titleOf(item);b.append(img,id,title);grid.append(b);
  }
  if(!items.length){const p=document.createElement('p');p.className='subtle';p.textContent=q?'찾는 그림이 없어요. 번호나 이름을 다시 입력해 주세요.':'공개할 그림을 준비하고 있어요.';grid.append(p);}
  $('#page-label').textContent=`${state.galleryPage+1} / ${pages}`;$('#prev-page').disabled=state.galleryPage===0;$('#next-page').disabled=state.galleryPage===pages-1;
}
let artworkFocus=null,artworkOpenRevision=0;
function openArtwork(item) {
  const opening=++artworkOpenRevision;
  artworkFocus=document.activeElement;$('#art-number').textContent=`참여 작품 · ${item.id}`;$('#art-title').textContent=titleOf(item);
  $('#art-name').textContent=item.displayName||'';$('#art-name').hidden=!item.displayName;
  const story=$('#art-story');story.replaceChildren();
  if(item.worksheet){
    const answers=document.createElement('dl');answers.className='pdf-answers';
    for(const question of worksheetTools.questions){
      const answer=item.worksheet[question.key];
      if(!answer?.text?.trim()||answer.status==='blank')continue;
      const dt=document.createElement('dt'),dd=document.createElement('dd');
      dt.textContent=question.label;dd.textContent=answer.text;
      if(answer.status==='uncertain'){const note=document.createElement('small');note.className='pdf-answer-note';note.textContent=preview?'글씨 확인 필요'+(answer.note?` · ${answer.note}`:''):'손글씨를 옮긴 내용으로, 일부 글자가 다를 수 있어요. 원화에서 함께 확인해 주세요.';dd.append(note);}
      if(answer.status==='blank')dd.classList.add('blank');answers.append(dt,dd);
    }
    if(answers.children.length)story.append(answers);else story.textContent='아이의 그림과 손글씨를 원화에서 만나 보세요.';
  }else story.textContent=item.story||'아이의 그림과 손글씨를 원화에서 만나 보세요.';
  $('#art-review').textContent=preview?`PDF ${item.sourcePage}쪽 · ${item.publish?'공개 선택됨':'공개 전 검수용'}${item.mapping?.confirmed?' · 위치 확인됨':' · 벽화 위치 연결 대기'}`:'';
  $('#art-image').alt=titleOf(item);$('#art-image-error').hidden=true;
  $('#art-image').onerror=()=>{$('#art-image-error').hidden=false;};$('#art-image').src=item.image;
  $('#full-art').href=item.image;showArtworkPair(item,{wall:state.catalog.wall,preview});
  const dialog=$('#art-dialog');
  const resetScroll=()=>{dialog.scrollTop=0;dialog.scrollLeft=0;for(const el of dialog.querySelectorAll('.art-body,.art-story,.art-image-wrap')){el.scrollTop=0;el.scrollLeft=0;}};
  resetScroll();dialog.showModal();$('#close-art').focus({preventScroll:true});resetScroll();
  requestAnimationFrame(()=>{if(dialog.open&&opening===artworkOpenRevision)resetScroll();});
}
function closeArtwork(){ resetArtworkPair();$('#art-dialog').close(); if(state.view==='camera')$('#stop-camera').focus({preventScroll:true});else artworkFocus?.focus({preventScroll:true}); }
async function showIntro() {
  if(!state.guide){$('#guide-stage').classList.remove('guide-unavailable');$('#guide-loading').hidden=false;$('#guide-loading').textContent='친구가 오는 중이에요…';}
  $('#intro').hidden=false;for(const el of document.body.children)if(el!==$('#intro'))el.inert=true;$('#skip-intro').focus();const start=performance.now();
  const lines=[['안녕! 벽화 속에서 만나자.','우리의 이야기는 아이들의 작은 상상에서 시작됐어.'],['카메라로 나를 찾아줘!','벽화를 천천히 비추면 노란 표시가 나타날 거야.'],['노란 표시를 톡, 눌러 볼까?','아이들이 그린 원화와 함께 살아가는 이야기를 만날 수 있어.']];
  clearInterval(state.introTimer);
  const tick=()=>{const elapsed=(performance.now()-start)/1000;const line=lines[Math.min(2,Math.floor(elapsed/3.4))];$('#intro-title').textContent=line[0];$('#intro-copy').textContent=line[1];$('#intro-progress').style.width=`${Math.min(100,elapsed*10)}%`;$('#intro-countdown').textContent=`${Math.max(0,Math.ceil(10-elapsed))}초 후 관람 화면으로 이동`;if(elapsed>=10)closeIntro();};
  tick();state.introTimer=setInterval(tick,100);
  try{
    state.guidePromise??=import('./guide.js').then(module=>$('#intro').hidden?null:module.createGuide($('#guide-stage')));
    const guide=await state.guidePromise;
    if(!guide){state.guidePromise=null;return;}
    state.guide=guide;$('#guide-stage').classList.remove('guide-unavailable');
    if(!$('#intro').hidden)guide.play();else guide.pause();
  }catch(e){state.guidePromise=null;$('#guide-stage').classList.add('guide-unavailable');$('#guide-loading').hidden=false;$('#guide-loading').textContent='벽화 속 친구들의 이야기를 만나 보세요.';console.warn('guide',e);}
}
function closeIntro(){clearInterval(state.introTimer);$('#intro').hidden=true;for(const el of document.body.children)el.inert=false;state.guide?.pause();try{sessionStorage.setItem('yoyojin.intro.seen','1');}catch{}$('#start-camera').focus();}
function cameraError(error) {
  const name=error?.name;
  if(name==='NotAllowedError')return '카메라가 허용되지 않았어요. 주소창의 카메라 권한을 확인한 뒤 다시 눌러 주세요.';
  if(name==='NotFoundError')return '사용 가능한 카메라를 찾지 못했어요. 카메라가 있는 휴대폰에서 열거나 벽화 지도를 이용해 주세요.';
  if(name==='NotReadableError')return '다른 앱이 카메라를 사용 중일 수 있어요. 다른 카메라 앱을 닫고 다시 시도해 주세요.';
  return '카메라 관람을 시작하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요. 벽화 지도로도 관람할 수 있어요.';
}
async function startCamera() {
  if(state.starting)return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){$('#camera-message').textContent='이 브라우저에서 카메라를 사용할 수 없어요. 휴대폰의 Safari 또는 Chrome에서 열거나 벽화 지도를 이용해 주세요.';return;}
  state.starting=true;const token=++state.session;const button=$('#start-camera');button.disabled=true;button.textContent='카메라 준비 중…';$('#camera-message').textContent='관람 화면을 준비하고 있어요.';
  const abort=new AbortController();state.cameraAbort=abort;
  state.view='camera';['ready','map','gallery'].forEach(v=>$(`#${v}-view`).hidden=true);$('#camera-view').hidden=false;$('#bottom-nav').hidden=true;
  document.querySelectorAll('.topbar,#preview-banner,.skip-link').forEach(el=>el.inert=true);$('#stop-camera').focus();
  $('#tracking-status').textContent='관람 화면을 준비하고 있어요…';
  $('#tracking-hint').textContent='잠시만 기다려 주세요. 처음에는 준비 시간이 필요해요.';
  const assertActive=()=>{if(token!==state.session||abort.signal.aborted)throw new DOMException('취소됨','AbortError');};
  let ar, downloadTimer, bytes=null;
  const releaseTargetBuffer=()=>{bytes=null;};
  abort.signal.addEventListener('abort',releaseTargetBuffer,{once:true});
  try{
    const originalBank=state.targets.automaticBank;
    const staged=lightMode?state.targets.progressive:null;
    if(lightMode&&(!staged||staged.version!==1||staged.patches.length!==39))throw new Error('빠른 시작 자료를 다시 업데이트해 주세요.');
    const bank=staged?{...originalBank,mind:staged.initial.url,bytes:staged.initial.bytes,sha256:staged.initial.sha256}:originalBank;
    if(!bank||bank.targets.length!==39||bank.targets.some((target,index)=>target.targetIndex!==index))throw new Error('벽화 전체 인식 자료를 다시 업데이트해 주세요.');
    downloadTimer=setTimeout(()=>abort.abort(),120000);
    if(staged)$('#tracking-hint').textContent='잠시 후 벽화를 비춰 주세요.';
    const response=await fetch(bank.mind,{signal:abort.signal});if(!response.ok)throw new Error('인식 자료를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    const limit=48*1024*1024,total=bank.bytes||Number(response.headers.get('Content-Length'))||0;
    if(total>limit)throw new Error('인식 자료 크기가 올바르지 않아요.');
    if(response.body?.getReader){
      const reader=response.body.getReader(),chunks=[];let received=0;
      while(true){
        const {done,value}=await reader.read();if(done)break;assertActive();received+=value.byteLength;
        if(received>limit){await reader.cancel();throw new Error('인식 자료 크기가 올바르지 않아요.');}
        chunks.push(value);$('#tracking-status').textContent=total?`관람 준비 중 · ${Math.min(99,Math.floor(received/total*100))}%`:'관람 화면을 준비하고 있어요…';
      }
      bytes=new Uint8Array(received);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}chunks.length=0;
    }else bytes=new Uint8Array(await response.arrayBuffer());
    clearTimeout(downloadTimer);assertActive();
    if(bytes.byteLength<100||bytes.byteLength>limit||(bank.bytes&&bytes.byteLength!==bank.bytes))throw new Error('인식 자료가 완전히 내려받아지지 않았어요. 다시 시도해 주세요.');
    if(bank.sha256&&crypto.subtle){const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(digest!==bank.sha256)throw new Error('인식 자료의 버전이 달라요. 새로고침한 뒤 다시 시도해 주세요.');}
    $('#tracking-status').textContent='카메라를 켜고 있어요…';
    const [{MindARThree},{C:Controller,a:Compiler},THREE]=await Promise.all([import('./vendor/dist/mindar-image-three.prod.js'),import('./vendor/dist/controller-mGt1s8dJ.js'),import('three')]);
    const progressiveModule=staged?await import('./vendor/yoyojin/progressive-targets.js?v=exhibition-20260929'):null;
    assertActive();
    // Capture the upstream library's bound listener for cleanup after a session.
    const resizeHandlers=[];
    const originalAdd=window.addEventListener;
    window.addEventListener=function(type,fn,opts){
      if(type!=='resize')return originalAdd.call(this,type,fn,opts);
      const guarded=function(...args){if(token!==state.session||!ar?.controller||!(ar.video?.videoWidth>0&&ar.video?.videoHeight>0))return;return fn.apply(this,args);};
      resizeHandlers.push(guarded);return originalAdd.call(this,type,guarded,opts);
    };
    try{ar=new MindARThree({container:$('#ar-container'),imageTargetSrc:bank.mind,maxTrack:1,uiLoading:'no',uiScanning:'no',uiError:'no',warmupTolerance:4,missTolerance:5});}finally{window.addEventListener=originalAdd;}
    ar.__resizeHandlers=resizeHandlers;ar.__releaseTargetBuffer=releaseTargetBuffer;
    state.ar=ar;
    // Preserve the actual browser error, and reject late permission responses after cancellation.
    ar._startVideo=async()=>{
      const video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;video.style.position='absolute';ar.video=video;$('#ar-container').append(video);
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      if(token!==state.session){stream.getTracks().forEach(t=>t.stop());throw new DOMException('취소됨','AbortError');}
      video.srcObject=stream;
      await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;if(video.readyState>=1)resolve();});
      assertActive();video.width=video.videoWidth;video.height=video.videoHeight;await video.play();assertActive();
    };
    // Use the bundled controller directly so failed decoding rejects normally,
    // and downloaded bytes are consumed once instead of being fetched again.
    ar._startAR=async()=>{
      assertActive();
      const controller=ar.controller=new Controller({inputWidth:ar.video.videoWidth,inputHeight:ar.video.videoHeight,maxTrack:1,warmupTolerance:4,missTolerance:5,onUpdate:event=>{
        if(token!==state.session||event.type!=='updateMatrix')return;
        const anchor=ar.anchors.find(entry=>entry.targetIndex===event.targetIndex);if(!anchor)return;
        const visible=event.worldMatrix!==null;anchor.group.visible=visible;
        if(visible){
          anchor.group.matrix.fromArray(event.worldMatrix).multiply(ar.postMatrixs[event.targetIndex]);
          // Old 'showing' poses continue during miss tolerance. Only a genuine
          // successful tracking observation may advance the screen filter.
          if(controller.trackingStates?.[event.targetIndex]?.isTracking){
            anchor.__poseSequence=(anchor.__poseSequence||0)+1;
          }
        }
        const wasVisible=anchor.visible;anchor.visible=visible;
        if(visible&&!wasVisible)anchor.onTargetFound?.();if(!visible&&wasVisible)anchor.onTargetLost?.();anchor.onTargetUpdate?.();
      }});
      ar.resize();
      const search=createTargetSearchOrder(bank.targets),detectAndMatch=controller._detectAndMatch.bind(controller);
      controller._detectAndMatch=async(input,indices)=>{if(token!==state.session)return{targetIndex:-1,modelViewTransform:null};ar.__progressive?.beforeMatch();const match=await detectAndMatch(input,search.next(indices));search.matched(match.targetIndex);ar.__progressive?.matched(match.targetIndex);return match;};
      const trackAndUpdate=controller._trackAndUpdate.bind(controller);
      controller._trackAndUpdate=async(...args)=>token===state.session?trackAndUpdate(...args):null;
      assertActive();
      const {dimensions,matchingDataList}=controller.addImageTargetsFromBuffer(bytes);releaseTargetBuffer();
      if(staged){
        ar.__progressive=progressiveModule.createProgressiveTargets({manifest:staged,targets:bank.targets,matchingDataList,signal:abort.signal,
          decode:data=>new Compiler().importData(data),fetchBytes:progressiveModule.fetchPatch,
          apply:list=>controller.worker.postMessage({type:'setup',inputWidth:controller.inputWidth,inputHeight:controller.inputHeight,projectionTransform:controller.projectionTransform,debugMode:false,matchingDataList:list}),
          onStatus:text=>{if(token===state.session)$('#tracking-hint').textContent=text;}
        });
      }
      if(dimensions.length!==bank.targets.length)throw new Error('인식 구역 자료가 맞지 않아요. 다시 업데이트해 주세요.');
      ar.postMatrixs=dimensions.map(([width,height])=>new THREE.Matrix4().compose(new THREE.Vector3(width/2,height/2,0),new THREE.Quaternion(),new THREE.Vector3(width,width,width)));
      $('#tracking-status').textContent='이제 벽화를 비춰 주세요';
      await new Promise(resolve=>requestAnimationFrame(resolve));assertActive();window.MINDAR.IMAGE.tf.tidy(()=>controller.dummyRun(ar.video));assertActive();controller.processVideo(ar.video);
    };
    const entries=[],buttons=new Map(),pinFilter=createStablePins();
    ar.__pinFilter=pinFilter;
    const buttonFor=item=>{
      if(!buttons.has(item.id)){
        const b=point(item);b.hidden=true;$('#ar-points').append(b);buttons.set(item.id,b);
      }
      return buttons.get(item.id);
    };
    for(const target of bank.targets){
      const anchor=ar.addAnchor(target.targetIndex);
      // A small border allowance prevents overlapping targets from hiding a
      // visible neighbour's pin. Never extrapolate across the entire mural.
      const margin=target.width*.15;
      const items=mappedItems().filter(i=>{const x=i.mapping.x*state.catalog.wall.width,y=i.mapping.y*state.catalog.wall.height;return x>=target.x-margin&&x<=target.x+target.width+margin&&y>=target.y-margin&&y<=target.y+target.height+margin;});
      const dots=items.map(item=>{const b=buttonFor(item);return{item,button:b,local:new THREE.Vector3((item.mapping.x*state.catalog.wall.width-target.x)/target.width-.5,(target.height/2-(item.mapping.y*state.catalog.wall.height-target.y))/target.width,.005)};});
      entries.push({anchor,target,dots});
    }
    let timer;
    try{await Promise.race([ar.start(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('카메라 준비가 지연되고 있어요. 권한을 확인한 뒤 다시 시도해 주세요.')),45000);})]);}finally{clearTimeout(timer);}
    if(token!==state.session){disposeAR(ar);return;}
    $('#tracking-status').textContent='벽화를 천천히 비춰 주세요';
    $('#tracking-hint').textContent='친구와 주변 그림이 함께 보이도록 담아 주세요.';
    ar.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    const projected=new THREE.Vector3();
    let previousSequence=null,previousSource=null,previousSize='',wasShowing=false,visibleButtons=new Set();
    ar.renderer.setAnimationLoop(()=>{
      if(token!==state.session)return;
      const now=performance.now(),w=innerWidth,h=innerHeight,size=`${w}x${h}`;
      ar.scene.updateMatrixWorld(true);ar.camera.updateMatrixWorld(true);
      // A lost anchor may still be 'showing' while another acquires. maxTrack=1
      // gives one actual tracking source; never alternate between stale anchors.
      const entry=entries.find(e=>e.anchor.visible&&ar.controller?.trackingStates?.[e.target.targetIndex]?.isTracking);
      if(entry){
        const source=entry.target.targetIndex,sequence=entry.anchor.__poseSequence||0;
        if(source!==previousSource||sequence!==previousSequence||size!==previousSize){
          const points=[];
          for(const d of entry.dots){
            projected.copy(d.local).applyMatrix4(entry.anchor.group.matrixWorld).project(ar.camera);
            if(projected.z>=-1&&projected.z<=1)points.push({id:d.item.id,x:(projected.x+1)*w/2,y:(1-projected.y)*h/2});
          }
          pinFilter.observe({target:source,sequence,points,now,width:w,height:h});
          previousSource=source;previousSequence=sequence;previousSize=size;
        }
      }else pinFilter.lose(now);
      const stabilized=pinFilter.frame({
        now,left:24,right:w-24,top:$('#tracking-status').getBoundingClientRect().bottom+24,
        bottom:$('#tracking-hint').getBoundingClientRect().top-24,reduceOverlap:state.reduceOverlap
      });
      const pins=$('#art-dialog').open?[]:stabilized;
      const nextVisible=new Set();
      for(const pin of pins){
        const b=buttons.get(pin.id);nextVisible.add(b);
        // Transform-only movement avoids layout work for every moving number.
        const transform=`translate3d(${Math.round(pin.x*4)/4}px,${Math.round(pin.y*4)/4}px,0) translate(-50%,-50%)`;
        if(b.__pinTransform!==transform){b.style.transform=transform;b.__pinTransform=transform;}
        if(b.disabled===pin.interactive)b.disabled=!pin.interactive;
        if(b.hidden)b.hidden=false;
      }
      for(const b of visibleButtons)if(!nextVisible.has(b))b.hidden=true;
      visibleButtons=nextVisible;
      const showing=pins.some(pin=>pin.interactive);
      if(!$('#art-dialog').open&&showing!==wasShowing){
        $('#tracking-status').textContent=showing?'노란 번호를 눌러 보세요':'벽화를 천천히 비춰 주세요';
        wasShowing=showing;
      }
      ar.renderer.render(ar.scene,ar.camera);
    });
    $('#camera-message').textContent='';
  }catch(error){if(token===state.session){stopCamera();switchView('ready');$('#camera-message').textContent=error?.name==='AbortError'?'준비가 오래 걸리고 있어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.':cameraError(error);}else if(ar)disposeAR(ar);if(error?.name!=='AbortError')console.warn('camera',error);}
  finally{clearTimeout(downloadTimer);if(token!==state.session||abort.signal.aborted)releaseTargetBuffer();if(token===state.session||!state.starting){state.starting=false;button.disabled=false;button.innerHTML='카메라로 관람하기 <span aria-hidden="true">↗</span>';}}
}
function disposeAR(ar) {
  if(!ar)return;
  ar.__progressive?.dispose();
  ar.__pinFilter?.reset();
  ar.__releaseTargetBuffer?.();
  try{ar.renderer.setAnimationLoop(null);}catch{}
  try{ar.controller?.stopProcessVideo();}catch{}
  ar.video?.srcObject?.getTracks().forEach(t=>t.stop());ar.video?.remove();
  if(ar.__disposed)return;ar.__disposed=true;
  const controller=ar.controller;
  // Finish an outstanding frame before freeing its cached tensors. The bundled
  // controller's dispose() alone leaves its worker and GPU target images alive.
  try{controller?.workerMatchDone?.({targetIndex:-1,modelViewTransform:null});controller?.workerTrackDone?.({modelViewTransform:null});}catch{}
  setTimeout(()=>{
    try{controller?.dispose();controller?.worker?.terminate();}catch{}
    const tracker=controller?.tracker;
    for(const key of ['featurePointsListT','imagePixelsListT','imagePropertiesListT'])for(const tensor of tracker?.[key]||[])try{tensor.dispose();}catch{}
    for(const cache of Object.values(controller?.cropDetector?.detector?.tensorCaches||{}))for(const tensor of Object.values(cache))try{tensor.dispose();}catch{}
    try{const handle=controller?.inputLoader?.tempPixelHandle;if(handle)window.MINDAR.IMAGE.tf.backend().disposeData(handle.dataId);}catch{}
  },0);
  try{ar.renderer.dispose();ar.renderer.forceContextLoss();ar.renderer.domElement.remove();ar.cssRenderer.domElement.remove();}catch{}
  for(const handler of ar.__resizeHandlers||[])window.removeEventListener('resize',handler);
  if(ar.__url)URL.revokeObjectURL(ar.__url);
}
function stopCamera(){++state.session;state.starting=false;state.cameraAbort?.abort();state.cameraAbort=null;disposeAR(state.ar);state.ar=null;$('#ar-points').replaceChildren();$('#ar-container').replaceChildren();document.querySelectorAll('.topbar,#preview-banner,.skip-link').forEach(el=>el.inert=false);$('#start-camera').disabled=false;$('#start-camera').innerHTML='카메라로 관람하기 <span aria-hidden="true">↗</span>';}
$('#start-camera').onclick=startCamera;$('#stop-camera').onclick=()=>{stopCamera();switchView('ready');$('#camera-message').textContent='';};
$('#camera-map').onclick=()=>switchView('map');
$('#reduce-overlap').onclick=()=>{state.reduceOverlap=!state.reduceOverlap;$('#reduce-overlap').setAttribute('aria-pressed',String(state.reduceOverlap));};
$('#browse-wall').onclick=()=>switchView('map');$('#open-gallery').onclick=()=>switchView('gallery');
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#home-link').onclick=event=>{event.preventDefault();switchView('ready');};
$('#search').oninput=()=>{state.galleryPage=0;renderGallery();};$('#prev-page').onclick=()=>{state.galleryPage--;renderGallery();$('#gallery-title').scrollIntoView();};$('#next-page').onclick=()=>{state.galleryPage++;renderGallery();$('#gallery-title').scrollIntoView();};
for(const [selector,factor] of [['#zoom-in',1.4],['#zoom-out',1/1.4]])$(selector).onclick=()=>{state.zoom=Math.min(6,Math.max(1,state.zoom*factor));$('#map-canvas').style.height=`${state.zoom*100}%`;$('#zoom-label').textContent=`${Math.round(state.zoom*100)}%`;};
$('#close-art').onclick=closeArtwork;$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();
$('#intro-continue').onclick=closeIntro;$('#reload-app').onclick=()=>location.reload();
$('#skip-intro').onclick=closeIntro;$('#replay-intro').onclick=showIntro;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#intro').hidden)closeIntro();});
window.addEventListener('pagehide',()=>{stopCamera();state.guide?.pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.ar||state.starting){stopCamera();switchView('ready');$('#camera-message').textContent='화면을 떠나 카메라를 껐어요. 다시 시작하려면 버튼을 눌러 주세요.';}state.guide?.pause();}else if(!$('#intro').hidden)state.guide?.play();});
window.addEventListener('storage',event=>{if(preview&&event.key===DRAFT_KEY)location.reload();});
try{
  const [catalog,targets]=await Promise.all([json('./data/catalog.json'),json('./data/targets.json')]);state.catalog=catalog;state.targets=targets;
  if(preview){$('#preview-banner').hidden=false;try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY));if(validDraft(draft,catalog))state.catalog={...catalog,items:draft.items};}catch{}}
  state.catalog=worksheetTools.merge(state.catalog,new Map(catalog.items.filter(item=>item.worksheet).map(item=>[item.id,item.worksheet]))).catalog;
  state.catalog=window.YoyojinCatalogMigrations.removeLegacyCandidates(state.catalog).catalog;
  let seenIntro=false;try{seenIntro=sessionStorage.getItem('yoyojin.intro.seen')==='1';}catch{}
  if(!seenIntro&&new URLSearchParams(location.search).get('intro')!=='0')showIntro();
}catch(error){console.warn('catalog',error);$('#fatal').hidden=false;$('#start-camera').disabled=true;$('#reload-app').focus();}

const mapScroll=$('#map-scroll');let pan=null,suppressMapClick=false;
mapScroll.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;pan={id:event.pointerId,x:event.clientX,y:event.clientY,left:mapScroll.scrollLeft,top:mapScroll.scrollTop,moved:false};});
mapScroll.addEventListener('pointermove',event=>{if(!pan||event.pointerId!==pan.id)return;const dx=event.clientX-pan.x,dy=event.clientY-pan.y;if(!pan.moved&&Math.hypot(dx,dy)>5){pan.moved=true;mapScroll.setPointerCapture(event.pointerId);}if(pan.moved){event.preventDefault();mapScroll.scrollLeft=pan.left-dx;mapScroll.scrollTop=pan.top-dy;}});
const endPan=event=>{if(!pan||event.pointerId!==pan.id)return;suppressMapClick=pan.moved;pan=null;setTimeout(()=>{suppressMapClick=false;},0);};
mapScroll.addEventListener('pointerup',endPan);mapScroll.addEventListener('pointercancel',endPan);
mapScroll.addEventListener('click',event=>{if(suppressMapClick){event.preventDefault();event.stopPropagation();}},true);
