(function(){
  const MOVIES_PAGE_SIZE = 72;
  const SERIES_PAGE_SIZE = 72;
  const SEARCH_DELAY = 260;

  const movieState = { page:0, pages:1, total:0, loading:false, timer:0, controller:null, requestId:0 };
  const seriesState = { page:0, pages:1, total:0, loading:false, timer:0, controller:null, requestId:0 };

  function setText(id, value){
    const el = document.getElementById(id);
    if(el)el.textContent = value;
  }

  function safeTotalText(total, q, type){
    const n = Number(total) || 0;
    if(q)return `${n.toLocaleString()} result${n === 1 ? '' : 's'}`;
    return `${n.toLocaleString()} ${type}${n === 1 ? '' : type === 'movie' ? 's' : 's'}`;
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

  function isMovie(item){
    if(!item || !(item.name || item.title))return false;
    if(typeof isCartoonClient === 'function' && isCartoonClient(item))return false;
    return !(item.type === 'tv' || item.type === 'series' || item._isSeries || item.isSummary || item.seasons);
  }

  function isSeries(item){
    if(!item || !(item.name || item.title))return false;
    if(typeof isCartoonClient === 'function' && isCartoonClient(item))return false;
    return item.type === 'tv' || item.type === 'series' || item._isSeries || !!item.seasons;
  }

  function matchesCommonFilters(item, filters){
    if(filters.genre){
      const genres = String(item.genre || '').split(',').map(g=>g.trim().toLowerCase());
      if(!genres.includes(filters.genre.toLowerCase()))return false;
    }
    if(filters.lang){
      const lang = String(item.language || '').toLowerCase();
      if(!lang.includes(filters.lang.toLowerCase()))return false;
    }
    if(filters.yearRange){
      const [min,max] = filters.yearRange.split('-').map(Number);
      const y = parseInt(String(item.year || '').replace(/[^0-9]/g,''), 10);
      if(!y || y < min || y > max)return false;
    }
    if(filters.minRating){
      const r = parseFloat(item.rating || 0);
      if(!r || r < parseFloat(filters.minRating))return false;
    }
    return true;
  }

  function matchesMovieFilters(item, filters){
    if(!matchesCommonFilters(item, filters))return false;
    if(filters.publisher){
      const title = String(item.name || item.title || '').toLowerCase();
      const pub = filters.publisher.toLowerCase();
      const pubKeywords = {
        disney:['disney','pixar','frozen','moana','encanto','coco','lion king','toy story'],
        marvel:['marvel','avengers','iron man','captain america','thor','spider-man','spider man','black panther','doctor strange','deadpool'],
        dc:['batman','superman','wonder woman','aquaman','flash','joker','shazam','justice league','black adam'],
        universal:['jurassic','fast and furious','fast & furious','minions','despicable me','bourne','jaws'],
        dreamworks:['shrek','kung fu panda','how to train your dragon','madagascar','puss in boots'],
        netflix:['netflix','extraction','bird box','red notice','enola holmes','old guard'],
        a24:['a24','midsommar','hereditary','moonlight','uncut gems','lady bird','ex machina'],
        paramount:['mission impossible','mission: impossible','top gun','transformers','star trek','godfather','interstellar']
      };
      const kws = pubKeywords[pub] || [pub];
      if(!kws.some(k=>title.includes(k)))return false;
    }
    return true;
  }

  function sortItems(items, sort){
    if(!sort || sort === 'default')return items;
    const list = items.slice();
    if(sort === 'rating-desc')list.sort((a,b)=>(parseFloat(b.rating||0))-(parseFloat(a.rating||0)));
    else if(sort === 'year-desc')list.sort((a,b)=>parseInt(b.year||0)-parseInt(a.year||0));
    else if(sort === 'year-asc')list.sort((a,b)=>parseInt(a.year||0)-parseInt(b.year||0));
    else if(sort === 'az')list.sort((a,b)=>String(a.name||a.title||'').localeCompare(String(b.name||b.title||'')));
    else if(sort === 'za')list.sort((a,b)=>String(b.name||b.title||'').localeCompare(String(a.name||a.title||'')));
    return list;
  }

  async function fetchJson(url, state){
    if(state.controller)state.controller.abort();
    state.controller = new AbortController();
    const res = await fetch(url, { cache:'no-store', signal:state.controller.signal });
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function endpoint(path, page, limit, filters){
    const params = new URLSearchParams({ page:String(page), limit:String(limit) });
    if(filters.q){
      params.set('q', filters.q);
      params.set('massive', '1');
    }else{
      params.set('massive', '0');
    }
    return `${path}?${params.toString()}`;
  }

  function responseItems(data, key){
    if(Array.isArray(data?.[key]))return data[key];
    if(Array.isArray(data?.items))return data.items;
    if(Array.isArray(data))return data;
    return [];
  }

  function responseTotal(data, fallback){
    const n = Number(data?.total ?? data?.count ?? data?.totalCount);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function responsePages(data, total, limit){
    const n = Number(data?.pages);
    if(Number.isFinite(n) && n >= 0)return n;
    return Math.max(1, Math.ceil((Number(total) || 0) / limit));
  }

  function renderBatch(grid, items, append, renderer){
    const html = items.map(item=>{
      try{return renderer(item);}catch(err){console.warn('[Browse] card render failed:', err);return '';}
    }).join('');
    requestAnimationFrame(()=>{
      if(append)grid.insertAdjacentHTML('beforeend', html);
      else grid.innerHTML = html;
      if(typeof svQueuePosterImages === 'function')svQueuePosterImages(grid);
    });
  }

  async function loadMoviePage(page=0, append=false){
    const grid = document.getElementById('moviesGrid');
    if(!grid)return;
    const requestId = ++movieState.requestId;
    const filters = activeMovieFilters();
    movieState.loading = true;
    if(!append && !filters.q)grid.innerHTML = '<div class="downloads-empty">Loading movies...</div>';
    if(!append && filters.q)grid.innerHTML = '<div class="downloads-empty">Searching...</div>';
    try{
      const data = await fetchJson(endpoint('/api/movies', page, MOVIES_PAGE_SIZE, filters), movieState);
      if(requestId !== movieState.requestId)return;
      let items = responseItems(data, 'movies').filter(isMovie).filter(item=>matchesMovieFilters(item, filters));
      items = sortItems(items, filters.sort);
      const total = responseTotal(data, items.length);
      movieState.page = page;
      movieState.pages = responsePages(data, total, MOVIES_PAGE_SIZE);
      movieState.total = total;
      setText('moviesCount', safeTotalText(total, filters.q, 'movie'));
      if(typeof renderMoviesChips === 'function')renderMoviesChips(filters);
      if(!items.length && !append){
        grid.innerHTML = '<div class="movies-empty"><h2>No movies found</h2><p>Try a different spelling or fewer words</p></div>';
      }else{
        renderBatch(grid, items, append, cardHTML);
      }
      const wrap = document.getElementById('moviesLoadMoreWrap');
      if(wrap)wrap.style.display = movieState.page + 1 < movieState.pages ? 'flex' : 'none';
    }catch(err){
      if(err.name !== 'AbortError'){
        console.warn('[Movies page] load failed:', err);
        if(grid)grid.innerHTML = '<div class="movies-empty"><h2>Could not load movies</h2></div>';
      }
    }finally{
      if(requestId === movieState.requestId)movieState.loading = false;
    }
  }

  async function loadSeriesPage(page=0, append=false){
    const grid = document.getElementById('seriesGrid');
    if(!grid)return;
    const requestId = ++seriesState.requestId;
    const filters = activeSeriesFilters();
    seriesState.loading = true;
    if(!append)grid.innerHTML = '<div class="downloads-empty">Loading shows...</div>';
    try{
      const data = await fetchJson(endpoint('/api/series', page, SERIES_PAGE_SIZE, filters), seriesState);
      if(requestId !== seriesState.requestId)return;
      let items = responseItems(data, 'series').filter(isSeries).filter(item=>matchesCommonFilters(item, filters));
      items = sortItems(items, filters.sort);
      const total = responseTotal(data, items.length);
      seriesState.page = page;
      seriesState.pages = responsePages(data, total, SERIES_PAGE_SIZE);
      seriesState.total = total;
      setText('seriesCount', safeTotalText(total, filters.q, 'show'));
      if(typeof renderSeriesChips === 'function')renderSeriesChips(filters);
      if(!items.length && !append){
        grid.innerHTML = '<div class="movies-empty"><h2>No shows found</h2><p>Try a different spelling or fewer words</p></div>';
      }else{
        renderBatch(grid, items, append, sCardHTML);
      }
      const wrap = document.getElementById('seriesLoadMoreWrap');
      if(wrap)wrap.style.display = seriesState.page + 1 < seriesState.pages ? 'flex' : 'none';
    }catch(err){
      if(err.name !== 'AbortError'){
        console.warn('[Series page] load failed:', err);
        if(grid)grid.innerHTML = '<div class="movies-empty"><h2>Could not load shows</h2></div>';
      }
    }finally{
      if(requestId === seriesState.requestId)seriesState.loading = false;
    }
  }

  function debounceLoad(state, loader){
    clearTimeout(state.timer);
    state.timer = setTimeout(()=>loader(0, false), SEARCH_DELAY);
  }

  window.loadAllMoviesForBrowse = loadAllMoviesForBrowse = function(){};
  window.renderMoviesPage = renderMoviesPage = function(){ return loadMoviePage(0, false); };
  window.filterMoviesPage = filterMoviesPage = function(){ return loadMoviePage(0, false); };
  window.debounceMoviesPage = debounceMoviesPage = function(){ debounceLoad(movieState, loadMoviePage); };
  window.moviesLoadMore = moviesLoadMore = function(){ if(!movieState.loading && movieState.page + 1 < movieState.pages)loadMoviePage(movieState.page + 1, true); };

  window.loadAllSeriesForBrowse = loadAllSeriesForBrowse = function(){};
  window.filterSeriesPage = filterSeriesPage = function(){ return loadSeriesPage(0, false); };
  window.debounceSeriesPage = debounceSeriesPage = function(){ debounceLoad(seriesState, loadSeriesPage); };
  window.seriesLoadMore = seriesLoadMore = function(){ if(!seriesState.loading && seriesState.page + 1 < seriesState.pages)loadSeriesPage(seriesState.page + 1, true); };
})();
