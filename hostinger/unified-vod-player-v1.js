(function(){
  'use strict';

  const VERSION='20260818-unified-vod-player-v1.1';
  const BUFFER_GOAL_DESKTOP=60;
  const BUFFER_GOAL_MOBILE=30;
  const PREFLIGHT_TTL_MS=5*60*1000;
  const preflightCache=new Map();

  const video=()=>document.getElementById('videoPlayer');
  const isMobile=()=>{
    try{return typeof isMobilePlaybackClient==='function' ? !!isMobilePlaybackClient() : /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');}
    catch(_){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');}
  };

  function bufferedContains(v,time,pad=.5){
    if(!v || !Number.isFinite(time))return false;
    try{
      for(let i=0;i<v.buffered.length;i++){
        if(time>=v.buffered.start(i)-pad && time<=v.buffered.end(i)+pad)return true;
      }
    }catch(_){ }
    return false;
  }

  function seekableContains(v,time,pad=.5){
    if(!v || !Number.isFinite(time))return false;
    try{
      for(let i=0;i<v.seekable.length;i++){
        if(time>=v.seekable.start(i)-pad && time<=v.seekable.end(i)+pad)return true;
      }
    }catch(_){ }
    return false;
  }

  function bufferAhead(v){
    if(!v)return 0;
    const t=Number(v.currentTime)||0;
    try{
      for(let i=0;i<v.buffered.length;i++){
        if(t>=v.buffered.start(i)-.25 && t<=v.buffered.end(i)+.25){
          return Math.max(0,v.buffered.end(i)-t);
        }
      }
    }catch(_){ }
    return 0;
  }

  function installPreloadPolicy(){
    const v=video();
    if(v)v.preload='auto';
  }

  function installVodHlsBufferPolicy(){
    if(typeof Hls!=='function' || Hls.__svUnifiedVodWrapped)return;
    const Original=Hls;
    function WrappedHls(config={}){
      const isLive=!!(config && config.lowLatencyMode===true);
      if(isLive)return new Original(config);
      const mobile=isMobile();
      return new Original({
        enableWorker:true,
        lowLatencyMode:false,
        startFragPrefetch:true,
        capLevelToPlayerSize:true,
        startLevel:-1,
        maxBufferLength:mobile?BUFFER_GOAL_MOBILE:BUFFER_GOAL_DESKTOP,
        maxMaxBufferLength:mobile?45:90,
        backBufferLength:30,
        maxBufferSize:mobile?48*1024*1024:96*1024*1024,
        maxBufferHole:.5,
        highBufferWatchdogPeriod:3,
        nudgeOffset:.1,
        nudgeMaxRetry:3,
        fragLoadingMaxRetry:4,
        manifestLoadingMaxRetry:3,
        levelLoadingMaxRetry:3,
        ...config,
        lowLatencyMode:false,
        startFragPrefetch:true,
        maxBufferLength:Math.max(Number(config?.maxBufferLength)||0,mobile?BUFFER_GOAL_MOBILE:BUFFER_GOAL_DESKTOP),
        maxMaxBufferLength:Math.max(Number(config?.maxMaxBufferLength)||0,mobile?45:90)
      });
    }
    Object.setPrototypeOf(WrappedHls,Original);
    WrappedHls.prototype=Original.prototype;
    for(const key of Object.getOwnPropertyNames(Original)){
      if(['length','name','prototype'].includes(key))continue;
      try{Object.defineProperty(WrappedHls,key,Object.getOwnPropertyDescriptor(Original,key));}catch(_){ }
    }
    WrappedHls.__svUnifiedVodWrapped=true;
    try{window.Hls=WrappedHls;}catch(_){ }
  }

  function installBufferedSeekPolicy(){
    if(typeof seekToTime!=='function' || seekToTime.__svUnifiedVod)return;
    const original=seekToTime;
    const wrapped=function(seconds){
      const v=video();
      const duration=Number(v?.duration)||0;
      const target=duration?Math.max(0,Math.min(duration,Number(seconds)||0)):Math.max(0,Number(seconds)||0);
      const isVod=!!v && !(typeof isLiveMode!=='undefined' && isLiveMode);

      // Universal rule: never rebuild/re-attach a source for a seek that the
      // current media session can already satisfy. This is the Netflix/YouTube
      // behavior for +10/-10 and short timeline jumps inside the buffered area.
      if(isVod && (bufferedContains(v,target) || seekableContains(v,target))){
        try{
          v.currentTime=target;
          if(v._svPlaybackShouldPlay!==false && v.paused && typeof svPlayVideo==='function'){
            svPlayVideo('unified VOD buffered seek').catch(()=>{});
          }
          return;
        }catch(_){ }
      }
      return original.apply(this,arguments);
    };
    wrapped.__svUnifiedVod=true;
    wrapped.__svOriginal=original;
    seekToTime=wrapped;
  }

  function mediaPreflightKey(item){
    if(!item)return '';
    return String(item.streamUrl || item.id || item.streamId || item.file || item.name || '');
  }

  async function preflightItem(item){
    if(!item)return null;
    const key=mediaPreflightKey(item);
    if(!key)return null;
    const cached=preflightCache.get(key);
    if(cached && Date.now()-cached.time<PREFLIGHT_TTL_MS)return cached.promise;

    const promise=(async()=>{
      let target=item;
      try{
        if(!target.streamUrl && typeof hydrateMoviePlayback==='function'){
          target=await hydrateMoviePlayback(target) || target;
        }
      }catch(_){ }

      try{
        if(target.streamUrl){
          const infoParams=new URLSearchParams({
            url:String(target.streamUrl),
            playbackType:'media',
            startup:'1'
          });
          const infoUrl=`${API_BASE}/api/ftp/media-info?${infoParams.toString()}`;
          await fetch(infoUrl,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);

          // Warm the playback decision and server-side probe caches. The plan
          // call does not attach a source or begin playback.
          const planParams=new URLSearchParams({
            url:String(target.streamUrl),
            plan:'1',
            playbackType:'media',
            fallbackReason:'unified VOD preflight'
          });
          await fetch(`${API_BASE}/api/playback/ftp?${planParams.toString()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
          return target;
        }

        const id=target.streamId ?? target.id;
        if(id!==undefined && id!==null && /^\d+$/.test(String(id))){
          await fetch(`${API_BASE}/api/media-info/${encodeURIComponent(id)}?playbackType=media`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
          await fetch(`${API_BASE}/api/playback/local/${encodeURIComponent(id)}?playbackType=media&fallbackReason=unified%20VOD%20preflight`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
        }
      }catch(_){ }
      return target;
    })();

    preflightCache.set(key,{time:Date.now(),promise});
    if(preflightCache.size>80){
      const first=preflightCache.keys().next().value;
      preflightCache.delete(first);
    }
    return promise;
  }

  function installDetailPreflight(){
    if(typeof openMovieDetail==='function' && !openMovieDetail.__svUnifiedVod){
      const original=openMovieDetail;
      const wrapped=function(key){
        let item=null;
        try{item=_movieDetailRegistry.get(key) || null;}catch(_){ }
        const out=original.apply(this,arguments);
        if(item)queueMicrotask(()=>preflightItem(item).catch(()=>{}));
        return out;
      };
      wrapped.__svUnifiedVod=true;
      wrapped.__svOriginal=original;
      openMovieDetail=wrapped;
    }
  }

  function installTelemetry(){
    const v=video();
    if(!v || v._svUnifiedVodTelemetry)return;
    v._svUnifiedVodTelemetry=true;
    const update=()=>{
      v.dataset.bufferAhead=bufferAhead(v).toFixed(1);
      v.dataset.bufferGoal=String(isMobile()?BUFFER_GOAL_MOBILE:BUFFER_GOAL_DESKTOP);
    };
    for(const event of ['progress','timeupdate','playing','waiting','seeked'])v.addEventListener(event,update,{passive:true});
  }

  function install(){
    installPreloadPolicy();
    installVodHlsBufferPolicy();
    installBufferedSeekPolicy();
    installDetailPreflight();
    installTelemetry();
    window.__SV_UNIFIED_VOD_PLAYER_V1={
      version:VERSION,
      preflight:preflightItem,
      bufferAhead:()=>bufferAhead(video()),
      bufferGoal:()=>isMobile()?BUFFER_GOAL_MOBILE:BUFFER_GOAL_DESKTOP,
      bufferedContains:t=>bufferedContains(video(),Number(t)||0),
      seekableContains:t=>seekableContains(video(),Number(t)||0)
    };
  }

  install();
  window.addEventListener('load',install,{once:true});
})();
