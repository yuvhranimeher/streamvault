/* STREAMVAULT_VOD_BUFFER_ENGINE_V1 — one buffering rule for every VOD title */
(function(){
  'use strict';
  if(window.__SV_VOD_BUFFER_ENGINE_V1)return;
  window.__SV_VOD_BUFFER_ENGINE_V1=true;
  window.__SV_VOD_BUFFER_ENGINE_VERSION='20260818-vod-buffer-engine-v1';

  const video=document.getElementById('videoPlayer');
  if(!video)return;

  video.preload='auto';
  video.setAttribute('preload','auto');

  const ftpPlanCache=new Map();
  const localPlanCache=new Map();
  const primeInflight=new Map();
  let lastProgressAt=performance.now();
  let lastPlaybackTime=0;

  function now(){return performance.now();}
  function mobile(){
    try{return typeof isMobilePlaybackClient==='function' ? !!isMobilePlaybackClient() : /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');}
    catch(_){return false;}
  }
  function vodActive(){
    try{return !(typeof isLiveMode!=='undefined' && isLiveMode);}
    catch(_){return true;}
  }
  function currentGlobalTime(){
    const offset=Number(video._sourceOffset)||0;
    return Math.max(0,offset+(Number(video.currentTime)||0));
  }
  function bufferedAhead(){
    const t=Number(video.currentTime)||0;
    try{
      for(let i=0;i<video.buffered.length;i++){
        if(video.buffered.start(i)<=t+.05 && video.buffered.end(i)>=t-.05){
          return Math.max(0,video.buffered.end(i)-t);
        }
      }
    }catch(_){ }
    return 0;
  }
  function targetIsBuffered(globalTarget){
    const localTarget=Number(globalTarget)-(Number(video._sourceOffset)||0);
    if(!Number.isFinite(localTarget)||localTarget<0)return false;
    try{
      for(let i=0;i<video.buffered.length;i++){
        if(video.buffered.start(i)<=localTarget+.15 && video.buffered.end(i)>=localTarget-.15){
          return localTarget;
        }
      }
    }catch(_){ }
    return false;
  }

  function noteProgress(){
    const t=currentGlobalTime();
    if(Math.abs(t-lastPlaybackTime)>.12){
      lastPlaybackTime=t;
      lastProgressAt=now();
    }
  }
  video.addEventListener('timeupdate',noteProgress,{passive:true});
  video.addEventListener('playing',()=>{lastPlaybackTime=currentGlobalTime();lastProgressAt=now();},{passive:true});
  video.addEventListener('seeked',()=>{lastPlaybackTime=currentGlobalTime();lastProgressAt=now();},{passive:true});

  // Never destroy a good buffer for a +/-10s or timeline seek that is already downloaded.
  try{
    const previousSeekToTime=window.seekToTime;
    if(typeof previousSeekToTime==='function'){
      window.seekToTime=function unifiedBufferedSeek(seconds){
        const target=Math.max(0,Number(seconds)||0);
        if(vodActive()){
          let ftp=false;
          try{ftp=!!(typeof _ftpStreamUrl!=='undefined' && _ftpStreamUrl);}catch(_){ }
          if(ftp){
            const localTarget=targetIsBuffered(target);
            if(localTarget!==false){
              try{
                video.currentTime=localTarget;
                if(typeof schedulePlayerProgressRender==='function')schedulePlayerProgressRender(target,typeof playerDuration==='function'?playerDuration():0,{force:true});
                if(video._svPlaybackShouldPlay!==false && video.paused){
                  if(typeof svPlayVideo==='function')svPlayVideo('buffered seek',{force:true,onError:()=>false}).catch(()=>{});
                  else video.play().catch(()=>{});
                }
                return;
              }catch(_){ }
            }
          }
        }
        return previousSeekToTime.apply(this,arguments);
      };
    }
  }catch(_){ }

  // Transient waiting events must not replace the source and throw away downloaded data.
  try{
    const previousSmoothSwitch=window.switchToSmoothPlaybackProfile;
    if(typeof previousSmoothSwitch==='function'){
      window.switchToSmoothPlaybackProfile=async function unifiedHardStallOnly(reason='buffering'){
        if(!vodActive())return previousSmoothSwitch.apply(this,arguments);
        const ahead=bufferedAhead();
        const stalledFor=now()-lastProgressAt;
        if(ahead>.20)return false;
        if(stalledFor<8000)return false;
        if(currentGlobalTime()<10)return false;
        return previousSmoothSwitch.apply(this,arguments);
      };
    }
  }catch(_){ }

  // HLS VOD keeps a large forward buffer. Live TV remains untouched.
  function tuneHls(){
    if(!vodActive())return;
    let hls=null;
    try{if(typeof hlsInstance!=='undefined')hls=hlsInstance;}catch(_){ }
    if(!hls?.config)return;
    const c=hls.config;
    const isMobile=mobile();
    c.maxBufferLength=Math.max(Number(c.maxBufferLength)||0,isMobile?45:90);
    c.maxMaxBufferLength=Math.max(Number(c.maxMaxBufferLength)||0,isMobile?90:180);
    c.backBufferLength=Math.max(Number(c.backBufferLength)||0,30);
    c.maxBufferSize=Math.max(Number(c.maxBufferSize)||0,isMobile?48*1024*1024:128*1024*1024);
    c.maxBufferHole=Math.max(Number(c.maxBufferHole)||0,.5);
    if('startFragPrefetch' in c)c.startFragPrefetch=true;
  }
  const hlsTuneTimer=setInterval(tuneHls,500);
  window.addEventListener('pagehide',()=>clearInterval(hlsTuneTimer),{once:true});
  video.addEventListener('waiting',()=>{
    if(!vodActive())return;
    tuneHls();
    let hls=null;
    try{if(typeof hlsInstance!=='undefined')hls=hlsInstance;}catch(_){ }
    if(hls && bufferedAhead()<.2){try{hls.startLoad();}catch(_){ }}
  },{passive:true});

  function cleanPlanOptions(options){
    const out={};
    for(const key of ['forceHls','forceAudio','forceRemux','forceProxy','quality','audio','audioStream']){
      if(options?.[key]!==undefined&&options?.[key]!==null)out[key]=options[key];
    }
    return out;
  }
  function ftpKey(url,start,options){return String(url)+'|'+Number(start||0).toFixed(2)+'|'+JSON.stringify(cleanPlanOptions(options));}
  function localKey(id,start,options){return String(id)+'|'+Number(start||0).toFixed(2)+'|'+JSON.stringify(cleanPlanOptions(options));}

  // Cache playback-plan requests performed while the details window is open.
  try{
    const previousFetchFtpPlan=window.fetchFtpPlaybackPlan;
    if(typeof previousFetchFtpPlan==='function'){
      window.fetchFtpPlaybackPlan=async function cachedFtpPlaybackPlan(url,start=0,options={}){
        const key=ftpKey(url,start,options);
        if(Number(start||0)<.01 && ftpPlanCache.has(key))return ftpPlanCache.get(key);
        const plan=await previousFetchFtpPlan.apply(this,arguments);
        if(Number(start||0)<.01 && plan?.src)ftpPlanCache.set(key,plan);
        return plan;
      };
      window.__svOriginalFetchFtpPlaybackPlan=previousFetchFtpPlan;
    }
  }catch(_){ }
  try{
    const previousFetchLocalPlan=window.fetchLocalPlaybackPlan;
    if(typeof previousFetchLocalPlan==='function'){
      window.fetchLocalPlaybackPlan=async function cachedLocalPlaybackPlan(id,start=0,options={}){
        const key=localKey(id,start,options);
        if(Number(start||0)<.01 && localPlanCache.has(key))return localPlanCache.get(key);
        const plan=await previousFetchLocalPlan.apply(this,arguments);
        if(Number(start||0)<.01 && plan?.src)localPlanCache.set(key,plan);
        return plan;
      };
    }
  }catch(_){ }

  async function warmHls(plan){
    if(!plan?.src||String(plan.mode||'').toLowerCase()!=='hls')return;
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),6000);
      const response=await fetch(plan.src,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/vnd.apple.mpegurl,application/json;q=.9,*/*;q=.8'}});
      if(response.ok)await response.text();
      clearTimeout(timer);
    }catch(_){ }
  }

  async function primeFtp(url){
    const source=String(url||'').trim();
    if(!source)return;
    const key='ftp|'+source;
    if(primeInflight.has(key))return primeInflight.get(key);
    const task=(async()=>{
      let info=null;
      try{
        if(typeof svFetchMediaInfoData==='function'&&typeof svFtpAudioInfoUrl==='function'){
          info=await svFetchMediaInfoData(svFtpAudioInfoUrl(source),7000).catch(()=>null);
        }
      }catch(_){ }
      let options={};
      try{if(info&&typeof startupPlaybackOptions==='function')options=startupPlaybackOptions(info,source)||{};}catch(_){ }
      try{
        if(typeof window.fetchFtpPlaybackPlan==='function'){
          const plan=await window.fetchFtpPlaybackPlan(source,0,{...options,fallbackReason:'detail preload'});
          await warmHls(plan);
        }
      }catch(_){ }
    })().finally(()=>primeInflight.delete(key));
    primeInflight.set(key,task);
    return task;
  }

  async function primeLocal(id,item={}){
    if(id===undefined||id===null||id==='')return;
    const key='local|'+String(id);
    if(primeInflight.has(key))return primeInflight.get(key);
    const task=(async()=>{
      let info=null;
      try{
        if(typeof svFetchMediaInfoData==='function'&&typeof svLocalAudioInfoUrl==='function'){
          info=await svFetchMediaInfoData(svLocalAudioInfoUrl(id),7000).catch(()=>null);
        }
      }catch(_){ }
      let options={};
      try{if(info&&typeof startupPlaybackOptions==='function')options=startupPlaybackOptions(info,item?.file||item?.name||'')||{};}catch(_){ }
      try{
        if(typeof window.fetchLocalPlaybackPlan==='function'){
          const plan=await window.fetchLocalPlaybackPlan(id,0,{...options,fallbackReason:'detail preload'});
          await warmHls(plan);
        }
      }catch(_){ }
    })().finally(()=>primeInflight.delete(key));
    primeInflight.set(key,task);
    return task;
  }

  function primeEpisode(ep){
    if(!ep)return;
    if(ep.streamUrl)return primeFtp(ep.streamUrl);
    if(ep.streamId!==undefined&&ep.streamId!==null)return primeLocal(ep.streamId,ep);
  }
  function firstEpisode(show){
    const seasons=show?.seasons||{};
    const keys=Object.keys(seasons).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    for(const season of keys){
      const eps=Array.isArray(seasons[season])?seasons[season]:[];
      if(eps.length)return eps[0];
    }
    return null;
  }
  async function primeItem(item,type=''){
    if(!item)return;
    const kind=String(type||item.type||item.mediaType||'').toLowerCase();
    if(kind==='tv'||kind==='series'||kind==='show'||item.seasons){
      const ep=firstEpisode(item);
      if(ep)return primeEpisode(ep);
      setTimeout(()=>{
        try{
          const current=(typeof currentShow!=='undefined'&&currentShow)||item;
          primeEpisode(firstEpisode(current));
        }catch(_){ }
      },350);
      return;
    }
    let resolved=item;
    try{
      if(!resolved.streamUrl&&typeof window.hydrateMoviePlayback==='function')resolved=await window.hydrateMoviePlayback(item)||item;
    }catch(_){ }
    if(resolved?.streamUrl)return primeFtp(resolved.streamUrl);
    if(resolved?.streamId!==undefined&&resolved?.streamId!==null)return primeLocal(resolved.streamId,resolved);
  }

  try{
    const previousOpenMediaModal=window.openMediaModal;
    if(typeof previousOpenMediaModal==='function'){
      window.openMediaModal=function bufferedOpenMediaModal(item,requestedType=''){
        const result=previousOpenMediaModal.apply(this,arguments);
        queueMicrotask(()=>primeItem(item,requestedType));
        return result;
      };
    }
  }catch(_){ }

  function episodeFromCard(card){
    if(!card)return null;
    const key=String(card.id||'').replace(/^epcard-/,'');
    try{
      const show=typeof currentShow!=='undefined'?currentShow:null;
      for(const eps of Object.values(show?.seasons||{})){
        for(const ep of (Array.isArray(eps)?eps:[])){
          if(key&&String(ep?.streamId??'')===key)return ep;
        }
      }
    }catch(_){ }
    return null;
  }
  document.addEventListener('pointerover',event=>{
    const card=event.target?.closest?.('.ep-card');
    if(card)primeEpisode(episodeFromCard(card));
  },{capture:true,passive:true});
  document.addEventListener('pointerdown',event=>{
    const card=event.target?.closest?.('.ep-card');
    if(card)primeEpisode(episodeFromCard(card));
  },{capture:true,passive:true});

  window.__SV_VOD_BUFFER_STATS=()=>({
    version:window.__SV_VOD_BUFFER_ENGINE_VERSION,
    preload:video.preload,
    bufferedAhead:Number(bufferedAhead().toFixed(2)),
    currentTime:Number(currentGlobalTime().toFixed(2)),
    stalledMs:Math.round(now()-lastProgressAt),
    ftpPlans:ftpPlanCache.size,
    localPlans:localPlanCache.size
  });
})();
