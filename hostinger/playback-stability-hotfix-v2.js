/* SV_PLAYBACK_STABILITY_HOTFIX_V3_20260825 */
(function(){
  'use strict';
  if(window.__SV_PLAYBACK_STABILITY_HOTFIX_V2)return;
  window.__SV_PLAYBACK_STABILITY_HOTFIX_V2=true;

  const VERSION='20260825-play-click-only-v3';
  const moviePrimePromises=new WeakMap();
  let autoplayIntentUntil=0;

  function playerVideo(){
    return document.getElementById('videoPlayer');
  }

  function bufferedAhead(video){
    if(!video)return 0;
    const current=Number(video.currentTime)||0;
    try{
      for(let i=0;i<video.buffered.length;i++){
        if(video.buffered.start(i)<=current && video.buffered.end(i)>=current){
          return Math.max(0,video.buffered.end(i)-current);
        }
      }
      if(video.buffered.length){
        return Math.max(0,video.buffered.end(video.buffered.length-1)-current);
      }
    }catch(_){ }
    return 0;
  }

  function primeMediaInfoForSource(source){
    const url=String(source||'').trim();
    if(!url)return Promise.resolve(null);
    try{
      if(typeof svFetchMediaInfoData==='function' && typeof svFtpAudioInfoUrl==='function'){
        return svFetchMediaInfoData(svFtpAudioInfoUrl(url),9000).catch(()=>null);
      }
    }catch(_){ }
    return Promise.resolve(null);
  }

  function primeMediaInfoForLocal(id){
    if(id===null || id===undefined || id==='')return Promise.resolve(null);
    try{
      if(typeof svFetchMediaInfoData==='function' && typeof svLocalAudioInfoUrl==='function'){
        return svFetchMediaInfoData(svLocalAudioInfoUrl(id),9000).catch(()=>null);
      }
    }catch(_){ }
    return Promise.resolve(null);
  }

  const previousHydrate=window.hydrateMoviePlayback;
  window.hydrateMoviePlayback=async function stabilityHydrateMoviePlayback(movie){
    if(!movie)return movie;
    if(movie.streamUrl){
      primeMediaInfoForSource(movie.streamUrl);
      return movie;
    }

    if(moviePrimePromises.has(movie))return moviePrimePromises.get(movie);

    const task=(async()=>{
      let resolved=movie;
      if(typeof previousHydrate==='function'){
        try{resolved=(await previousHydrate(movie))||movie;}catch(_){resolved=movie;}
      }
      if(resolved?.streamUrl)primeMediaInfoForSource(resolved.streamUrl);
      else if(resolved?.streamId!==null && resolved?.streamId!==undefined)primeMediaInfoForLocal(resolved.streamId);
      return resolved;
    })();

    moviePrimePromises.set(movie,task);
    return task;
  };

  function primeMovie(movie){
    if(!movie || typeof window.hydrateMoviePlayback!=='function')return;
    window.hydrateMoviePlayback(movie).catch(()=>{});
  }

  function primeEpisode(ep){
    if(!ep)return;
    if(ep.streamUrl)primeMediaInfoForSource(ep.streamUrl);
    else if(ep.streamId!==null && ep.streamId!==undefined)primeMediaInfoForLocal(ep.streamId);
  }

  function firstEpisode(show){
    const seasons=show?.seasons||{};
    const keys=Object.keys(seasons).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    if(!keys.length)return null;
    return Array.isArray(seasons[keys[0]]) ? seasons[keys[0]][0] : null;
  }

  // Opening or hovering a detail view must not probe media. The existing
  // hydrate/playback path still primes metadata after an explicit Play.

  function isPlaybackStartControl(target){
    const el=target?.closest?.('button,.ep-card,[role="button"]');
    if(!el)return false;
    const id=String(el.id||'');
    if(['svMoviePlayV10','smPlayBtn','ppCenterBtn'].includes(id))return true;
    if(el.classList?.contains('ep-card'))return true;
    const onclick=String(el.getAttribute?.('onclick')||'');
    return /playSeriesEpisode|playMovieFromDetail|svLaunchMediaModalMovie|playMedia\(|playFtpMedia\(/.test(onclick);
  }

  function notePlaybackIntent(event){
    if(!isPlaybackStartControl(event.target))return;
    autoplayIntentUntil=Date.now()+90000;
  }
  document.addEventListener('pointerdown',notePlaybackIntent,true);
  document.addEventListener('click',notePlaybackIntent,true);

  function playbackStillWanted(video){
    if(!video || !video.paused)return false;
    if(video._svPlaybackShouldPlay===true)return true;
    return Date.now()<autoplayIntentUntil;
  }

  function retryPlaybackOnReady(reason){
    const video=playerVideo();
    if(!playbackStillWanted(video))return;
    queueMicrotask(()=>{
      if(!playbackStillWanted(video))return;
      try{
        if(typeof svPlayVideo==='function'){
          svPlayVideo(`stability hotfix ${reason}`,{
            force:true,
            onError:()=>false
          }).catch(()=>{});
        }else{
          video.play().catch(()=>{});
        }
      }catch(_){ }
    });
  }

  const video=playerVideo();
  if(video){
    video.addEventListener('loadedmetadata',()=>retryPlaybackOnReady('loadedmetadata'));
    video.addEventListener('canplay',()=>retryPlaybackOnReady('canplay'));
    video.addEventListener('playing',()=>{
      try{if(typeof setCentralPlaybackLoading==='function')setCentralPlaybackLoading(false);}catch(_){ }
    });
  }

  const previousSmoothSwitch=window.switchToSmoothPlaybackProfile;
  if(typeof previousSmoothSwitch==='function'){
    window.switchToSmoothPlaybackProfile=async function stabilitySmoothSwitch(reason='buffering'){
      const video=playerVideo();
      if(!video)return false;
      const current=Number(video.currentTime)||0;
      const ahead=bufferedAhead(video);
      let mode='';
      try{
        mode=String((typeof _currentFtpPlaybackPlan!=='undefined' && _currentFtpPlaybackPlan?.mode)
          || (typeof _currentPlaybackPlan!=='undefined' && _currentPlaybackPlan?.mode)
          || '').toLowerCase();
      }catch(_){ }
      const src=String(video.currentSrc||video.getAttribute('src')||'');

      if(ahead>0.75)return false;
      if(current<8)return false;

      if((mode==='stream' || /\/api\/ftp\/stream(?:\?|$)/i.test(src)) && current<45)return false;
      if(/[?&]smooth=1(?:&|$)/i.test(src))return false;

      return previousSmoothSwitch.apply(this,arguments);
    };
  }

  window.__SV_PLAYBACK_STABILITY_VERSION=VERSION;
})();

