(function(){
  'use strict';

  const VERSION='20260818-unified-vod-player-v1';
  const BUFFER_GOAL_DESKTOP=60;
  const BUFFER_GOAL_MOBILE=30;
  const SEEK_EPSILON=0.75;
  const PREPARE_TIMEOUT_MS=12000;
  let sessionSeq=0;
  let activeSession=null;

  const isMobile=()=>{
    try{return typeof isMobilePlaybackClient==='function' ? !!isMobilePlaybackClient() : /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');}
    catch(_){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');}
  };

  const video=()=>document.getElementById('videoPlayer');

  function bufferedContains(v,time,pad=0.25){
    if(!v || !Number.isFinite(time))return false;
    try{
      for(let i=0;i<v.buffered.length;i++){
        if(time >= v.buffered.start(i)-pad && time <= v.buffered.end(i)+pad)return true;
      }
    }catch(_){ }
    return false;
  }

  function bufferAhead(v){
    if(!v)return 0;
    const t=Number(v.currentTime)||0;
    try{
      for(let i=0;i<v.buffered.length;i++){
        if(t >= v.buffered.start(i)-0.25 && t <= v.buffered.end(i)+0.25){
          return Math.max(0,v.buffered.end(i)-t);
        }
      }
    }catch(_){ }
    return 0;
  }

  function planMode(plan){
    const raw=String(plan?.mode || plan?.transport || '').toLowerCase();
    if(raw==='hls' || /\.m3u8(?:$|\?)/i.test(String(plan?.src||plan?.playUrl||'')))return 'hls';
    return raw || 'direct';
  }

  function sourceFromPlan(plan){
    return String(plan?.src || plan?.playUrl || plan?.finalPlayUrl || '');
  }

  function sessionStillCurrent(session){
    return !!session && activeSession===session && session.id===sessionSeq && !session.controller.signal.aborted;
  }

  function endSession(reason='superseded'){
    if(activeSession){
      try{activeSession.controller.abort(reason);}catch(_){ }
    }
    activeSession=null;
  }

  function beginSession(kind,identity,start=0){
    endSession('new unified VOD session');
    const session={
      id:++sessionSeq,
      kind,
      identity:String(identity||''),
      start:Math.max(0,Number(start)||0),
      controller:new AbortController(),
      plan:null,
      attached:false,
      createdAt:Date.now(),
      lastSeekTarget:Math.max(0,Number(start)||0),
      seeking:false
    };
    activeSession=session;
    return session;
  }

  function unifiedHlsOptions(){
    const mobile=isMobile();
    return {
      enableWorker:true,
      lowLatencyMode:false,
      startFragPrefetch:true,
      capLevelToPlayerSize:true,
      startLevel:-1,
      maxBufferLength:mobile?BUFFER_GOAL_MOBILE:BUFFER_GOAL_DESKTOP,
      maxMaxBufferLength:mobile?45:90,
      backBufferLength:30,
      maxBufferSize:mobile?48*1024*1024:96*1024*1024,
      maxBufferHole:0.5,
      highBufferWatchdogPeriod:3,
      nudgeOffset:0.1,
      nudgeMaxRetry:3,
      fragLoadingMaxRetry:4,
      manifestLoadingMaxRetry:3,
      levelLoadingMaxRetry:3
    };
  }

  function installUnifiedHlsPolicy(){
    if(typeof Hls!=='function' || Hls.__svUnifiedVodWrapped)return;
    const OriginalHls=Hls;
    function UnifiedHls(config={}){
      const mediaPlayback = !(config && config.lowLatencyMode===true);
      const merged=mediaPlayback ? {...unifiedHlsOptions(),...config,lowLatencyMode:false,startFragPrefetch:true} : config;
      return new OriginalHls(merged);
    }
    Object.setPrototypeOf(UnifiedHls,OriginalHls);
    UnifiedHls.prototype=OriginalHls.prototype;
    for(const key of Object.keys(OriginalHls)){
      try{UnifiedHls[key]=OriginalHls[key];}catch(_){ }
    }
    UnifiedHls.__svUnifiedVodWrapped=true;
    try{window.Hls=UnifiedHls;}catch(_){ }
  }

  async function withTimeout(promise,ms,signal){
    let timer;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Unified VOD plan timeout')),ms);
      signal?.addEventListener?.('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
    });
    try{return await Promise.race([promise,timeout]);}
    finally{clearTimeout(timer);}
  }

  async function getPlan(kind,identity,start,signal){
    const opts={forceHls:true,fallbackReason:'unified VOD',signal};
    if(kind==='ftp'){
      if(typeof fetchFtpPlaybackPlan!=='function')throw new Error('FTP playback planner unavailable');
      return withTimeout(fetchFtpPlaybackPlan(identity,start,opts),PREPARE_TIMEOUT_MS,signal);
    }
    if(typeof fetchLocalPlaybackPlan!=='function')throw new Error('Local playback planner unavailable');
    return withTimeout(fetchLocalPlaybackPlan(identity,start,opts),PREPARE_TIMEOUT_MS,signal);
  }

  async function attachPlan(session,plan,{autoplay=true,preserveTime=null}={}){
    if(!sessionStillCurrent(session))throw new DOMException('Stale unified VOD session','AbortError');
    const src=sourceFromPlan(plan);
    if(!src)throw new Error('Unified VOD planner returned no source');
    const mode=planMode(plan);
    session.plan={...plan,mode,src};
    const opts={
      playbackType:'media',
      fallbackReason:'unified VOD',
      scope:typeof beginPlaybackRequestScope==='function' ? beginPlaybackRequestScope('unified VOD attach') : null
    };
    if(typeof attachPlayerSource!=='function')throw new Error('Player source attachment unavailable');
    await attachPlayerSource(src,mode,opts);
    if(!sessionStillCurrent(session))throw new DOMException('Stale unified VOD session','AbortError');
    session.attached=true;
    const v=video();
    if(v){
      v.preload='auto';
      v._svUnifiedVodSessionId=session.id;
      v._svUnifiedVodKind=session.kind;
      v._svUnifiedVodIdentity=session.identity;
      if(Number.isFinite(preserveTime) && preserveTime>0 && bufferedContains(v,preserveTime)){
        try{v.currentTime=preserveTime;}catch(_){ }
      }
      if(autoplay && typeof svPlayVideo==='function')await svPlayVideo('unified VOD autoplay',{force:true});
    }
    return true;
  }

  async function startUnified(kind,identity,start=0,{autoplay=true}={}){
    const session=beginSession(kind,identity,start);
    const plan=await getPlan(kind,identity,session.start,session.controller.signal);
    if(!sessionStillCurrent(session))return false;
    await attachPlan(session,plan,{autoplay});
    return true;
  }

  async function unifiedSeek(target){
    const session=activeSession;
    const v=video();
    const t=Math.max(0,Number(target)||0);
    if(!session || !v)return false;
    session.lastSeekTarget=t;

    if(bufferedContains(v,t,SEEK_EPSILON)){
      try{v.currentTime=t;}catch(_){return false;}
      if(v.paused===false && typeof svPlayVideo==='function')svPlayVideo('unified buffered seek').catch(()=>{});
      return true;
    }

    if(session.seeking)return false;
    session.seeking=true;
    const shouldPlay=!v.paused || v._svPlaybackShouldPlay!==false;
    try{
      const plan=await getPlan(session.kind,session.identity,t,session.controller.signal);
      if(!sessionStillCurrent(session) || Math.abs(session.lastSeekTarget-t)>SEEK_EPSILON)return false;
      await attachPlan(session,plan,{autoplay:shouldPlay});
      return true;
    }finally{
      if(sessionStillCurrent(session))session.seeking=false;
    }
  }

  function wrapFtpStart(){
    if(typeof playFtpMovie!=='function' || playFtpMovie.__svUnifiedVod)return;
    const original=playFtpMovie;
    const wrapped=async function(streamUrl,name,...rest){
      try{
        if(!streamUrl)return original.apply(this,[streamUrl,name,...rest]);
        try{if(typeof showPlayer==='function')showPlayer(name||'');}catch(_){ }
        try{if(typeof setPlayerLoading==='function')setPlayerLoading(true);}catch(_){ }
        const start=(()=>{try{return Math.max(0,Number(playbackTime?.())||0);}catch(_){return 0;}})();
        await startUnified('ftp',streamUrl,start,{autoplay:true});
        return true;
      }catch(error){
        if(error?.name==='AbortError')return false;
        console.warn('[Unified VOD] FTP startup fallback',error);
        return original.apply(this,[streamUrl,name,...rest]);
      }
    };
    wrapped.__svUnifiedVod=true;
    wrapped.__svOriginal=original;
    playFtpMovie=wrapped;
  }

  function wrapLocalStart(){
    const candidates=['playMovie','playLocalMovie'];
    for(const key of candidates){
      let fn;
      try{fn=window[key];}catch(_){fn=null;}
      if(typeof fn!=='function' || fn.__svUnifiedVod)continue;
      const original=fn;
      const wrapped=async function(id,...rest){
        try{
          if(id===undefined || id===null)return original.apply(this,[id,...rest]);
          await startUnified('local',id,0,{autoplay:true});
          return true;
        }catch(error){
          if(error?.name==='AbortError')return false;
          console.warn('[Unified VOD] local startup fallback',error);
          return original.apply(this,[id,...rest]);
        }
      };
      wrapped.__svUnifiedVod=true;
      wrapped.__svOriginal=original;
      try{window[key]=wrapped;}catch(_){ }
    }
  }

  function wrapSeekFunctions(){
    if(typeof ftpSeekTo==='function' && !ftpSeekTo.__svUnifiedVod){
      const original=ftpSeekTo;
      const wrapped=async function(seconds){
        if(activeSession?.kind==='ftp')return unifiedSeek(seconds);
        return original.apply(this,arguments);
      };
      wrapped.__svUnifiedVod=true;
      wrapped.__svOriginal=original;
      ftpSeekTo=wrapped;
    }

    if(typeof seekBy==='function' && !seekBy.__svUnifiedVod){
      const original=seekBy;
      const wrapped=function(delta){
        const v=video();
        if(activeSession && v){
          const target=Math.max(0,Math.min(Number.isFinite(v.duration)?v.duration:Infinity,(Number(v.currentTime)||0)+(Number(delta)||0)));
          if(bufferedContains(v,target,SEEK_EPSILON)){
            v.currentTime=target;
            return;
          }
          unifiedSeek(target).catch(()=>{});
          return;
        }
        return original.apply(this,arguments);
      };
      wrapped.__svUnifiedVod=true;
      wrapped.__svOriginal=original;
      seekBy=wrapped;
    }
  }

  function stopOnClose(){
    if(typeof closePlayer==='function' && !closePlayer.__svUnifiedVod){
      const original=closePlayer;
      const wrapped=function(){
        endSession('player closed');
        return original.apply(this,arguments);
      };
      wrapped.__svUnifiedVod=true;
      wrapped.__svOriginal=original;
      closePlayer=wrapped;
    }
  }

  function addBufferTelemetry(){
    const v=video();
    if(!v || v._svUnifiedTelemetry)return;
    v._svUnifiedTelemetry=true;
    const update=()=>{
      const ahead=bufferAhead(v);
      v.dataset.bufferAhead=ahead.toFixed(1);
      v.dataset.bufferGoal=String(isMobile()?BUFFER_GOAL_MOBILE:BUFFER_GOAL_DESKTOP);
    };
    v.addEventListener('progress',update,{passive:true});
    v.addEventListener('timeupdate',update,{passive:true});
    v.addEventListener('playing',update,{passive:true});
  }

  function install(){
    installUnifiedHlsPolicy();
    wrapFtpStart();
    wrapLocalStart();
    wrapSeekFunctions();
    stopOnClose();
    addBufferTelemetry();
    const v=video();
    if(v)v.preload='auto';
    window.__SV_UNIFIED_VOD_PLAYER_V1={
      version:VERSION,
      startFtp:(url,start=0)=>startUnified('ftp',url,start,{autoplay:true}),
      startLocal:(id,start=0)=>startUnified('local',id,start,{autoplay:true}),
      seek:unifiedSeek,
      active:()=>activeSession,
      bufferAhead:()=>bufferAhead(video()),
      bufferGoal:()=>isMobile()?BUFFER_GOAL_MOBILE:BUFFER_GOAL_DESKTOP,
      bufferedContains:t=>bufferedContains(video(),Number(t)||0)
    };
  }

  install();
  window.addEventListener('load',install,{once:true});
})();
