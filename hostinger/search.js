(function(){
  const BOOT_SEARCH_VERSION = '20260624-playable-only-search1';
  const BOOT_INDEX_URL = `/boot-search-index.json?v=${BOOT_SEARCH_VERSION}`;
  const BOOT_INDEX_API_URL = `/api/boot-search-index?v=${BOOT_SEARCH_VERSION}`;
  const SEARCH_DELAY = 90;
  const SEARCH_REFINE_DELAY = 700;
  const INSTANT_LIMIT = 40;
  const PAGE_LIMIT = 72;
  const MOBILE_LIMIT = 36;
  const cache = new Map();
  const bootQueryCache = new Map();
  let timer = 0;
  let refineTimer = 0;
  let controller = null;
  let bootIndex = null;
  let bootIndexPromise = null;
  let searchSeq = 0;
  let activeQuery = '';
  let activePage = 1;
  let activePages = 1;
  let loading = false;
  let lastTarget = 'desktop';
  const SEARCH_INPUT_IDS = ['searchInputDesktop', 'searchInputMobile'];

  function isSeriesItem(item){
    return !!(item && (item._isSeries || item.type === 'series' || item.type === 'tv' || item.seasons));
  }

  function searchInputs(){
    return SEARCH_INPUT_IDS.map(id=>document.getElementById(id)).filter(Boolean);
  }

  function searchQueryFromInputs(){
    const active = document.activeElement;
    if(active && SEARCH_INPUT_IDS.includes(active.id))return active.value || '';
    const desktop = document.getElementById('searchInputDesktop');
    if(desktop?.value)return desktop.value;
    return document.getElementById('searchInputMobile')?.value || '';
  }

  function updateSearchControls(){
    searchInputs().forEach(input=>{
      const wrap = input.closest('.search-box,.search-overlay-box');
      const hasQuery = !!String(input.value || '').trim();
      if(wrap)wrap.classList.toggle('has-query', hasQuery);
      const clear = wrap?.querySelector('.search-clear-btn');
      if(clear){
        clear.setAttribute('aria-hidden', hasQuery ? 'false' : 'true');
        clear.tabIndex = hasQuery ? 0 : -1;
      }
    });
  }

  function syncSearchInputs(q, source=null){
    const value = String(q || '');
    searchInputs().forEach(input=>{
      if(input !== source && input.value !== value)input.value = value;
    });
    updateSearchControls();
  }

  function focusGlobalSearchInput(){
    const overlayOpen = document.getElementById('searchOverlay')?.classList.contains('open');
    const target = overlayOpen ? document.getElementById('searchInputMobile') : document.getElementById('searchInputDesktop');
    target?.focus?.();
  }

  function resultHTML(item){
    if(typeof isPlayableMediaItem === 'function' && !isPlayableMediaItem(item))return '';
    try{return isSeriesItem(item) ? sCardHTML(item) : cardHTML(item);}catch(err){console.warn('[Search] card render failed:', err);return '';}
  }

  function normalizeSearchText(value){
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function searchTokens(value){
    const stop = new Set(['in','on','of','to','a','an','the','and','or','for','with','by','from']);
    const seen = new Set();
    return normalizeSearchText(value).split(' ').filter(token=>{
      if(!token || token.length < 2 || stop.has(token) || seen.has(token))return false;
      seen.add(token);
      return true;
    });
  }

  function expandBootSearchItem(row, fields){
    if(!Array.isArray(row))return row;
    const item = {};
    (fields || []).forEach((field, index)=>{
      const value = row[index];
      if(value === '' || value === null || value === undefined)return;
      if(field === 'type')item.type = value === 's' ? 'series' : 'movie';
      else if(field === 'isFtp' || field === 'hasStream')item[field] = value === 1 || value === true;
      else item[field] = value;
    });
    item.name = item.name || item.title || '';
    if(item.type === 'series'){
      item._isSeries = true;
      item.isSummary = true;
    }
    return item;
  }

  function adoptBootIndex(data){
    if(!data || data.version !== BOOT_SEARCH_VERSION || !Array.isArray(data.items))return null;
    const items = Array.isArray(data.fields)
      ? data.items.map(row=>expandBootSearchItem(row, data.fields))
      : data.items;
    const playableItems=typeof filterPlayableMediaItems === 'function' ? filterPlayableMediaItems(items) : items;
    bootIndex = { ...data, items:playableItems, total:playableItems.length };
    return bootIndex;
  }

  function ensureBootIndex(){
    if(bootIndex)return Promise.resolve(bootIndex);
    if(window.__svBootSearchIndex)adoptBootIndex(window.__svBootSearchIndex);
    if(bootIndex)return Promise.resolve(bootIndex);
    if(bootIndexPromise)return bootIndexPromise;
    const early = window.__svBootSearchIndexPromise;
    bootIndexPromise = (early || fetch(BOOT_INDEX_URL, {
      cache:'force-cache',
      headers:{ Accept:'application/json' }
    })
      .then(res=>{
        if(res.ok)return res.json();
        throw new Error(`boot index HTTP ${res.status}`);
      })
      .catch(()=>{
        if(window.StreamVaultConfig?.backendStatus?.available !== true)return null;
        return fetchWithTimeout(BOOT_INDEX_API_URL, {
          cache:'force-cache',
          headers:{ Accept:'application/json' }
        }, 3500).then(res=>res.ok ? res.json() : null);
      }))
      .then(adoptBootIndex)
      .catch(err=>{
        console.warn('[Search] boot index unavailable:', err?.message || err);
        return null;
      });
    return bootIndexPromise;
  }

  function bootTokenScore(term, token){
    if(token === term)return 220;
    if(token.startsWith(term))return 145;
    if(term.length >= 4 && token.includes(term))return 80;
    return 0;
  }

  function bootSearchScore(item, terms, queryNorm, kind){
    if(!item || !terms.length)return -1;
    const type = isSeriesItem(item) ? 'series' : 'movie';
    if(kind === 'movie' && type !== 'movie')return -1;
    if(kind === 'series' && type !== 'series')return -1;
    const nameNorm = item.normalizedTitle || normalizeSearchText(item.name || item.title || '');
    const searchNorm = item.searchText || normalizeSearchText([
      item.name,
      item.title,
      item.file,
      item.year,
      item.genre,
      item.category
    ].filter(Boolean).join(' '));
    const tokens = Array.isArray(item.searchTokens) ? item.searchTokens : (item.searchTokens = searchTokens(searchNorm));
    let score = 0;
    if(nameNorm === queryNorm)score += 9000;
    else if(queryNorm && nameNorm.startsWith(queryNorm + ' '))score += 7200;
    else if(queryNorm && nameNorm.includes(queryNorm))score += 4800;
    for(const term of terms){
      let best = 0;
      for(const token of tokens){
        const s = bootTokenScore(term, token);
        if(s > best)best = s;
        if(best >= 220)break;
      }
      if(!best && !searchNorm.includes(term))return -1;
      score += best || 25;
    }
    if(item.poster || item.backdrop)score += 350;
    if(!item.isFtp)score += 220;
    if(type === 'series')score += 60;
    return score;
  }

  function searchBootIndex(q, limit, kind='mixed'){
    if(!bootIndex || !Array.isArray(bootIndex.items))return {items:[], total:0};
    const queryNorm = normalizeSearchText(q);
    const terms = searchTokens(q);
    if(!terms.length)return {items:[], total:0};
    const scored = bootIndex.items
      .filter(item=>typeof isPlayableMediaItem !== 'function' || isPlayableMediaItem(item))
      .map(item=>({item, score:bootSearchScore(item, terms, queryNorm, kind)}))
      .filter(row=>row.score > 0)
      .sort((a,b)=>b.score-a.score || String(a.item.name || '').localeCompare(String(b.item.name || '')));
    return {items:scored.slice(0, limit).map(row=>row.item), total:scored.length};
  }

  async function fetchBootQuery(q, limit, kind='mixed'){
    if(window.StreamVaultConfig?.backendStatus?.available !== true)return null;
    const key = cacheKey(q, 1, limit, `boot-${kind}`);
    if(bootQueryCache.has(key))return bootQueryCache.get(key);
    const params = new URLSearchParams({ q, kind, limit:String(limit), v:BOOT_SEARCH_VERSION });
    const promise = fetchWithTimeout(`/api/boot-search-index?${params.toString()}`, {
      cache:'force-cache',
      headers:{ Accept:'application/json' }
    }, 3500)
      .then(res=>res.ok ? res.json() : null)
      .catch(err=>{
        console.warn('[Search] boot query failed:', err?.message || err);
        return null;
      });
    bootQueryCache.set(key, promise);
    if(bootQueryCache.size > 60)bootQueryCache.delete(bootQueryCache.keys().next().value);
    return promise;
  }

  function renderBootResults(grid, label, query, items, total, append=false){
    if(!grid || !Array.isArray(items) || !items.length)return false;
    if(!append && grid.dataset?.svSearchSource === 'refined' && grid.dataset.svSearchQuery === query)return false;
    activePage = 1;
    activePages = 1;
    if(label)label.textContent = `${Number(total || items.length).toLocaleString()} instant result${Number(total || items.length) === 1 ? '' : 's'} for "${query}"`;
    if(!append){
      grid.dataset.svSearchSource = 'boot';
      grid.dataset.svSearchQuery = query;
    }
    renderItems(grid, items, append, query);
    return true;
  }

  function cacheKey(q, page, limit, kind){
    return `${q.toLowerCase()}|${page}|${limit}|${kind || 'mixed'}`;
  }

  function abortRefinement(){
    clearTimeout(refineTimer);
    if(controller){
      controller.abort();
      controller = null;
    }
  }

  async function fetchResults(q, page, limit, kind='mixed'){
    if(window.StreamVaultConfig?.backendStatus?.available !== true)throw new Error('Backend offline');
    const key = cacheKey(q, page, limit, kind);
    if(cache.has(key))return cache.get(key);
    if(controller)controller.abort();
    controller = new AbortController();
    const params = new URLSearchParams({ q, kind, page:String(page), limit:String(limit), massive:'0', background:'1' });
    const res = await fetchWithTimeout(`/api/search?${params.toString()}`, { cache:'no-store', signal:controller.signal }, 3500);
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache.set(key, data);
    if(cache.size > 80)cache.delete(cache.keys().next().value);
    return data;
  }

  function renderEmptyState(grid, label, q){
    if(label)label.textContent = q ? `No results for "${q}"` : 'Start typing to search your vault';
    if(grid)grid.innerHTML = q
      ? '<div class="empty"><h2>Nothing found</h2><p>Try another spelling or fewer words.</p></div>'
      : '<div class="empty"><h2>Search your vault</h2><p>Movies and shows will appear here.</p></div>';
  }

  function renderRecent(grid, label){
    const recent = typeof libraryCollection === 'function' ? libraryCollection('recent').slice(0,12) : [];
    if(label)label.textContent = recent.length ? 'Recently opened' : 'Start typing to search your vault';
    if(!grid)return;
    if(recent.length){
      if(typeof svRenderGridProgressive === 'function')svRenderGridProgressive(grid, recent, item=>isSeriesItem(item) ? sCardHTML(item) : cardHTML(item), 24);
      else grid.innerHTML = recent.map(resultHTML).join('');
    }else renderEmptyState(grid, label, '');
  }

  function setSearchViewVisible(){
    try{ if(location.hash === '#downloads')history.replaceState(null, '', location.pathname + location.search); }catch{}
    currentTab = 'search';
    ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','downloadsSection','liveSection','mobileMp4Section'].forEach(id=>{
      const el = document.getElementById(id);
      if(el)el.style.display = 'none';
    });
    const section = document.getElementById('sectionSection');
    if(section)section.classList.remove('open');
    const searchSection = document.getElementById('searchSection');
    if(searchSection)searchSection.style.display = 'block';
    ['bnDiscover','bnShows','bnMovies','bnLibrary','bnDownloads','bnSearch'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
    document.getElementById('bnSearch')?.classList.add('active');
    document.getElementById('downloadNavBtn')?.classList.remove('active');
  }

  function renderItems(grid, items, append, expectedQuery=''){
    const visibleItems=typeof filterPlayableMediaItems === 'function' ? filterPlayableMediaItems(items) : (items || []);
    const html = visibleItems.map(resultHTML).join('');
    const seq = searchSeq;
    requestAnimationFrame(()=>{
      if(expectedQuery && (expectedQuery !== activeQuery || seq !== searchSeq))return;
      if(append)grid.insertAdjacentHTML('beforeend', html);
      else grid.innerHTML = html;
      if(typeof svQueuePosterImages === 'function')svQueuePosterImages(grid);
    });
  }

  async function runRefinedSearch(query, opts={}){
    const seq = opts.seq ?? searchSeq;
    const mobile = !!opts.mobile;
    const append = !!opts.append;
    const page = opts.page || (append ? activePage + 1 : 1);
    const limit = opts.limit || (mobile ? MOBILE_LIMIT : PAGE_LIMIT);
    const kind = opts.kind || 'mixed';
    const grid = opts.grid || (mobile ? document.getElementById('mobileSearchGrid') : document.getElementById('searchGrid'));
    const label = opts.label || (mobile ? document.getElementById('mobileSearchLabel') : document.getElementById('searchLabel'));
    if(seq !== searchSeq || query !== activeQuery)return;

    loading = true;
    try{
      const data = await fetchResults(query, page, limit, kind);
      if(seq !== searchSeq || query !== activeQuery)return;
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const items = typeof filterPlayableMediaItems === 'function' ? filterPlayableMediaItems(rawItems) : rawItems;
      const total = Number(data?.total || items.length || 0);
      activePage = Number(data?.page || page) || page;
      activePages = Number(data?.pages || Math.ceil(total / limit) || 1) || 1;
      if(!grid)return;
      const hasRenderedCards = !!grid.querySelector('.card');
      if(label){
        label.textContent = total
          ? `${total.toLocaleString()} result${total === 1 ? '' : 's'} for "${query}"`
          : (hasRenderedCards ? label.textContent : `No results for "${query}"`);
      }
      if(!items.length && !append){
        if(!hasRenderedCards)renderEmptyState(grid, label, query);
      }else{
        if(!append){
          grid.dataset.svSearchSource = 'refined';
          grid.dataset.svSearchQuery = query;
        }
        renderItems(grid, items, append, query);
      }
    }catch(err){
      if(err.name !== 'AbortError'){
        console.warn('[Search] failed:', err);
        if(!grid?.querySelector?.('.card'))renderEmptyState(grid, label, query);
      }
    }finally{
      if(seq === searchSeq)loading = false;
    }
  }

  function scheduleRefinedSearch(query, opts={}){
    clearTimeout(refineTimer);
    if(window.StreamVaultConfig?.backendStatus?.available !== true)return;
    const seq = opts.seq ?? searchSeq;
    refineTimer = setTimeout(()=>{
      runRefinedSearch(query, { ...opts, seq, append:false });
    }, SEARCH_REFINE_DELAY);
  }

  async function runSearch(q, opts={}){
    const query = String(q || '').trim();
    const mobile = opts.mobile ?? document.getElementById('searchOverlay')?.classList.contains('open');
    const append = !!opts.append;
    const page = append ? activePage + 1 : 1;
    const limit = mobile ? MOBILE_LIMIT : PAGE_LIMIT;
    const grid = mobile ? document.getElementById('mobileSearchGrid') : document.getElementById('searchGrid');
    const label = mobile ? document.getElementById('mobileSearchLabel') : document.getElementById('searchLabel');
    lastTarget = mobile ? 'mobile' : 'desktop';

    if(append){
      if(loading)return;
      return runRefinedSearch(activeQuery || query, { mobile, append:true, page, limit, kind:opts.kind || 'mixed', grid, label, seq:searchSeq });
    }

    const seq = ++searchSeq;
    abortRefinement();

    if(!query){
      activeQuery = '';
      activePage = 1;
      activePages = 1;
      if(mobile){ if(grid)grid.innerHTML = ''; if(label)label.textContent = ''; }
      else renderRecent(grid, label);
      return;
    }

    if(!mobile)setSearchViewVisible();
    let bootRendered = false;
    const kind = opts.kind || 'mixed';
    activeQuery = query;
    activePage = 1;
    activePages = 1;
    if(grid){
      grid.dataset.svSearchSource = '';
      grid.dataset.svSearchQuery = query;
    }

    const instantLimit = Math.min(limit, INSTANT_LIMIT);
    const boot = searchBootIndex(query, instantLimit, kind);
    bootRendered = renderBootResults(grid, label, query, boot.items, boot.total, false);
    if(!bootRendered){
      ensureBootIndex().then(()=>{
        if(seq !== searchSeq || query !== activeQuery)return;
        const readyBoot = searchBootIndex(query, instantLimit, kind);
        renderBootResults(grid, label, query, readyBoot.items, readyBoot.total, false);
      });
      fetchBootQuery(query, instantLimit, kind).then(data=>{
        if(seq !== searchSeq || query !== activeQuery || !data?.items?.length)return;
        renderBootResults(grid, label, query, data.items, data.total || data.items.length, false);
      });
      if(label)label.textContent = `Preparing instant results for "${query}"`;
      if(grid && !grid.children.length)grid.innerHTML = '<div class="downloads-empty">Preparing instant results...</div>';
    }

    loading = false;
    scheduleRefinedSearch(query, { mobile, limit, kind, grid, label, seq });
  }

  renderSearchPage = function(q=''){
    syncSearchInputs(q);
    return runSearch(q, { mobile:false, append:false });
  };

  handleSearch = function(q){
    const source = SEARCH_INPUT_IDS.includes(document.activeElement?.id) ? document.activeElement : null;
    syncSearchInputs(q, source);
    clearTimeout(timer);
    searchSeq += 1;
    abortRefinement();
    timer = setTimeout(()=>runSearch(q, { append:false }), SEARCH_DELAY);
  };

  clearGlobalSearch = function(opts={}){
    clearTimeout(timer);
    searchSeq += 1;
    abortRefinement();
    activeQuery = '';
    activePage = 1;
    activePages = 1;
    loading = false;
    syncSearchInputs('');

    const mobileOpen = document.getElementById('searchOverlay')?.classList.contains('open');
    const mobileGrid = document.getElementById('mobileSearchGrid');
    const mobileLabel = document.getElementById('mobileSearchLabel');
    if(mobileGrid)mobileGrid.innerHTML = '';
    if(mobileLabel)mobileLabel.textContent = '';

    if(currentTab === 'search' && !mobileOpen){
      renderRecent(document.getElementById('searchGrid'), document.getElementById('searchLabel'));
    }
    if(opts.focus !== false)focusGlobalSearchInput();
  };

  window.getGlobalSearchQuery = searchQueryFromInputs;
  window.updateGlobalSearchControls = updateSearchControls;
  window.focusGlobalSearchInput = focusGlobalSearchInput;

  let desktopScrollRaf=0;
  document.addEventListener('scroll', ()=>{
    if(desktopScrollRaf)return;
    desktopScrollRaf=requestAnimationFrame(()=>{
      desktopScrollRaf=0;
      if(currentTab !== 'search' || loading || lastTarget !== 'desktop')return;
      if(!activeQuery || activePage >= activePages)return;
      const nearBottom = window.innerHeight + window.scrollY > document.body.offsetHeight - 800;
      if(nearBottom)runSearch(activeQuery, { mobile:false, append:true });
    });
  }, { passive:true });

  const mobileResults = document.getElementById('mobileSearchGrid');
  let mobileScrollRaf=0;
  mobileResults?.addEventListener('scroll', ()=>{
    if(mobileScrollRaf)return;
    mobileScrollRaf=requestAnimationFrame(()=>{
      mobileScrollRaf=0;
      if(loading || lastTarget !== 'mobile')return;
      if(!activeQuery || activePage >= activePages)return;
      if(mobileResults.scrollTop + mobileResults.clientHeight > mobileResults.scrollHeight - 500){
        runSearch(activeQuery, { mobile:true, append:true });
      }
    });
  }, { passive:true });

  document.addEventListener('input', event=>{
    if(SEARCH_INPUT_IDS.includes(event.target?.id))updateSearchControls();
  });

  updateSearchControls();
  ensureBootIndex();
})();
