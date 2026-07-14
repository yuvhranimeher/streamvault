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
    return url.replace(/\/t\/p\/(?:original|w\d+)\//, `/t/p/${size}/`);
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
      const r = await fetchWithTimeout(`/api/series/detail?${params.toString()}`, {
        signal:detailRequestController?.signal
      }, 3500);
      if(r.ok){
        const payload = await r.json();
        const full = window.StreamVaultConfig?.normalizeBackendUrls?.(payload) ?? payload;
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
      3500
    );

    if(!response?.ok)return null;

    const payload=await response.json();
    const body=window.StreamVaultConfig?.normalizeBackendUrls?.(payload) ?? payload;
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

/* SV_EXACT_DETAIL_BINDING_PATCH_V2 */
(function(){
  if (window.__svExactDetailBindingPatchV2) return;
  window.__svExactDetailBindingPatchV2 = true;

  const movieKeys = new WeakMap();
  const seriesKeys = new WeakMap();
  let movieSeq = 0;
  let seriesSeq = 0;
  let seriesRequest = 0;

  function bindExactKey(map, prefix, item, seq){
    if (!item || typeof item !== 'object') return '';
    let key = map.get(item);
    if (!key){
      key = prefix + '-exact-' + seq();
      map.set(item, key);
    }
    return key;
  }

  registerMovieForDetail = function(movie){
    const key = bindExactKey(movieKeys, 'md', movie, () => ++movieSeq);
    if (key) _movieDetailRegistry.set(key, movie);
    return key;
  };

  registerSeriesForDetail = function(show){
    const key = bindExactKey(seriesKeys, 'sd', show, () => ++seriesSeq);
    if (key) _seriesDetailRegistry.set(key, show);
    return key;
  };

  function normalizedTitle(value){
    let text = String(value || '');
    try {
      if (typeof cleanDisplayTitle === 'function') text = cleanDisplayTitle(text);
    } catch {}

    return text
      .normalize('NFKD')
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^)]*(?:tv series|mini series|series|720p|1080p|2160p|480p|4k|web|bluray|x264|x265|hevc|19\d{2}|20\d{2})[^)]*\)/g, ' ')
      .replace(/\b(?:tv series|mini series|series|complete|dual audio|multi audio|web[- ]?dl|webrip|bluray|brrip|hdrip|hdtv|x264|x265|hevc|aac|ddp|nf|amzn|hmax|dsnp|2160p|1080p|720p|480p|4k)\b/g, ' ')
      .replace(/\b(?:19|20)\d{2}\b/g, ' ')
      .replace(/\bs\d{1,2}\b/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function yearOf(item){
    return String(item && item.year || '').match(/(?:19|20)\d{2}/)?.[0] || '';
  }

  function episodeCount(item){
    return Object.values(item && item.seasons || {})
      .reduce((total, episodes) => total + (Array.isArray(episodes) ? episodes.length : 0), 0);
  }

  function sameExactSeries(a, b){
    const aId = String(a && a.tmdbId || '').trim();
    const bId = String(b && b.tmdbId || '').trim();
    if (aId && bId && aId !== bId) return false;

    const aTitle = normalizedTitle(a && (a.name || a.title));
    const bTitle = normalizedTitle(b && (b.name || b.title));
    if (!aTitle || aTitle !== bTitle) return false;

    const aYear = yearOf(a);
    const bYear = yearOf(b);
    return !(aYear && bYear && aYear !== bYear);
  }

  async function fetchExactSeries(show){
    const name = show && (show.name || show.title) || '';
    if (!name) return null;

    const params = new URLSearchParams({
      q: name,
      page: '0',
      limit: '200',
      massive: '1'
    });

    const response = await fetchWithTimeout('/api/series?' + params.toString(), {}, 3500);
    if (!response || !response.ok) return null;

    const rawPayload = await response.json();
    const payload = window.StreamVaultConfig?.normalizeBackendUrls?.(rawPayload) ?? rawPayload;
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload && payload.series) ? payload.series : [];

    return list
      .filter(item => sameExactSeries(item, show))
      .sort((a, b) => episodeCount(b) - episodeCount(a))[0] || null;
  }

  openSeriesDetail = async function(key){
    const show = _seriesDetailRegistry.get(key);
    if (!show) return;

    const requestId = ++seriesRequest;
    showSeriesDetail(show);

    if (episodeCount(show) > 0) return;

    try {
      showToast('Loading episodes...');
      const full = await fetchExactSeries(show);

      if (requestId !== seriesRequest) return;
      if (currentShow !== show) return;
      if (!document.getElementById('seriesModal')?.classList.contains('open')) return;

      if (full && sameExactSeries(full, show) && episodeCount(full) > 0){
        _seriesDetailRegistry.set(key, full);

        const index = Array.isArray(series)
          ? series.findIndex(item => sameExactSeries(item, show))
          : -1;

        if (index >= 0) series[index] = full;
        else if (Array.isArray(series)) series.push(full);

        showSeriesDetail(full);
      }
    } catch (error) {
      console.warn('[Series detail] Exact hydration failed:', error && error.message || error);
    }
  };
})();

