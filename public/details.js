(function(){
  function svStableKey(prefix, item){
    const raw = [
      item && (item.tmdbId || item.id || item.streamUrl || item.name || item.title || item.file),
      item && (item.type || (item.seasons ? 'series' : 'movie'))
    ].filter(Boolean).join('|');
    let hash = 2166136261;
    for(let i=0;i<raw.length;i++){
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(36)}`;
  }

  registerMovieForDetail = function(movie){
    const key = svStableKey('md', movie || {});
    _movieDetailRegistry.set(key, movie);
    return key;
  };

  registerSeriesForDetail = function(show){
    const key = svStableKey('sd', show || {});
    _seriesDetailRegistry.set(key, show);
    return key;
  };

  window._svEagerImageBudget = 9999;

  svConsumeImageAttrs = function(priority=false, immediate=false){
    const eager = true;
    const fetchPriority = priority ? 'high' : (eager ? 'auto' : 'low');
    return eager
      ? `loading="eager" fetchpriority="${fetchPriority}" decoding="async" onload="this.dataset.svLoaded='1';this.classList.add('poster-loaded','is-loaded')"`
      : 'loading="lazy" fetchpriority="low" decoding="async"';
  };

  svOptimizeImageUrl = function(src='', wide=false){
    const url = String(src || '');
    if(!url.includes('image.tmdb.org/t/p/'))return url;
    const width = wide ? 780 : ((window._svWeakDevice || innerWidth < 760) ? 185 : 342);
    const size = `w${width}`;
    const normalized = url.replace(/\/t\/p\/(?:original|w\d+)\//, `/t/p/${size}/`);
    return `/poster-cache?url=${encodeURIComponent(normalized)}&w=${width}`;
  };

  svMediaArt = function(item, wide=false){
    if(!item)return '';
    return svOptimizeImageUrl(wide ? (item.backdrop || item.poster || '') : (item.poster || item.backdrop || ''), wide);
  };

  function svImg(src, alt, attrs, extraClass='', width=342, height=513){
    const loaded = !!window.svPosterLoadedCache?.has(src);
    const eager = /loading="eager"/.test(attrs || '') || /fetchpriority="high"/.test(attrs || '');
    const cls = [extraClass, loaded ? 'poster-loaded is-loaded' : ''].filter(Boolean).join(' ');
    const srcAttr = loaded || eager ? `src="${esc(src)}"` : '';
    const loadedAttr = loaded ? 'data-sv-loaded="1"' : '';
    const priority = /fetchpriority="high"/.test(attrs || '') ? 'high' : (eager ? 'auto' : 'low');
    return `<img class="${cls}" ${srcAttr} data-sv-src="${esc(src)}" data-sv-priority="${priority}" ${loadedAttr} alt="${esc(alt || '')}" ${attrs} width="${width}" height="${height}">`;
  }

  sCardHTML = function(s){
    if(typeof isPlayableMediaItem === 'function' && !isPlayableMediaItem(s))return '';
    const seasons = s?.seasons || {};
    const sc = s?.seasonCount ?? Object.keys(seasons).length;
    const ep = s?.episodeCount ?? Object.values(seasons).reduce((a,b)=>a+(Array.isArray(b)?b.length:0),0);
    const src = svMediaArt(s,false);
    const img = src
      ? svImg(src, s?.name || '', svConsumeImageAttrs(!!s?._priorityImage, !!s?._immediateImage))
      : `<div class="card-placeholder"><div class="icon">${svPlaceholderIcon('series')}</div><div class="pname">${esc(s?.name || '')}</div></div>`;
    const detailKey = registerSeriesForDetail(s);
    return `<div class="card" role="button" tabindex="0" onclick="openSeriesDetail('${detailKey}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openSeriesDetail('${detailKey}')}">${img}<div class="series-badge">SERIES</div><div class="card-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div><div class="card-overlay"><div class="card-title">${esc(s?.name || '')}</div><div class="card-meta">${s?.rating?`<span class="card-rating">&#9733; ${esc(s.rating)}</span>`:''}<span>${sc}S &middot; ${ep}Ep</span></div></div></div>`;
  };

  cardHTML = function(m, sp=false){
    if(typeof isPlayableMediaItem === 'function' && !isPlayableMediaItem(m))return '';
    const wide = !!m?._wideStudio;
    const src = svMediaArt(m, wide);
    const img = src
      ? svImg(src, m?.name || '', svConsumeImageAttrs(!!m?._priorityImage, !!m?._immediateImage || wide), wide ? 'studio-wide-img' : '', wide ? 640 : 342, wide ? 360 : 513)
      : `<div class="card-placeholder"><div class="icon">${svPlaceholderIcon('movie')}</div><div class="pname">${esc(m?.name || '')}</div></div>`;
    const prog = watchProgress[m?.id];
    const bar = sp && prog ? `<div class="card-progress"><div class="card-progress-fill" style="width:${Math.round(prog.progress*100)}%"></div></div>` : '';
    const detailKey = registerMovieForDetail(m);
    return `<div class="card${wide?' studio-wide-card':''}" role="button" tabindex="0" onclick="openMovieDetail('${detailKey}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMovieDetail('${detailKey}')}">${img}<div class="card-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div><div class="card-overlay"><div class="card-title">${esc(m?.name || '')}</div><div class="card-meta">${m?.rating?`<span class="card-rating">&#9733; ${esc(m.rating)}</span>`:''} ${m?.year?`<span>${esc(m.year)}</span>`:''}</div></div>${bar}</div>`;
  };

  const svOriginalOpenSeriesDetail = openSeriesDetail;
  openSeriesDetail = async function(key){
    const show = _seriesDetailRegistry.get(key);
    if(!show)return svOriginalOpenSeriesDetail?.(key);
    const hasEpisodes = Object.values(show.seasons || {}).some(eps=>Array.isArray(eps) && eps.length);
    if(!show.isSummary && hasEpisodes){
      showSeriesDetail(show);
      return;
    }
    showSeriesDetail(show);
    try{
      const params = new URLSearchParams();
      params.set('name', show.name || '');
      if(show.id != null)params.set('id', show.id);
      if(show.year)params.set('year', show.year);
      const r = await fetch(`/api/series/detail?${params.toString()}`, {
        signal:detailRequestController?.signal
      });
      if(r.ok){
        const full = await r.json();
        if(full && full.name && document.getElementById('seriesModal')?.classList.contains('open') && currentShow === show){
          Object.assign(show, full, {isSummary:false});
          _seriesDetailRegistry.set(key, show);
          const idx = series.findIndex(s=>String(s.name||'') === String(full.name||''));
          if(idx >= 0)series[idx] = show;
          else series.push(show);
          hydrateOpenSeriesDetail(show);
          return;
        }
      }
    }catch(e){
      if(e?.name === 'AbortError')return;
      console.warn('[Series] detail load failed:', e.message);
    }
  };

  const svOriginalCloseMovieDetail = closeMovieDetail;
  closeMovieDetail = function(){
    svOriginalCloseMovieDetail();
    ['mdBackdrop','mdPoster'].forEach(id=>document.getElementById(id)?.removeAttribute('src'));
    ['mdSimilarTrack'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.innerHTML='';
    });
  };

  const svOriginalCloseSeriesModal = closeSeriesModal;
  closeSeriesModal = function(){
    svOriginalCloseSeriesModal();
    ['smBackdrop','smPoster'].forEach(id=>document.getElementById(id)?.removeAttribute('src'));
    ['epList','smSimilarTrack'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.innerHTML='';
    });
  };

  renderMediaCards = function(id, items){
    const el = document.getElementById(id);
    if(!el)return;
    const limit = window.innerWidth < 760 ? 8 : 16;
    const visibleItems = typeof filterPlayableMediaItems === 'function'
      ? filterPlayableMediaItems(items).slice(0, limit)
      : (Array.isArray(items) ? items.slice(0, limit) : []);
    const section=el.closest('.detail-section,.sm-related');
    if(!visibleItems.length){
      el.innerHTML = '';
      if(section)section.style.display='none';
      return;
    }
    if(section)section.style.display='';
    const render = item => (item.type === 'tv' || item.seasons) ? sCardHTML(item) : cardHTML(item);
    el.innerHTML = visibleItems.map(render).join('');
  };
})();

