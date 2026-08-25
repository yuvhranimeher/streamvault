/* STREAMVAULT_VOD_BUFFER_ENGINE_V2 — buffer only after explicit playback */
(function(){
  'use strict';
  if(window.__SV_VOD_BUFFER_ENGINE_V1)return;
  window.__SV_VOD_BUFFER_ENGINE_V1=true;
  window.__SV_VOD_BUFFER_ENGINE_VERSION='20260825-play-click-only-v2';

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

  // Detail windows never probe media, resolve playback plans, or warm HLS.
  // The existing playback functions perform this work after an explicit Play.

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