/* SV_EXACT_SERIES_HYDRATION_V4 */
(function(){
  let requestSequence=0;

  function episodeCount(item){
    return Object.values(item?.seasons||{}).reduce(
      (total,episodes)=>total+(Array.isArray(episodes)?episodes.length:0),0
    );
  }

  openSeriesDetail=async function(key){
    const show=_seriesDetailRegistry.get(key);
    if(!show)return;

    const requestId=++requestSequence;
    showSeriesDetail(show);

    try{
      const params=new URLSearchParams();
      if(show.id!=null)params.set('id',String(show.id));
      params.set('name',String(show.name||show.title||''));
      if(show.year)params.set('year',String(show.year));

      const response=await fetchWithTimeout(
        '/api/series/detail?'+params.toString(),
        {cache:'no-store'},
        3500
      );

      if(!response.ok)throw new Error('HTTP '+response.status);

      const payload=await response.json();
      const full=window.StreamVaultConfig?.normalizeBackendUrls?.(payload) ?? payload;

      if(requestId!==requestSequence)return;
      if(!document.getElementById('seriesModal')?.classList.contains('open'))return;
      if(!full||episodeCount(full)<1)return;

      _seriesDetailRegistry.set(key,full);

      if(Array.isArray(series)){
        const index=series.findIndex(item=>
          String(item?.id||'')===String(show?.id||'')
        );

        if(index>=0)series[index]=full;
        else series.push(full);
      }

      showSeriesDetail(full);
    }catch(error){
      console.warn('[Series detail v4]',error?.message||error);
    }
  };
})();


