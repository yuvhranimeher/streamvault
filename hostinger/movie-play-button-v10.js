/* SV_MOVIE_PLAY_BUTTON_V10 */
(function(){
  if(window.__svMoviePlayButtonV10)return;
  window.__svMoviePlayButtonV10=true;

  const MOBILE_SOURCE_INDEX_URL='/mobile-source-index.json?v=20260813-v2';
  let mobileSourceIndexPromise=null;

  function clean(value){
    return String(value||"")
      .toLowerCase()
      .replace(/\[[^\]]*]/g," ")
      .replace(/\b(?:19|20)\d{2}\b/g," ")
      .replace(/\b(2160p|1080p|720p|480p|4k|dual audio|movie)\b/g," ")
      .replace(/[^a-z0-9]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function isAndroidClient(){
    return /Android/i.test(navigator.userAgent||'');
  }

  function loadMobileSourceIndex(){
    if(mobileSourceIndexPromise)return mobileSourceIndexPromise;
    mobileSourceIndexPromise=fetch(MOBILE_SOURCE_INDEX_URL,{
      cache:'no-cache',
      headers:{Accept:'application/json'}
    }).then(response=>{
      if(!response.ok)throw new Error(`mobile source index HTTP ${response.status}`);
      return response.json();
    }).catch(error=>{
      console.warn('[Mobile Source Selector] index unavailable:',error);
      return {movies:{}};
    });
    return mobileSourceIndexPromise;
  }

  function sourceScore(source){
    const url=String(source?.url||'');
    const decoded=(()=>{try{return decodeURIComponent(url);}catch{return url;}})().toLowerCase();
    let score=0;
    if(/^https:\/\//i.test(url))score+=1000;
    else score-=1000;
    if(/\.(?:mp4|m4v)(?:$|[?#])/i.test(url))score+=900;
    if(/\b(?:h264|x264|avc)\b/i.test(decoded)||String(source?.videoCodec||'').toLowerCase()==='h264')score+=250;
    if(/\baac\b/i.test(decoded)||String(source?.audioCodec||'').toLowerCase()==='aac')score+=150;
    if(source?.range206===true)score+=200;
    if(source?.androidChromeVerified===true)score+=500;
    if(/\.(?:mkv|webm|avi)(?:$|[?#])/i.test(url))score-=1200;
    if(/\b(?:x265|h265|hevc|10bit|10-bit)\b/i.test(decoded))score-=900;
    if(/\b(?:ac3|eac3|dts|truehd)\b/i.test(decoded))score-=300;
    return score;
  }

  async function applyAndroidDirectSource(movie){
    if(!isAndroidClient()||!movie)return movie;

    const index=await loadMobileSourceIndex();
    const key=clean(movie.name||movie.title||movie.file||'');
    const variants=Array.isArray(index?.movies?.[key])?index.movies[key]:[];
    if(!variants.length)return movie;

    const best=variants
      .filter(source=>source&&typeof source.url==='string')
      .slice()
      .sort((a,b)=>sourceScore(b)-sourceScore(a))[0];

    if(!best?.url||sourceScore(best)<1000)return movie;

    const previous=movie.streamUrl||'';
    movie._svOriginalStreamUrl=previous;
    movie.streamUrl=best.url;
    movie.isFtp=true;
    movie.hasStream=true;
    movie.streamAvailable=true;
    movie._svAndroidDirectSource=true;
    movie._svAndroidDirectSourceScore=sourceScore(best);
    movie._svAndroidDirectSourceMeta={...best};

    console.info('[Mobile Source Selector] Android direct source selected',{
      title:movie.name||movie.title||'',
      previous,
      selected:best.url,
      score:movie._svAndroidDirectSourceScore
    });
    return movie;
  }

  function verifiedAndroidDirectMovie(movie){
    if(!isAndroidClient()||!movie?._svAndroidDirectSource)return false;
    const meta=movie._svAndroidDirectSourceMeta||{};
    const url=String(movie.streamUrl||'').trim();
    if(!/^https:\/\//i.test(url))return false;
    if(!/\.(?:mp4|m4v)(?:$|[?#])/i.test(url))return false;
    if(meta.androidChromeVerified!==true)return false;
    if(meta.range206!==true)return false;
    if(String(meta.videoCodec||'').toLowerCase()!=='h264')return false;
    if(String(meta.audioCodec||'').toLowerCase()!=='aac')return false;
    return true;
  }

  async function launchVerifiedAndroidDirect(movie){
    if(!verifiedAndroidDirectMovie(movie))return false;

    const directUrl=String(movie.streamUrl||'').trim();
    const title=movie.name||movie.title||'';
    const year=movie.year||'';

    if(typeof vid==='undefined'||!vid)throw new Error('Video player unavailable');
    if(typeof attachPlayerSource!=='function')throw new Error('Direct source attachment unavailable');
    if(typeof svPlayVideo!=='function')throw new Error('Direct video playback unavailable');

    if(typeof svCaptureModernModalLaunch==='function')svCaptureModernModalLaunch(movie,'movie');
    if(typeof svSuspendMediaModalForPlayback==='function')svSuspendMediaModalForPlayback();

    try{
      if(typeof recordWatchHistory==='function'&&typeof movieIdentity==='function'){
        recordWatchHistory(movieIdentity(movie),title,movie.genre||'','movie');
      }
      if(typeof svRememberPlaybackReturnState==='function')svRememberPlaybackReturnState('movie');
      if(typeof svPushPlayerHistory==='function')svPushPlayerHistory();
    }catch(error){
      console.warn('[Mobile Direct] history setup skipped:',error);
    }

    const playbackContext=typeof svPlaybackContextForMovie==='function'
      ? svPlaybackContextForMovie(movie)
      : null;
    const playbackScope=typeof beginPlaybackRequestScope==='function'
      ? beginPlaybackRequestScope('verified Android direct HTTPS startup')
      : null;

    if(typeof clearMediaStartupWatchdog==='function')clearMediaStartupWatchdog();
    if(typeof svBeginMediaPlayback==='function'){
      svBeginMediaPlayback('ftp',directUrl,title,playbackContext||undefined);
    }
    if(typeof svAssertNoLiveSourceForMedia==='function'&&!svAssertNoLiveSourceForMedia(directUrl,{fallbackReason:'verified Android direct HTTPS source'})){
      return true;
    }

    isLiveMode=false;
    if(typeof closeAllDropdowns==='function')closeAllDropdowns();
    if(typeof closeAllSeriesDropdowns==='function')closeAllSeriesDropdowns();
    if(typeof hideSeriesPlayerBar==='function')hideSeriesPlayerBar();
    if(typeof hidePlayerNotice==='function')hidePlayerNotice();
    try{clearInterval(vid._pi);}catch(_){ }
    if(typeof hlsInstance!=='undefined'&&hlsInstance){
      try{hlsInstance.destroy();}catch(_){ }
      hlsInstance=null;
    }

    try{vid.pause();}catch(_){ }
    vid.removeAttribute('src');
    vid.querySelectorAll('track').forEach(track=>track.remove());
    if(typeof clearSubtitleOverlay==='function')clearSubtitleOverlay();
    vid.load();

    const playToken=(vid._durationToken||0)+1;
    vid._durationToken=playToken;
    _ftpStreamUrl=directUrl;
    _ftpDuration=0;
    _ftpNeedsTranscode=false;
    _ftpTrackLoadPromise=null;
    _ftpTrackLoadFailed=false;
    if(typeof resetFtpHeavyPlaybackState==='function')resetFtpHeavyPlaybackState();
    _currentFtpPlaybackPlan={
      ok:true,
      mode:'direct',
      transport:'external-direct',
      src:directUrl,
      decodedUrl:directUrl,
      directPlayable:true,
      verifiedExternalDirect:true,
      duration:0
    };
    _ftpCurrentTime=0;
    _ftpSeekPending=false;
    vid._apiDuration=0;
    vid._sourceOffset=0;
    vid._sourceSeekRequired=false;
    vid._mediaSourceSeekRequired=false;
    vid._ftpProxyFallback=false;
    vid._ftpPlaybackFallbackTried=true;
    vid._ftpFallbackStepsTried=new Set(['direct']);
    vid._svPlaybackShouldPlay=true;
    clearTimeout(vid._ftpFallbackTimer);
    vid._ftpFallbackTimer=null;
    vid._durationPending=false;
    vid._resumeChecked=true;
    vid._stableDuration=0;
    vid._audioSwitchPending=false;
    vid._queuedAudioSwitchIdx=null;
    vid._audioSwitchToken=(vid._audioSwitchToken||0)+1;
    if(typeof resetSmoothPlaybackState==='function')resetSmoothPlaybackState('verified Android direct HTTPS startup');
    if(typeof resetSeekPreview==='function')resetSeekPreview();

    const playerModal=document.getElementById('playerModal');
    if(!playerModal)throw new Error('Player modal unavailable');
    playerModal.classList.add('open');
    if(typeof setCentralPlaybackLoading==='function')setCentralPlaybackLoading(true);
    const titleEl=document.getElementById('playerTitle');
    if(titleEl)titleEl.textContent=typeof displayText==='function'?displayText(title):title;
    const subtitleEl=document.getElementById('playerSubTitle');
    if(subtitleEl)subtitleEl.textContent=year?String(year):'';
    document.getElementById('playerLiveBadge')?.classList.remove('show');
    document.getElementById('progressWrap')?.classList.remove('live-mode');
    const played=document.getElementById('progressPlayed');
    const thumb=document.getElementById('progressThumb');
    const buffered=document.getElementById('progressBuffered');
    if(played)played.style.width='0%';
    if(thumb)thumb.style.left='0%';
    if(buffered)buffered.style.width='0%';
    if(typeof setDurationTimer==='function')setDurationTimer('0:00','--:--');
    document.body.style.overflow='hidden';
    if(typeof enterMobileLandscapeMode==='function')enterMobileLandscapeMode();
    if(typeof refreshPlayerControlVisibility==='function')refreshPlayerControlVisibility();
    if(typeof showUI==='function')showUI();

    currentStreamId=null;
    currentQuality='auto';
    if(typeof svSetCurrentAudioIndex==='function')svSetCurrentAudioIndex(0,'launchVerifiedAndroidDirect','verified Android direct session');
    if(typeof setAppliedAudioIndex==='function')setAppliedAudioIndex(0);
    if(typeof clearAudioLock==='function')clearAudioLock();
    availableAudio=[{index:0,title:'Default Audio'}];
    availableSubs=[];
    if(typeof renderAudioTracks==='function')renderAudioTracks();
    const subList=document.getElementById('subList');
    if(subList)subList.innerHTML='<div class="pd-item" style="color:#666;pointer-events:none">No external subtitles</div>';
    if(typeof updateSubBtn==='function')updateSubBtn();

    const stillCurrent=()=>{
      if(vid._durationToken!==playToken)return false;
      if(_ftpStreamUrl!==directUrl)return false;
      if(playbackScope&&typeof isCurrentPlaybackScope==='function'&&!isCurrentPlaybackScope(playbackScope))return false;
      return true;
    };

    vid.addEventListener('loadedmetadata',function onDirectMetadata(){
      if(!stillCurrent())return;
      const duration=Number(vid.duration);
      if(Number.isFinite(duration)&&duration>0){
        _ftpDuration=duration;
        if(typeof setPlayerDuration==='function')setPlayerDuration(duration,'native');
      }
    },{once:true});

    vid.addEventListener('canplay',function onDirectCanPlay(){
      if(!stillCurrent())return;
      if(typeof setCentralPlaybackLoading==='function')setCentralPlaybackLoading(false);
    },{once:true});

    vid.addEventListener('error',function onDirectError(){
      if(!stillCurrent())return;
      if(typeof clearMediaStartupWatchdog==='function')clearMediaStartupWatchdog();
      if(typeof setCentralPlaybackLoading==='function')setCentralPlaybackLoading(false);
      if(typeof showPlayerNotice==='function')showPlayerNotice('Direct mobile source could not start.');
      console.warn('[Mobile Direct] verified direct source failed',{
        title,
        url:directUrl,
        mediaError:vid.error?.code||null
      });
    },{once:true});

    console.info('[Mobile Direct] attaching verified HTTPS source directly',{
      title,
      url:directUrl,
      backendBypassed:true
    });

    const attached=await attachPlayerSource(directUrl,'direct',{
      playbackType:'media',
      fallbackReason:'verified Android direct HTTPS source'
    });
    if(!stillCurrent())return true;
    if(!attached)throw new Error('Direct source could not be attached');

    window.__svVerifiedAndroidDirectActive={
      title,
      url:directUrl,
      startedAt:Date.now(),
      backendBypassed:true
    };

    svPlayVideo('verified Android direct HTTPS initial play',{
      scope:playbackScope||undefined,
      force:true,
      onError:error=>{
        if(typeof setCentralPlaybackLoading==='function')setCentralPlaybackLoading(false);
        if(typeof showPlayerNotice==='function')showPlayerNotice('Tap play to start the direct stream.');
        console.warn('[Mobile Direct] play() rejected:',error);
        return false;
      }
    }).catch(()=>{});

    return true;
  }

  function popupOpen(){
    const modal=document.getElementById("mediaModal");
    return modal &&
      !modal.classList.contains("hidden") &&
      modal.getAttribute("aria-hidden")!=="true";
  }

  function findMovie(){
    const title=document.getElementById("modalTitle")?.textContent||"";
    const target=clean(title);

    if(
      typeof currentDetailMovie!=="undefined" &&
      currentDetailMovie &&
      clean(currentDetailMovie.name||currentDetailMovie.title)===target
    ){
      return currentDetailMovie;
    }

    const candidates=[];

    if(
      typeof _movieDetailRegistry!=="undefined" &&
      _movieDetailRegistry instanceof Map
    ){
      candidates.push(..._movieDetailRegistry.values());
    }

    if(typeof movies!=="undefined" && Array.isArray(movies)){
      candidates.push(...movies);
    }

    return candidates.find(item=>
      clean(item?.name||item?.title)===target
    )||null;
  }

  async function startMovie(movie,button){
    if(!movie||button.disabled)return;

    button.disabled=true;
    button.innerHTML="Loading…";

    try{
      await applyAndroidDirectSource(movie);
      currentDetailMovie=movie;

      if(await launchVerifiedAndroidDirect(movie))return;

      if(typeof svLaunchMediaModalMovie==="function"){
        await svLaunchMediaModalMovie(movie);
      }else{
        throw new Error("Modern modal playback launcher unavailable");
      }
    }catch(error){
      console.error("[Movie Play v10]",error);
      if(window.StreamVaultConfig?.backendStatus?.available === false){
        const message=await window.StreamVaultConfig.showOfflineMessage("playback");
        if(!message&&typeof showToast==='function')showToast("Movie playback could not start");
      }else if(typeof showToast==='function'){
        showToast("Movie playback could not start");
      }
    }finally{
      button.disabled=false;
      button.innerHTML=
        '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>Play';
    }
  }

  function update(){
    if(!popupOpen())return;

    const meta=document.getElementById("modalMeta")?.textContent||"";
    const buttons=document.getElementById("modalButtons");

    if(!buttons)return;

    if(/\bseries\b/i.test(meta)){
      buttons.replaceChildren();
      buttons.style.display="none";
      return;
    }

    if(!/\bmovie\b/i.test(meta))return;

    const movie=findMovie();
    if(!movie)return;

    buttons.style.display="flex";

    if(!document.getElementById("svMoviePlayV10") || !document.getElementById("svMovieDownloadV10")){
      buttons.innerHTML=`
        <button id="svMoviePlayV10"
          class="sv-movie-play-v10"
          type="button">
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"></path>
          </svg>
          Play
        </button>
        <button id="svMovieDownloadV10"
          class="sv-movie-download-v10"
          type="button"
          title="Download original media file"
          aria-label="Download ${String(movie?.name || movie?.title || 'movie').replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}">
          ${typeof mediaDownloadIconSvg==='function'?mediaDownloadIconSvg():''}
          Download
        </button>
      `;
    }

    document.getElementById("svMoviePlayV10").onclick=function(){
      startMovie(movie,this);
    };
    document.getElementById("svMovieDownloadV10").onclick=function(event){
      if(typeof downloadMovieFromDetail==='function')return downloadMovieFromDetail(event,movie);
      if(typeof showToast==='function')showToast('Download unavailable');
      return false;
    };
  }

  const style=document.createElement("style");
  style.textContent=`
    .sv-movie-play-v10{
      display:inline-flex;
      align-items:center;
      gap:9px;
      padding:13px 24px;
      border:0;
      border-radius:7px;
      background:#fff;
      color:#080808;
      font:800 15px/1 system-ui,sans-serif;
      cursor:pointer;
    }
    .sv-movie-download-v10{
      display:inline-flex;
      align-items:center;
      gap:9px;
      padding:13px 24px;
      border:0;
      border-radius:7px;
      background:rgba(109,109,110,.75);
      color:#fff;
      font:800 15px/1 system-ui,sans-serif;
      cursor:pointer;
    }
    .sv-movie-download-v10:hover{background:rgba(109,109,110,.92)}
    .sv-movie-download-v10 .media-download-icon{width:19px;height:19px}
    .sv-movie-play-v10 svg{
      width:20px;
      height:20px;
      fill:currentColor;
    }
    .sv-movie-play-v10:disabled{
      opacity:.65;
      cursor:wait;
    }
  `;
  document.head.appendChild(style);

  if(isAndroidClient())loadMobileSourceIndex();
  setInterval(update,120);
})();
