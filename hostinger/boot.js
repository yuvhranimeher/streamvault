(function(){
  'use strict';

  // 2026-08-17 playback hotfix: codec-aware FTP startup + stale seek protection.
  let svLatestFtpSeekTarget = 0;

  try{
    if(typeof browserCanPlayVideoCodec === 'function'){
      const originalBrowserCanPlayVideoCodec = browserCanPlayVideoCodec;
      browserCanPlayVideoCodec = function(info){
        const codec = String(info?.videoCodec || info?.codec || '').trim().toLowerCase();
        if(
          codec === 'mpeg4' ||
          codec.startsWith('msmpeg4') ||
          codec.includes('divx') ||
          codec.includes('xvid') ||
          codec.includes('mpeg-4 visual')
        ) return false;
        return originalBrowserCanPlayVideoCodec(info);
      };
    }

    if(typeof shouldUseSmoothPlaybackProfile === 'function'){
      const originalShouldUseSmoothPlaybackProfile = shouldUseSmoothPlaybackProfile;
      shouldUseSmoothPlaybackProfile = function(info={},sourceUrl=''){
        const codec=String(info?.videoCodec || info?.codec || '').trim().toLowerCase();
        const mpeg4Visual = codec === 'mpeg4' || codec.startsWith('msmpeg4') || codec.includes('divx') || codec.includes('xvid') || codec.includes('mpeg-4 visual');
        const width=Number(info?.width || info?.videoWidth || 0);
        const height=Number(info?.height || info?.videoHeight || 0);
        const bitrate=Number(info?.bitrate || info?.bitRate || info?.videoBitrate || 0);
        if(mpeg4Visual && (!width || width <= 1920) && (!height || height <= 1080) && (!bitrate || bitrate <= 12000000))return false;
        return originalShouldUseSmoothPlaybackProfile(info,sourceUrl);
      };
    }

    if(typeof prepareFtpStartupAudio === 'function'){
      const originalPrepareFtpStartupAudio = prepareFtpStartupAudio;
      prepareFtpStartupAudio = async function(streamUrl, scope=null){
        try{
          if(typeof svAssertNoLiveSourceForMedia === 'function' && !svAssertNoLiveSourceForMedia(streamUrl,{fallbackReason:'FTP fast startup probe'})){
            throw new Error('Blocked live TV source for media playback');
          }
          const params = new URLSearchParams({
            url:String(streamUrl || ''),
            playbackType:'media',
            startup:'1'
          });
          const infoUrl = `${API_BASE}/api/ftp/media-info?${params.toString()}`;
          const info = typeof svFetchMediaInfoData === 'function'
            ? await svFetchMediaInfoData(infoUrl, 10000)
            : await fetch(infoUrl,{cache:'no-store',signal:scope?.signal}).then(r=>r.ok?r.json():null);
          if(scope && typeof isCurrentPlaybackScope === 'function' && !isCurrentPlaybackScope(scope)){
            throw typeof svStalePlaybackError === 'function' ? svStalePlaybackError('Superseded FTP startup probe') : new DOMException('Superseded FTP startup probe','AbortError');
          }
          if(info && typeof applyStartupAudioInfo === 'function'){
            if(typeof svCaptureServerAudioDecision === 'function')svCaptureServerAudioDecision(info);
            return applyStartupAudioInfo(info,streamUrl,'FTP fast startup audio',{
              serverAudioIndex:info.audioIndex ?? info.defaultAudioIndex ?? null
            });
          }
        }catch(error){
          if(error?.name === 'AbortError')throw error;
          try{mediaFixLog('FTP fast startup probe fallback',{message:error?.message || String(error)});}catch(_){}
        }
        return originalPrepareFtpStartupAudio(streamUrl,scope);
      };
    }

    if(typeof svBeginMediaPlayback === 'function'){
      const originalSvBeginMediaPlayback = svBeginMediaPlayback;
      svBeginMediaPlayback = function(...args){
        svLatestFtpSeekTarget = 0;
        return originalSvBeginMediaPlayback.apply(this,args);
      };
    }

    if(typeof ftpSeekTo === 'function'){
      const originalFtpSeekTo = ftpSeekTo;
      ftpSeekTo = async function(seconds){
        const target = Math.max(0,Number(seconds) || 0);
        svLatestFtpSeekTarget = target;
        if(typeof beginPlaybackRequestScope === 'function')beginPlaybackRequestScope('FTP seek supersedes previous playback request');
        return originalFtpSeekTo(target);
      };
    }

    if(typeof attachPlayerSource === 'function'){
      const originalAttachPlayerSource = attachPlayerSource;
      attachPlayerSource = async function(src,mode='direct',options={}){
        try{
          const url = new URL(String(src || ''),window.location.href);
          const reason = String(options?.fallbackReason || options?.reason || '');
          const isFtpPlayback = options?.playbackType !== 'live' && (
            url.pathname === '/api/ftp/stream' ||
            url.pathname === '/api/ftp/proxy' ||
            url.pathname === '/api/playback/ftp'
          );
          if(isFtpPlayback && svLatestFtpSeekTarget > 2){
            const requestedStart = Math.max(0,Number(url.searchParams.get('start') || 0));
            if(requestedStart + 2 < svLatestFtpSeekTarget){
              try{mediaFixLog('blocked stale FTP source after seek',{requestedStart,latestSeekTarget:svLatestFtpSeekTarget,reason,src:String(src || '')});}catch(_){}
              if(typeof svStalePlaybackError === 'function')throw svStalePlaybackError('Stale FTP source after seek');
              throw new DOMException('Stale FTP source after seek','AbortError');
            }
          }
        }catch(error){
          if(error?.name === 'AbortError')throw error;
        }
        return originalAttachPlayerSource(src,mode,options);
      };
    }

    window.__SV_PLAYBACK_HOTFIX_20260817 = true;

    if(typeof svFinalBuildLiveHomeRowFallback === 'function')window.buildLiveHomeRow = svFinalBuildLiveHomeRowFallback;
    if(typeof svOptimizedRenderLiveGridFallback === 'function')window.renderLiveGrid = svOptimizedRenderLiveGridFallback;
    if(typeof window.svStartFifaLiveSection === 'function')window.svStartFifaLiveSection();
    setupPlayerEvents();
    init();
  }catch(e){
    console.error('[StreamVault] boot failed:', e);
    const heroTitle = document.getElementById('heroTitle');
    if(heroTitle)heroTitle.textContent = 'Could not start StreamVault';
  }
})();

(function(){
  'use strict';
  if(window.__SV_UNIFIED_VOD_PLAYER_LOADER)return;
  window.__SV_UNIFIED_VOD_PLAYER_LOADER=true;
  const script=document.createElement('script');
  script.src='/unified-vod-player-v1.js?v=20260818-unified-vod-v1-1';
  script.async=false;
  script.defer=false;
  script.onerror=()=>console.error('[StreamVault] unified VOD player failed to load');
  document.head.appendChild(script);
})();