/* SV_SERIES_EPISODE_RENDER_V5 */
(function(){
  if(window.__svSeriesEpisodeRenderV5) return;
  window.__svSeriesEpisodeRenderV5 = true;

  let requestSequence = 0;

  function numberFrom(value, fallback){
    const match = String(value ?? "").match(/\d+/);
    const number = match ? Number(match[0]) : Number(fallback);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function episodeList(value){
    if(Array.isArray(value)) return value.filter(Boolean);

    if(value && typeof value === "object"){
      if(Array.isArray(value.episodes)) return value.episodes.filter(Boolean);
      if(Array.isArray(value.items)) return value.items.filter(Boolean);

      return Object.values(value).filter(item =>
        item && typeof item === "object"
      );
    }

    return [];
  }

  function normalizeEpisode(ep, index){
    const episodeNumber = numberFrom(
      ep?.episode ??
      ep?.episodeNumber ??
      ep?.episode_number ??
      ep?.number,
      index + 1
    );

    return {
      ...(ep || {}),
      episode: episodeNumber,
      epTitle:
        ep?.epTitle ||
        ep?.title ||
        ep?.name ||
        ("Episode " + episodeNumber),
      streamUrl:
        window.StreamVaultConfig?.normalizeBackendUrls?.(
          ep?.streamUrl ||
          ep?.url ||
          ep?.src ||
          ""
        ) ||
        "",
      streamId:
        ep?.streamId ??
        ep?.stream_id ??
        ep?.id ??
        null,
      thumb:
        ep?.thumb ||
        ep?.thumbnail ||
        ep?.poster ||
        null
    };
  }

  function normalizeShow(show){
    const output = {};
    const raw = show?.seasons || {};

    if(Array.isArray(raw)){
      raw.forEach((entry, index) => {
        if(!entry) return;

        let seasonNumber;
        let episodes;

        if(Array.isArray(entry)){
          seasonNumber = index === 0 ? 1 : index;
          episodes = entry;
        }else{
          seasonNumber = numberFrom(
            entry.season ??
            entry.seasonNumber ??
            entry.season_number ??
            entry.name,
            index + 1
          );

          episodes = episodeList(entry);
        }

        const normalized = episodes
          .map(normalizeEpisode)
          .sort((a,b) => a.episode - b.episode);

        if(normalized.length) output[seasonNumber] = normalized;
      });
    }else{
      Object.entries(raw).forEach(([key, value], index) => {
        const seasonNumber = numberFrom(
          value?.season ??
          value?.seasonNumber ??
          value?.season_number ??
          key,
          index + 1
        );

        const normalized = episodeList(value)
          .map(normalizeEpisode)
          .sort((a,b) => a.episode - b.episode);

        if(normalized.length) output[seasonNumber] = normalized;
      });
    }

    const seasonNumbers = Object.keys(output)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a,b) => a-b);

    const episodeCount = seasonNumbers.reduce(
      (total, season) => total + output[season].length,
      0
    );

    return {
      ...(show || {}),
      seasons: output,
      seasonCount: seasonNumbers.length,
      episodeCount,
      streamAvailable: episodeCount > 0,
      hasStream: episodeCount > 0,
      isSummary: false
    };
  }

  function sameShow(a, b){
    if(!a || !b) return false;

    const aId = String(a.id || "");
    const bId = String(b.id || "");

    if(aId && bId && aId === bId) return true;

    return String(a.name || a.title || "").toLowerCase() ===
           String(b.name || b.title || "").toLowerCase();
  }

  function storeShow(key, show){
    _seriesDetailRegistry.set(key, show);

    if(!Array.isArray(series)) return;

    const index = series.findIndex(item => sameShow(item, show));

    if(index >= 0) series[index] = show;
    else series.push(show);
  }

  function renderSeasonControls(show){
    const seasons = Object.keys(show.seasons || {})
      .map(Number)
      .filter(Number.isFinite)
      .sort((a,b) => a-b);

    if(!seasons.length){
      const list = document.getElementById("epList");
      if(list) list.innerHTML = noDataHTML();
      return;
    }

    currentShow = show;
    currentSeason = seasons[0];

    const tabs = document.getElementById("seasonTabs");

    const select =
      document.getElementById("seasonSelect") ||
      (tabs?.tagName === "SELECT" ? tabs : null) ||
      tabs?.querySelector?.("select") ||
      document.querySelector("#seriesModal select");

    if(select){
      select.innerHTML = seasons.map(season =>
        '<option value="' + season + '">Season ' + season + '</option>'
      ).join("");

      select.value = String(currentSeason);

      select.onchange = function(){
        currentSeason = Number(this.value);
        renderEpisodes(currentShow, currentSeason);
      };
    }else if(tabs){
      tabs.innerHTML = seasons.map((season, index) =>
        '<button class="season-tab' +
        (index === 0 ? ' active' : '') +
        '" type="button" data-season="' + season + '">' +
        'Season ' + season +
        '</button>'
      ).join("");

      tabs.style.display = seasons.length > 1 ? "flex" : "none";

      tabs.querySelectorAll(".season-tab").forEach(button => {
        button.onclick = function(){
          currentSeason = Number(this.dataset.season);

          tabs.querySelectorAll(".season-tab").forEach(item =>
            item.classList.remove("active")
          );

          this.classList.add("active");
          renderEpisodes(currentShow, currentSeason);
        };
      });
    }

    renderEpisodes(show, currentSeason);

    const firstEpisode = show.seasons[currentSeason]?.[0];
    const playButton = document.getElementById("smPlayBtn");

    if(playButton && firstEpisode){
      playButton.style.display = "";
      playButton.disabled = false;
      playButton.onclick = () =>
        playSeriesEpisode(show.name, currentSeason, 0);
    }
  }

  const originalShowSeriesDetail = showSeriesDetail;

  showSeriesDetail = function(show){
    const normalized = normalizeShow(show);

    currentShow = normalized;
    originalShowSeriesDetail(normalized);

    setTimeout(() => renderSeasonControls(normalized), 0);
    setTimeout(() => renderSeasonControls(normalized), 150);
  };

  openSeriesDetail = async function(key){
    const summary = _seriesDetailRegistry.get(key);
    if(!summary) return;

    const requestId = ++requestSequence;
    const initial = normalizeShow(summary);

    currentShow = initial;
    showSeriesDetail(initial);

    const episodeListElement = document.getElementById("epList");

    if(!initial.episodeCount && episodeListElement){
      episodeListElement.innerHTML =
        '<div class="no-data">Loading episodes...</div>';
    }

    try{
      const params = new URLSearchParams();

      if(summary.id != null){
        params.set("id", String(summary.id));
      }

      params.set(
        "name",
        String(summary.name || summary.title || "")
      );

      if(summary.year){
        params.set("year", String(summary.year));
      }

      const response = await fetchWithTimeout(
        "/api/series/detail?" + params.toString(),
        { cache: "no-store" },
        3500
      );

      if(!response.ok){
        throw new Error("HTTP " + response.status);
      }

      const payload = await response.json();
      const full = normalizeShow(window.StreamVaultConfig?.normalizeBackendUrls?.(payload) ?? payload);

      if(requestId !== requestSequence) return;
      if(!full.episodeCount) throw new Error("No episodes returned");

      storeShow(key, full);
      currentShow = full;
      showSeriesDetail(full);
    }catch(error){
      console.warn(
        "[Series episodes v5]",
        error?.message || error
      );

      if(episodeListElement){
        episodeListElement.innerHTML = noDataHTML();
      }
    }
  };
})();
