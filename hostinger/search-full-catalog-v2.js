(function(){
  'use strict';

  const VERSION='20260817-search-readiness-bypass-v3';
  const previousHandle=window.handleSearch;
  const previousRenderSearchPage=window.renderSearchPage;
  let timer=0;
  let controller=null;
  let seq=0;

  try{
    const layoutStyle=document.createElement('style');
    layoutStyle.id='sv-home-nav-spacing-fix';
    layoutStyle.textContent='#mainSection{padding-top:calc(var(--nav-h) + 28px) !important;}';
    document.head.appendChild(layoutStyle);
  }catch(_){ }

  function isSeries(item){
    return !!(item && (item._isSeries || item.type==='series' || item.type==='tv' || item.seasons));
  }

  function syncInputs(value){
    for(const id of ['searchInputDesktop','searchInputMobile']){
      const el=document.getElementById(id);
      if(el && el.value!==value)el.value=value;
    }
  }

  function showDesktopSearch(){
    try{currentTab='search';}catch(_){ }
    for(const id of ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','downloadsSection','liveSection','mobileMp4Section']){
      const el=document.getElementById(id);
      if(el)el.style.display='none';
    }
    const section=document.getElementById('searchSection');
    if(section)section.style.display='block';
  }

  function targetNodes(){
    const mobile=!!document.getElementById('searchOverlay')?.classList.contains('open');
    return {
      mobile,
      grid:document.getElementById(mobile?'mobileSearchGrid':'searchGrid'),
      label:document.getElementById(mobile?'mobileSearchLabel':'searchLabel')
    };
  }

  function displayable(item){
    if(!item)return false;
    if(item.streamUrl || item.hasStream===true || item.streamAvailable===true || item.isMassiveCatalog || item.isFtp)return true;
    try{return typeof isPlayableMediaItem!=='function' || isPlayableMediaItem(item);}catch(_){return true;}
  }

  function norm(value){
    return String(value||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  }

  function rank(item,q){
    const query=norm(q);
    const title=norm(item?.name||item?.title||item?.file||'');
    const file=norm(item?.file||'');
    const year=norm(item?.year||'');
    const full=norm(`${title} ${file} ${year}`);
    if(norm(`${title} ${year}`)===query)return 100000;
    if(title===query)return 95000;
    if(title.startsWith(query))return 90000;
    if(file.includes(query))return 85000;
    const terms=query.split(' ').filter(Boolean);
    return terms.length&&terms.every(t=>full.includes(t))?80000+terms.length*100:0;
  }

  function render(items,query){
    const {grid,label}=targetNodes();
    if(!grid)return;
    const visible=(Array.isArray(items)?items:[])
      .filter(displayable)
      .sort((a,b)=>rank(b,query)-rank(a,query));

    if(!visible.length){
      grid.innerHTML='<div class="empty"><h2>Nothing found</h2><p>Try another spelling or fewer words.</p></div>';
      if(label)label.textContent=`No results for "${query}"`;
      return;
    }

    const html=visible.map(item=>{
      try{return isSeries(item)?sCardHTML(item):cardHTML(item);}catch(err){console.warn('[Search V3] card render failed',err);return '';}
    }).join('');

    if(!html){
      grid.innerHTML='<div class="empty"><h2>Result found but card rendering failed</h2></div>';
      if(label)label.textContent=`${visible.length} raw result${visible.length===1?'':'s'} for "${query}"`;
      return;
    }

    grid.innerHTML=html;
    if(label)label.textContent=`${visible.length.toLocaleString()} result${visible.length===1?'':'s'} for "${query}"`;
    try{if(typeof svQueuePosterImages==='function')svQueuePosterImages(grid);}catch(_){ }
  }

  async function request(query){
    const my=++seq;
    try{controller?.abort();}catch(_){ }
    controller=new AbortController();
    const {label}=targetNodes();
    if(label)label.textContent=`Searching for "${query}"`;

    const params=new URLSearchParams({
      q:query,
      kind:'mixed',
      page:'1',
      limit:'100',
      massive:'1',
      background:'1',
      v:VERSION,
      _:String(Date.now())
    });

    try{
      const response=await fetch(`/api/search?${params.toString()}`,{
        method:'GET',
        cache:'default',
        headers:{Accept:'application/json'},
        signal:controller.signal
      });
      if(my!==seq)return;
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      if(my!==seq)return;
      render(Array.isArray(data?.items)?data.items:[],query);
    }catch(error){
      if(error?.name==='AbortError' || my!==seq)return;
      console.error('[Search V3] request failed',error);
      render([],query);
    }
  }

  function run(value){
    const query=String(value||'');
    syncInputs(query);
    clearTimeout(timer);
    try{controller?.abort();}catch(_){ }
    seq++;

    if(!query.trim()){
      try{previousHandle?.('');}catch(_){ }
      return;
    }

    if(!document.getElementById('searchOverlay')?.classList.contains('open'))showDesktopSearch();
    timer=setTimeout(()=>request(query.trim()),80);
  }

  document.addEventListener('input',event=>{
    const id=event.target?.id;
    if(id!=='searchInputDesktop' && id!=='searchInputMobile')return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    run(event.target.value);
  },true);

  window.handleSearch=run;
  window.renderSearchPage=function(q=''){
    const value=String(q||'');
    if(!value.trim()){
      try{return previousRenderSearchPage?.('');}catch(_){return;}
    }
    syncInputs(value);
    showDesktopSearch();
    request(value.trim());
  };

  window.__SV_SEARCH_READINESS_BYPASS_V3=true;
  window.__SV_FULL_CATALOG_SEARCH_VERSION=VERSION;
})();

/* SV_EMERGENCY_PLAYBACK_RECOVERY_20260818 */
(function(){
  'use strict';
  if(window.__SV_EMERGENCY_PLAYBACK_RECOVERY_20260818)return;
  window.__SV_EMERGENCY_PLAYBACK_RECOVERY_20260818=true;

  const previousHydrate=window.hydrateMoviePlayback;

  window.hydrateMoviePlayback=async function emergencyHydrateMoviePlayback(movie){
    if(!movie || movie.streamUrl)return movie;

    const title=String(movie.name||movie.title||movie.file||'').trim();
    const year=String(movie.year||'').match(/(?:19|20)\d{2}/)?.[0]||'';
    const identity=String(movie.id??title).trim();

    if(identity){
      try{
        const params=new URLSearchParams();
        if(title)params.set('title',title);
        if(year)params.set('year',year);
        params.set('_',String(Date.now()));

        const response=await fetch(`/api/playback/movie/${encodeURIComponent(identity)}?${params.toString()}`,{
          method:'GET',
          cache:'no-store',
          headers:{Accept:'application/json'}
        });

        if(response.ok){
          const raw=await response.json();
          const data=window.StreamVaultConfig?.normalizeBackendUrls?.(raw)??raw;
          if(data?.ok && data?.streamUrl){
            movie.streamUrl=data.streamUrl;
            movie.isFtp=data.isFtp!==false;
            movie.streamAvailable=true;
            movie.hasStream=true;
            if(data.id!=null && !movie.id)movie.id=data.id;
            return movie;
          }
        }
      }catch(error){
        console.warn('[Emergency Playback Recovery] resolver failed',error?.message||error);
      }
    }

    if(typeof previousHydrate==='function'){
      try{return await previousHydrate(movie);}catch(_){ }
    }
    return movie;
  };
})();

/* SV_PLAYBACK_STABILITY_HOTFIX_V2_20260818 */
(function(){
  'use strict';
  if(window.__SV_PLAYBACK_STABILITY_HOTFIX_V2)return;
  window.__SV_PLAYBACK_STABILITY_HOTFIX_V2=true;

  const VERSION='20260818-playback-stability-v2';
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
      if(video.buffered.length)return Math.max(0,video.buffered.end(video.buffered.length-1)-current);
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

  const previousOpenMediaModal=window.openMediaModal;
  if(typeof previousOpenMediaModal==='function'){
    window.openMediaModal=function stabilityOpenMediaModal(item,requestedType=''){
      const result=previousOpenMediaModal.apply(this,arguments);
      try{
        const type=String(requestedType||item?.type||'').toLowerCase();
        if(type==='series' || type==='tv' || item?.seasons)primeEpisode(firstEpisode(item));
        else primeMovie(item);
      }catch(_){ }
      return result;
    };
  }

  function episodeFromCard(card){
    if(!card)return null;
    const key=String(card.id||'').replace(/^epcard-/,'');
    if(!key)return null;
    try{
      const seasons=(typeof currentShow!=='undefined' && currentShow?.seasons) ? currentShow.seasons : {};
      for(const eps of Object.values(seasons)){
        for(const ep of (Array.isArray(eps)?eps:[])){
          if(String(ep?.streamId??'')===key)return ep;
        }
      }
    }catch(_){ }
    return null;
  }

  document.addEventListener('pointerover',event=>{
    const card=event.target?.closest?.('.ep-card');
    if(!card)return;
    const ep=episodeFromCard(card);
    if(ep)primeEpisode(ep);
  },true);

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
          svPlayVideo(`stability hotfix ${reason}`,{force:true,onError:()=>false}).catch(()=>{});
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
