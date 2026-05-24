(function(){
  const PAGE_SIZE = 60;
  const SEARCH_DELAY = 250;
  const state = {
    movies: { page: 1, pages: 1, loading: false, q: '', items: [] },
    series: { page: 1, pages: 1, loading: false, q: '', items: [] },
    search: { page: 1, pages: 1, loading: false, q: '', items: [] },
    timers: {}
  };

  function safeJson(res){
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function arrayFromResponse(data, key){
    if(Array.isArray(data))return data;
    if(Array.isArray(data?.[key]))return data[key];
    if(Array.isArray(data?.items))return data.items;
    if(key === 'series' && Array.isArray(data?.shows))return data.shows;
    return [];
  }

  function totalFromResponse(data, items){
    const n = Number(data?.total ?? data?.count ?? data?.totalCount);
    return Number.isFinite(n) && n >= 0 ? n : (items || []).length;
  }

  function pageFromResponse(data, fallback){
    const n = Number(data?.page);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function pagesFromResponse(data, total, limit){
    const n = Number(data?.pages);
    if(Number.isFinite(n) && n >= 0)return n;
    return Math.max(1, Math.ceil((Number(total) || 0) / (Number(limit) || PAGE_SIZE)));
  }

  function activeMovieFilters(){
    return {
      q:(document.getElementById('moviesSearchInput')?.value || '').trim(),
      genre:document.getElementById('moviesGenreFilter')?.value || '',
      lang:document.getElementById('moviesLangFilter')?.value || '',
      yearRange:document.getElementById('moviesYearFilter')?.value || '',
      minRating:document.getElementById('moviesRatingFilter')?.value || '',
      publisher:document.getElementById('moviesPublisherFilter')?.value || '',
      sort:document.getElementById('moviesSortFilter')?.value || 'default'
    };
  }

  function activeSeriesFilters(){
    return {
      q:(document.getElementById('seriesSearchInput')?.value || '').trim(),
      genre:document.getElementById('seriesGenreFilter')?.value || '',
      lang:document.getElementById('seriesLangFilter')?.value || '',
      yearRange:document.getElementById('seriesYearFilter')?.value || '',
      minRating:document.getElementById('seriesRatingFilter')?.value || '',
      sort:document.getElementById('seriesSortFilter')?.value || 'default'
    };
  }

  function renderGridBatch(grid, items, renderer, append){
    if(!grid)return;
    const html = (items || []).map(item => {
      try {
        return renderer(item);
      } catch (err) {
        console.warn('[Render] card failed:', err, item);
        return '';
      }
    }).join('');
    requestAnimationFrame(()=>{
      if(append)grid.insertAdjacentHTML('beforeend', html);
      else grid.innerHTML = html;
      if(typeof svQueuePosterImages === 'function')svQueuePosterImages(grid);
    });
  }

  function setText(id, value){
    const el = document.getElementById(id);
    if(el)el.textContent = value;
  }

  function queryFromMoviesFilters(){
    return (document.getElementById('moviesSearchInput')?.value || '').trim();
  }

  function queryFromSeriesFilters(){
    return (document.getElementById('seriesSearchInput')?.value || '').trim();
  }

  async function fetchMoviesPage(page, append){
    if(state.movies.loading)return;
    state.movies.loading = true;
    const filters = activeMovieFilters();
    const q = filters.q;
    state.movies.q = q;
    const grid = document.getElementById('moviesGrid');
    if(!append && grid)grid.innerHTML = '<div class="downloads-empty">Loading movies...</div>';
    try{
      const endpoint = q
        ? `/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=${PAGE_SIZE}`
        : `/api/movies?page=${page}&limit=${PAGE_SIZE}`;
      const data = await fetch(endpoint).then(safeJson);
      const raw = q ? arrayFromResponse(data, 'items') : arrayFromResponse(data, 'movies');
      const items = raw.filter(item => item && item.name && !isCartoonClient(item) && !(item.type === 'tv' || item.type === 'series' || item.isSummary));
      const total = totalFromResponse(data, items);
      state.movies.page = pageFromResponse(data, page);
      state.movies.pages = pagesFromResponse(data, total, PAGE_SIZE);
      state.movies.items = append ? state.movies.items.concat(items) : items;
      setText('moviesCount', `${total.toLocaleString()} movie${total === 1 ? '' : 's'}`);
      if(typeof renderMoviesChips === 'function')renderMoviesChips(filters);
      if(!items.length && !append){
        grid.innerHTML = '<div class="movies-empty"><h2>No movies found</h2><p>Try different filters</p></div>';
      }else{
        renderGridBatch(grid, items, cardHTML, append);
      }
      const wrap = document.getElementById('moviesLoadMoreWrap');
      if(wrap)wrap.style.display = state.movies.page < state.movies.pages ? 'flex' : 'none';
    }catch(e){
      console.warn('[Movies] paged load failed:', e);
      if(grid)grid.innerHTML = '<div class="movies-empty"><h2>Could not load movies</h2></div>';
    }finally{
      state.movies.loading = false;
    }
  }

  async function fetchSeriesPage(page, append){
    if(state.series.loading)return;
    state.series.loading = true;
    const filters = activeSeriesFilters();
    const q = filters.q;
    state.series.q = q;
    const grid = document.getElementById('seriesGrid');
    if(!append && grid)grid.innerHTML = '<div class="downloads-empty">Loading shows...</div>';
    try{
      const endpoint = q
        ? `/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=${PAGE_SIZE}`
        : `/api/series?page=${page}&limit=${PAGE_SIZE}&summary=1&envelope=1`;
      const data = await fetch(endpoint).then(safeJson);
      const raw = q
        ? arrayFromResponse(data, 'items').filter(item => item.type === 'tv' || item.type === 'series' || item.isSummary)
        : arrayFromResponse(data, 'series');
      const items = raw.filter(item => item && item.name && !isCartoonClient(item));
      const total = totalFromResponse(data, items);
      state.series.page = pageFromResponse(data, page);
      state.series.pages = pagesFromResponse(data, total, PAGE_SIZE);
      state.series.items = append ? state.series.items.concat(items) : items;
      setText('seriesCount', `${total.toLocaleString()} show${total === 1 ? '' : 's'}`);
      if(typeof renderSeriesChips === 'function')renderSeriesChips(filters);
      if(!items.length && !append){
        grid.innerHTML = '<div class="movies-empty"><h2>No series found</h2><p>Try different filters</p></div>';
      }else{
        renderGridBatch(grid, items, sCardHTML, append);
      }
      const wrap = document.getElementById('seriesLoadMoreWrap');
      if(wrap)wrap.style.display = state.series.page < state.series.pages ? 'flex' : 'none';
    }catch(e){
      console.warn('[Series] paged load failed:', e);
      if(grid)grid.innerHTML = '<div class="movies-empty"><h2>Could not load shows</h2></div>';
    }finally{
      state.series.loading = false;
    }
  }

  function perfLoadAllMoviesForBrowse(){}
  async function perfLoadAllSeriesForBrowse(){}
  function perfRenderMoviesPage(){ fetchMoviesPage(1, false); }
  function perfFilterMoviesPage(){ fetchMoviesPage(1, false); }
  function perfDebounceMoviesPage(){
    clearTimeout(state.timers.movies);
    state.timers.movies = setTimeout(()=>fetchMoviesPage(1, false), SEARCH_DELAY);
  }
  function perfMoviesLoadMore(){
    if(state.movies.page < state.movies.pages)fetchMoviesPage(state.movies.page + 1, true);
  }
  function perfFilterSeriesPage(){ fetchSeriesPage(1, false); }
  function perfDebounceSeriesPage(){
    clearTimeout(state.timers.series);
    state.timers.series = setTimeout(()=>fetchSeriesPage(1, false), SEARCH_DELAY);
  }
  function perfSeriesLoadMore(){
    if(state.series.page < state.series.pages)fetchSeriesPage(state.series.page + 1, true);
  }

  window.loadAllMoviesForBrowse = loadAllMoviesForBrowse = perfLoadAllMoviesForBrowse;
  window.loadAllSeriesForBrowse = loadAllSeriesForBrowse = perfLoadAllSeriesForBrowse;
  window.renderMoviesPage = renderMoviesPage = perfRenderMoviesPage;
  window.filterMoviesPage = filterMoviesPage = perfFilterMoviesPage;
  window.debounceMoviesPage = debounceMoviesPage = perfDebounceMoviesPage;
  window.moviesLoadMore = moviesLoadMore = perfMoviesLoadMore;
  window.filterSeriesPage = filterSeriesPage = perfFilterSeriesPage;
  window.debounceSeriesPage = debounceSeriesPage = perfDebounceSeriesPage;
  window.seriesLoadMore = seriesLoadMore = perfSeriesLoadMore;

  async function renderRemoteSearch(query, page, append, mobile){
    const q = String(query || '').trim();
    const grid = document.getElementById(mobile ? 'mobileSearchGrid' : 'searchGrid');
    const label = document.getElementById(mobile ? 'mobileSearchLabel' : 'searchLabel');
    if(!q){
      state.search = { page:1, pages:1, loading:false, q:'', items:[] };
      if(label)label.textContent = mobile ? '' : 'Start typing to search your vault';
      if(grid)grid.innerHTML = mobile ? '' : '<div class="empty"><h2>Search your library</h2><p>Movies and shows will appear here.</p></div>';
      return;
    }
    if(state.search.loading)return;
    state.search.loading = true;
    if(!append && grid)grid.innerHTML = '<div class="downloads-empty">Searching...</div>';
    try{
      const data = await fetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=48`).then(safeJson);
      const items = arrayFromResponse(data, 'items').filter(Boolean);
      const total = totalFromResponse(data, items);
      state.search = {
        page:pageFromResponse(data, page),
        pages:pagesFromResponse(data, total, 48),
        loading:false,
        q,
        items: append ? state.search.items.concat(items) : items
      };
      if(label)label.textContent = total ? `${total.toLocaleString()} result${total === 1 ? '' : 's'} for "${q}"` : `No results for "${q}"`;
      if(!items.length && !append){
        grid.innerHTML = '<div class="empty"><h2>Nothing found</h2><p>Try a different title, genre, or language.</p></div>';
      }else{
        renderGridBatch(grid, items, item => (item.type === 'tv' || item.type === 'series' || item.isSummary) ? sCardHTML(item) : cardHTML(item), append);
      }
    }catch(e){
      console.warn('[Search] paged search failed:', e);
      state.search.loading = false;
      if(grid)grid.innerHTML = '<div class="empty"><h2>Search unavailable</h2></div>';
    }
  }

  window.renderSearchPage = function(q=''){
    const input = document.getElementById('searchPageInput');
    if(input && input.value !== q && document.activeElement !== input)input.value = q;
    renderRemoteSearch(q, 1, false, false);
  };

  window.handleSearch = function(q){
    clearTimeout(state.timers.search);
    state.timers.search = setTimeout(()=>{
      const mobile = document.getElementById('searchOverlay')?.classList.contains('open');
      const query = String(q || '');
      if(mobile){
        renderRemoteSearch(query, 1, false, true);
        return;
      }
      if(query.trim()){
        try{if(location.hash==='#downloads')history.replaceState(null,'',location.pathname+location.search);}catch{}
        currentTab = 'search';
        ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','downloadsSection','liveSection','mobileMp4Section'].forEach(id=>{
          const el=document.getElementById(id);
          if(el)el.style.display='none';
        });
        const section = document.getElementById('sectionSection');
        if(section)section.classList.remove('open');
        document.getElementById('searchSection').style.display='block';
        ['bnDiscover','bnShows','bnMovies','bnLibrary','bnDownloads','bnSearch'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
        document.getElementById('bnSearch')?.classList.add('active');
        document.getElementById('downloadNavBtn')?.classList.remove('active');
        renderRemoteSearch(query, 1, false, false);
      }else if(currentTab === 'search'){
        renderRemoteSearch('', 1, false, false);
      }
    }, SEARCH_DELAY);
  };

  document.addEventListener('scroll', ()=>{
    if(currentTab !== 'search')return;
    if(state.search.loading || state.search.page >= state.search.pages)return;
    if(window.innerHeight + window.scrollY > document.body.offsetHeight - 900){
      renderRemoteSearch(state.search.q, state.search.page + 1, true, false);
    }
  }, { passive:true });
})();
