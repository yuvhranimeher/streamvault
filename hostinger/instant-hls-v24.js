(function(){
  const marker='SV_HOSTINGER_HLS_V24';
  if(window[marker])return;
  window[marker]=true;

  if(typeof ftpStreamPlaybackPlan!=='function'){
    console.error('[SV HLS v24] ftpStreamPlaybackPlan unavailable');
    return;
  }

  const buildPlan=function(url,start=0,fallbackReason='buffered HLS'){
    const params=new URLSearchParams();
    params.set('url',String(url||''));
    params.set('playbackType','media');

    if(fallbackReason){
      params.set('fallbackReason',fallbackReason);
    }

    if(Number(start)>0){
      params.set('start',String(Math.floor(Number(start))));
    }

    if(
      typeof currentQuality!=='undefined' &&
      currentQuality &&
      currentQuality!=='auto'
    ){
      params.set('quality',currentQuality);
    }

    if(typeof appendSelectedAudioParams==='function'){
      appendSelectedAudioParams(params);
    }

    const src='/api/mobile-hls/ftp/index.m3u8?' + params.toString();

    return {
      ok:true,
      decodedUrl:url,
      directPlayable:false,
      mode:'hls',
      transport:'hls',
      smoothProfile:true,
      src:src,
      playUrl:src,
      finalPlayUrl:src,
      hlsUrl:src,
      transcodeUrl:src,
      audioTranscodeUrl:src,
      duration:typeof _ftpDuration==='number'
        ?_ftpDuration
        :0
    };
  };

  ftpStreamPlaybackPlan=buildPlan;
  window.ftpStreamPlaybackPlan=buildPlan;

  if(typeof startupAudioTimeoutFor==='function'){
    const originalStartupTimeout=startupAudioTimeoutFor;

    startupAudioTimeoutFor=function(sourceUrl){
      return /^(?:https?|ftp):\/\//i.test(
        String(sourceUrl||'').trim()
      )
        ?3000
        :originalStartupTimeout(sourceUrl);
    };

    window.startupAudioTimeoutFor=startupAudioTimeoutFor;
  }

  if(typeof fallbackOrderForRemote==='function'){
    const originalFallbackOrder=fallbackOrderForRemote;

    fallbackOrderForRemote=function(url,plan={}){
      const unsupported=!!(
        plan &&
        (
          plan.unsupportedVideoHint ||
          plan.unsupportedVideoCodec
        )
      ) || /(?:x265|h265|hevc|10bit|10-bit|av1|vp9|vp8)/i.test(
        String(url||'')
      );

      return unsupported
        ?['transcode','hls','audio','remux','proxy']
        :originalFallbackOrder(url,plan);
    };

    window.fallbackOrderForRemote=fallbackOrderForRemote;
  }

  console.log('[SV HLS v24] Hostinger HEVC playback uses persistent HLS');
})();
