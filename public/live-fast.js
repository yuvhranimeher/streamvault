(function(){
  window.openLiveChannel = function(channelId, channelName){
    const t0 = performance.now();
    const liveDebug = (...args) => {
      try {
        if (typeof SV_DEBUG_LOGS !== 'undefined' && SV_DEBUG_LOGS) {
          console.log('[Live TV]', Math.round(performance.now() - t0) + 'ms', ...args);
        }
      } catch {}
    };

    isLiveMode=true;
    currentStreamId=null;
    liveDebug('open', { channelId, channelName });

    if(hlsInstance){try{hlsInstance.destroy();}catch{} hlsInstance=null;}
    if(typeof vid._svLiveCleanup==='function'){
      try{vid._svLiveCleanup();}catch{}
      vid._svLiveCleanup=null;
    }

    clearInterval(vid._pi);
    vid.pause();
    vid.removeAttribute('src');
    try{vid.load();}catch{}
    vid.querySelectorAll('track').forEach(t=>t.remove());

    if(typeof clearSubtitleOverlay==='function')clearSubtitleOverlay();
    if(typeof closeAllDropdowns==='function')closeAllDropdowns();
    if(typeof hidePlayerNotice==='function')hidePlayerNotice();
    if(typeof hideSeriesPlayerBar==='function')hideSeriesPlayerBar();

    const title=document.getElementById('playerTitle');
    const sub=document.getElementById('playerSubTitle');
    const badge=document.getElementById('playerLiveBadge');
    const progress=document.getElementById('progressWrap');
    const spinner=document.getElementById('playerSpinner');

    if(title)title.textContent=channelName;
    if(sub)sub.textContent='Starting live stream...';
    badge?.classList.add('show');
    progress?.classList.add('live-mode');
    document.getElementById('timeDur').textContent='LIVE';
    document.getElementById('timeNow').textContent='';
    document.getElementById('playerModal').classList.add('open');
    spinner?.classList.add('on');
    document.body.style.overflow='hidden';
    if(typeof showUI==='function')showUI();

    const src='/live/' + encodeURIComponent(channelId) + '/playlist.m3u8';
    let restartCount=0;
    let networkRecoveryCount=0;
    let mediaRecoveryCount=0;
    let started=false;
    let watchdog=null;
    let stallTimer=null;

    function clearStallTimer(){
      if(stallTimer){clearTimeout(stallTimer); stallTimer=null;}
    }

    function hideSpin(){
      started=true;
      spinner?.classList.remove('on');
      if(sub)sub.textContent='';
      if(watchdog)clearTimeout(watchdog);
      clearStallTimer();
    }

    function hardRestart(force=false){
      if((started && !force) || restartCount>=2)return;
      restartCount++;
      clearStallTimer();
      if(sub)sub.textContent='Retrying live stream...';
      setTimeout(()=>start(), 400);
    }

    function nudgeLiveEdge(reason){
      liveDebug('live edge nudge', {reason});
      clearStallTimer();
      try{
        const pos = hlsInstance?.liveSyncPosition;
        if(Number.isFinite(pos) && Math.abs((vid.currentTime || 0) - pos) > 1.5){
          vid.currentTime = Math.max(0, pos);
        }
        hlsInstance?.startLoad?.(-1);
      }catch{}
      try{vid.play().catch(()=>{});}catch{}
    }

    function armStallTimer(reason){
      if(stallTimer)return;
      stallTimer=setTimeout(()=>nudgeLiveEdge(reason), 8000);
    }

    function start(){
      if(hlsInstance){try{hlsInstance.destroy();}catch{} hlsInstance=null;}

      started=false;
      networkRecoveryCount=0;
      mediaRecoveryCount=0;
      clearStallTimer();
      spinner?.classList.add('on');

      if(watchdog)clearTimeout(watchdog);
      watchdog=setTimeout(hardRestart, 22000);
      liveDebug('attach source', src);

      if(typeof Hls!=='undefined' && Hls.isSupported()){
        hlsInstance=new Hls({
          enableWorker:true,
          startPosition:-1,

          // Stability mode: stay behind live edge instead of chasing the newest segment.
          lowLatencyMode:false,
          liveSyncDurationCount:3,
          liveMaxLatencyDurationCount:9,
          maxLiveSyncPlaybackRate:1.15,

          // Enough buffer to stop random freezes.
          maxBufferLength:24,
          maxMaxBufferLength:45,
          backBufferLength:6,
          maxBufferHole:0.8,

          // Let hls.js choose safely after the server rewrites upstream playlist URLs.
          testBandwidth:true,
          startFragPrefetch:true,
          capLevelToPlayerSize:true,

          manifestLoadingTimeOut:20000,
          levelLoadingTimeOut:20000,
          fragLoadingTimeOut:30000,
          manifestLoadingMaxRetry:6,
          levelLoadingMaxRetry:6,
          fragLoadingMaxRetry:10,
          manifestLoadingRetryDelay:700,
          levelLoadingRetryDelay:700,
          fragLoadingRetryDelay:700
        });

        hlsInstance.on(Hls.Events.MEDIA_ATTACHED,()=>hlsInstance.loadSource(src));

        hlsInstance.on(Hls.Events.MANIFEST_LOADED,(e,data)=>{
          liveDebug('manifest loaded', {
            url:data?.url || src,
            levels:data?.levels?.length || 0,
            stats:data?.stats || null
          });
        });

        hlsInstance.on(Hls.Events.LEVEL_LOADED,(e,data)=>{
          liveDebug('level loaded', {
            url:data?.details?.url || '',
            live:data?.details?.live,
            fragments:data?.details?.fragments?.length || 0
          });
        });

        hlsInstance.on(Hls.Events.FRAG_LOADING,(e,data)=>{
          liveDebug('frag loading', data?.frag?.url || '');
        });

        hlsInstance.on(Hls.Events.FRAG_LOADED,(e,data)=>{
          liveDebug('frag loaded', {
            url:data?.frag?.url || '',
            stats:data?.stats || null
          });
        });

        hlsInstance.on(Hls.Events.MANIFEST_PARSED,()=>{
          liveDebug('manifest parsed');
          vid.play().catch(()=>{});
        });

        hlsInstance.on(Hls.Events.FRAG_BUFFERED,()=>{
          liveDebug('frag buffered');
          hideSpin();
          try{vid.play().catch(()=>{});}catch{}
        });

        hlsInstance.on(Hls.Events.ERROR,(e,data)=>{
          if(!data)return;
          liveDebug(data.fatal ? 'fatal hls error' : 'hls warning', {
            type:data.type,
            details:data.details,
            fatal:data.fatal,
            response:data.response || null
          });

          if(!data.fatal){
            if(data.details && /buffer|stall/i.test(data.details)){
              armStallTimer(data.details);
              try{vid.play().catch(()=>{});}catch{}
            }
            return;
          }

          if(data.type===Hls.ErrorTypes.NETWORK_ERROR){
            if(networkRecoveryCount++ < 1){
              try{hlsInstance.startLoad(-1); return;}catch{}
            }
            hardRestart(true);
            return;
          }

          if(data.type===Hls.ErrorTypes.MEDIA_ERROR){
            if(mediaRecoveryCount++ < 1){
              try{hlsInstance.recoverMediaError(); return;}catch{}
            }
            hardRestart(true);
            return;
          }

          hardRestart(true);
        });

        hlsInstance.attachMedia(vid);
        return;
      }

      if(vid.canPlayType('application/vnd.apple.mpegurl')){
        liveDebug('native hls attach', src);
        vid.src=src;
        vid.play().catch(()=>{});
        return;
      }

      loadHlsScript().then(ok=>{
        if(ok && typeof Hls!=='undefined' && Hls.isSupported()) start();
        else {
          spinner?.classList.remove('on');
          if(typeof showToast==='function')showToast('HLS not supported');
        }
      });
    }

    const onPlaying=()=>{ liveDebug('video playing'); hideSpin(); };
    const onCanplay=()=>{ liveDebug('video canplay'); hideSpin(); };
    const onLoadedData=()=>{ liveDebug('video loadeddata'); hideSpin(); };
    const onWaiting=()=>{ liveDebug('video waiting'); armStallTimer('waiting'); };
    const onStalled=()=>{ liveDebug('video stalled'); armStallTimer('stalled'); };
    vid.addEventListener('playing', onPlaying);
    vid.addEventListener('canplay', onCanplay);
    vid.addEventListener('loadeddata', onLoadedData);
    vid.addEventListener('waiting', onWaiting);
    vid.addEventListener('stalled', onStalled);
    vid._svLiveCleanup=()=>{
      clearStallTimer();
      vid.removeEventListener('playing', onPlaying);
      vid.removeEventListener('canplay', onCanplay);
      vid.removeEventListener('loadeddata', onLoadedData);
      vid.removeEventListener('waiting', onWaiting);
      vid.removeEventListener('stalled', onStalled);
    };

    start();
  };
})();
