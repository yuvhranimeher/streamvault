(function(){
  const SEARCH_DELAY = 45;
  const PAGE_LIMIT = 72;
  const MOBILE_LIMIT = 36;
  const cache = new Map();
  let timer = 0;
  let controller = null;
  let activeQuery = '';
  let activePage = 1;
  let activePages = 1;
  let loading = false;
  let lastTarget = 'desktop';

  function isSeriesItem(item){
    return !!(item && (item._isSeries || item.type === 'series' || item.type === 'tv' || item.seasons));
  }

  function resultHTML(item){
    try{return isSeriesItem(item) ? sCardHTML(item) : cardHTML(item);}catch(err){console.warn('[Search] card render failed:', err);return '';}
  }

  function cacheKey(q, page, limit, kind){
    return `${q.toLowerCase()}|${page}|${limit}|${kind || 'mixed'}`;
  }

  async function fetchResults(q, page, limit, kind='mixed'){
    const key = cacheKey(q, page, limit, kind);
    if(cache.has(key))return cache.get(key);
    if(controller)controller.abort();
    controller = new AbortController();
    const params = new URLSearchParams({ q, kind, page:String(page), limit:String(limit), massive:'1' });
    const res = await fetch(`/api/search?${params.toString()}`, { cache:'no-store', signal:controller.signal });
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

  function renderItems(grid, items, append){
    const html = (items || []).map(resultHTML).join('');
    requestAnimationFrame(()=>{
      if(append)grid.insertAdjacentHTML('beforeend', html);
      else grid.innerHTML = html;
      if(typeof svQueuePosterImages === 'function')svQueuePosterImages(grid);
    });
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

    if(!query){
      activeQuery = '';
      activePage = 1;
      activePages = 1;
      if(mobile){ if(grid)grid.innerHTML = ''; if(label)label.textContent = ''; }
      else renderRecent(grid, label);
      return;
    }

    if(!mobile)setSearchViewVisible();
    if(!append){
      activeQuery = query;
      activePage = 1;
      activePages = 1;
      if(label)label.textContent = `Searching "${query}"...`;
      if(grid && !grid.children.length)grid.innerHTML = '<div class="downloads-empty">Searching...</div>';
    }

    loading = true;
    try{
      const data = await fetchResults(query, page, limit, opts.kind || 'mixed');
      if(query !== activeQuery && !append)return;
      const items = Array.isArray(data?.items) ? data.items : [];
      const total = Number(data?.total || items.length || 0);
      activePage = Number(data?.page || page) || page;
      activePages = Number(data?.pages || Math.ceil(total / limit) || 1) || 1;
      if(label)label.textContent = total ? `${total.toLocaleString()} result${total === 1 ? '' : 's'} for "${query}"` : `No results for "${query}"`;
      if(!grid)return;
      if(!items.length && !append)renderEmptyState(grid, label, query);
      else renderItems(grid, items, append);
    }catch(err){
      if(err.name !== 'AbortError'){
        console.warn('[Search] failed:', err);
        renderEmptyState(grid, label, query);
      }
    }finally{ loading = false; }
  }

  renderSearchPage = function(q=''){
    const input = document.getElementById('searchPageInput');
    if(input && input.value !== q && document.activeElement !== input)input.value = q;
    return runSearch(q, { mobile:false, append:false });
  };

  handleSearch = function(q){
    clearTimeout(timer);
    timer = setTimeout(()=>runSearch(q, { append:false }), SEARCH_DELAY);
  };

  document.addEventListener('scroll', ()=>{
    if(currentTab !== 'search' || loading || lastTarget !== 'desktop')return;
    if(!activeQuery || activePage >= activePages)return;
    const nearBottom = window.innerHeight + window.scrollY > document.body.offsetHeight - 800;
    if(nearBottom)runSearch(activeQuery, { mobile:false, append:true });
  }, { passive:true });

  const mobileResults = document.getElementById('mobileSearchGrid');
  mobileResults?.addEventListener('scroll', ()=>{
    if(loading || lastTarget !== 'mobile')return;
    if(!activeQuery || activePage >= activePages)return;
    if(mobileResults.scrollTop + mobileResults.clientHeight > mobileResults.scrollHeight - 500){
      runSearch(activeQuery, { mobile:true, append:true });
    }
  }, { passive:true });
})();