/* SV_EXACT_DETAIL_BINDING_PATCH_V1 */
(function(){
  if(window.__svExactDetailBindingPatchV1)return;
  window.__svExactDetailBindingPatchV1=true;

  const movieKeys=new WeakMap(),seriesKeys=new WeakMap();
  let movieSeq=0,seriesSeq=0,seriesRequest=0;

  function bindKey(map,prefix,item,next){
    if(!item||typeof item!=='object')return '';
    let key=map.get(item);
    if(!key){
      key=`${prefix}-exact-${next()}`;
      map.set(item,key);
    }
    return key;
  }

  registerMovieForDetail=function(movie){
    const key=bindKey(movieKeys,'md',movie,()=>++movieSeq);
    if(key)_movieDetailRegistry.set(key,movie);
    return key;
  };

  registerSeriesForDetail=function(show){
    const key=bindKey(seriesKeys,'sd',show,()=>++seriesSeq);
    if(key)_seriesDetailRegistry.set(key,show);
    return key;
  };

  function titleKey(value){
    let s=String(value||'');
    try{
      if(typeof cleanDisplayTitle==='function')s=cleanDisplayTitle(s);
    }catch{}

    return s.normalize('NFKD').toLowerCase()
      .replace(/\[[^\]]*\]/g,' ')
      .replace(/\((?=[^)]*(?:tv series|series|720p|1080p|2160p|480p|4k|web|bluray|x264|x265|hevc|(?:19|20)\d{2}))[^)]*\)/g,' ')
      .replace(/\b(?:tv series|series|season|complete|dual audio|multi audio|web[- ]?dl|webrip|bluray|brrip|hdrip|hdtv|x264|x265|hevc|aac|ddp|nf|amzn|hmax|dsnp|2160p|1080p|720p|480p|4k)\b/g,' ')
      .replace(/\b(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?\b/g,' ')
      .replace(/[^\p{L}\p{N}]+/gu,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function yearKey(item){
    return String(item?.year||'').match(/(?:19|20)\d{2}/)?.[0]||'';
  }

  function episodeCount(item){
    return Object.values(item?.seasons||{})
      .reduce((count,eps)=>count+(Array.isArray(eps)?eps.length:0),0);
  }

  function sameSeries(a,b){
    const aid=String(a?.tmdbId||'').trim();
    const bid=String(b?.tmdbId||'').trim();

    if(aid&&bid&&aid!==bid)return false;
    if(titleKey(a?.name||a?.title)!==titleKey(b?.name||b?.title))return false;

    const ay=yearKey(a),by=yearKey(b);
    return !(ay&&by&&ay!==by);
  }

  async function fetchExactSeries(show){
    const name=show?.name||show?.title||'';
    if(!name)return null;

    const params=new URLSearchParams({
      q:name,
      page:'0',
      limit:'120',
      massive:'1'
    });

    const response=await fetchWithTimeout(
      `/api/series?${params.toString()}`,
      {},
      12000
    );

    if(!response?.ok)return null;

    const body=await response.json();
    const list=Array.isArray(body)
      ? body
      : Array.isArray(body?.series) ? body.series : [];

    return list
      .filter(item=>sameSeries(item,show))
      .sort((a,b)=>
        episodeCount(b)-episodeCount(a) ||
        Number(!!b.isFtp)-Number(!!a.isFtp)
      )[0]||null;
  }

  openSeriesDetail=async function(key){
    const show=_seriesDetailRegistry.get(key);
    if(!show)return;

    const request=++seriesRequest;

    // Always open the exact card clicked.
    showSeriesDetail(show);

    if(episodeCount(show)>0)return;

    try{
      showToast('Loading episodes...');

      const full=await fetchExactSeries(show);

      // Ignore an older response after another title was clicked.
      if(request!==seriesRequest)return;
      if(!document.getElementById('seriesModal')?.classList.contains('open'))return;

      // Never accept a different or fuzzy-matched series.
      if(full&&sameSeries(full,show)&&episodeCount(full)>0){
        _seriesDetailRegistry.set(key,full);

        const index=series.findIndex(item=>sameSeries(item,show));
        if(index>=0)series[index]=full;
        else series.push(full);

        showSeriesDetail(full);
      }
    }catch(error){
      console.warn('[Series detail] Exact hydration failed:',error.message);
    }
  };
})();