window.API_BASE = "https://streamvault.fit";
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

  window._svEagerImageBudget = Number.isFinite(window._svEagerImageBudget)
    ? window._svEagerImageBudget
    : ((window._svWeakDevice || innerWidth < 760) ? 5 : 8);

  svConsumeImageAttrs = function(priority=false, immediate=false){
    const eager = priority || immediate || window._svEagerImageBudget-- > 0;
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
    return `${window.API_BASE || "https://streamvault.fit"}/poster-cache?url=${encodeURIComponent(normalized)}&w=${width}`;
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
      const r = await fetch(`${API_BASE}/api/series/detail?${params.toString()}`, {
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





/* HOSTINGER DETAIL RESTORE V2 */
(function(){
  window.API_BASE = window.API_BASE || "https://streamvault.fit";

  function norm(v){
    return String(v || "")
      .toLowerCase()
      .replace(/\b(tv series|series|dual audio|multi audio|hindi|english|1080p|720p|480p|web[- ]?dl|webrip|bluray|x264|x265|hevc|aac|esub|msubs)\b/g," ")
      .replace(/\((?:19|20)\d{2}[^\)]*\)/g," ")
      .replace(/\[[^\]]*\]/g," ")
      .replace(/[^\w]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function hasEpisodes(s){
    return !!(s && s.seasons && Object.values(s.seasons).some(eps=>Array.isArray(eps) && eps.length));
  }

  function pageMode(){
    document.body.classList.add("sv-detail-page-mode");
    window.scrollTo(0,0);
  }

  function exitPageMode(){
    document.body.classList.remove("sv-detail-page-mode");
  }

  function injectCss(){
    if(document.getElementById("sv-detail-page-css")) return;
    const st=document.createElement("style");
    st.id="sv-detail-page-css";
    st.textContent=`
      body.sv-detail-page-mode{overflow:hidden!important}
      body.sv-detail-page-mode #seriesModal.open,
      body.sv-detail-page-mode #movieDetailModal.open{
        position:fixed!important; inset:0!important; width:100vw!important; height:100vh!important;
        max-width:none!important; max-height:none!important; margin:0!important; border-radius:0!important;
        background:#000!important; z-index:999999!important; overflow-y:auto!important;
      }
      body.sv-detail-page-mode .series-modal-inner,
      body.sv-detail-page-mode .detail-body{max-width:1180px!important;margin:0 auto!important}
      body.sv-detail-page-mode .sm-hero,
      body.sv-detail-page-mode .detail-hero{min-height:560px!important}
    `;
    document.head.appendChild(st);
  }

  async function fetchFullSeries(show){
    if(hasEpisodes(show)) return show;

    const target = norm(show.name || show.title || show.file || "");
    if(!target) return show;

    const urls = [
      window.API_BASE + "/api/series?q=" + encodeURIComponent(target) + "&limit=200&massive=1",
      window.API_BASE + "/api/series"
    ];

    for(const url of urls){
      try{
        const data = await fetch(url,{cache:"no-store"}).then(r=>r.json());
        const list = Array.isArray(data) ? data : (data.series || []);
        const exact = list.find(x => norm(x.name || x.title || x.file || "") === target && hasEpisodes(x));
        if(exact) return exact;
      }catch(e){}
    }
    return show;
  }

  function install(){
    if(typeof openSeriesDetail!=="function" || typeof showSeriesDetail!=="function" || typeof openMovieDetail!=="function"){
      setTimeout(install,100);
      return;
    }

    injectCss();

    const nativeShowSeriesDetail = showSeriesDetail;
    showSeriesDetail = function(show){
      nativeShowSeriesDetail(show);
      pageMode();
    };

    const nativeOpenSeriesDetail = openSeriesDetail;
    openSeriesDetail = async function(key){
      try{
        const show = _seriesDetailRegistry && _seriesDetailRegistry.get(key);
        if(!show) return nativeOpenSeriesDetail(key);

        const full = await fetchFullSeries(show);
        _seriesDetailRegistry.set(key, full);

        if(Array.isArray(series)){
          const i = series.findIndex(s => norm(s.name || s.title || s.file) === norm(full.name || full.title || full.file));
          if(i >= 0) series[i] = full;
          else series.push(full);
        }

        showSeriesDetail(full);
      }catch(e){
        console.error("[detail restore v2 failed]", e);
        nativeOpenSeriesDetail(key);
      }
    };

    const nativeOpenMovieDetail = openMovieDetail;
    openMovieDetail = function(key){
      nativeOpenMovieDetail(key);
      pageMode();
    };

    const nativeCloseSeriesModal = closeSeriesModal;
    closeSeriesModal = function(){
      nativeCloseSeriesModal();
      exitPageMode();
    };

    const nativeCloseMovieDetail = closeMovieDetail;
    closeMovieDetail = function(){
      nativeCloseMovieDetail();
      exitPageMode();
    };
  }

  install();
})();
