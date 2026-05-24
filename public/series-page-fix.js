(function(){
  const SERIES_PAGE_SIZE = 72;
  const SEARCH_DELAY = 45;
  const state = { page:0, pages:1, total:0, loading:false, q:'', timer:0 };

  function filters(){
    return {
      q:(document.getElementById('seriesSearchInput')?.value || '').trim(),
      genre:document.getElementById('seriesGenreFilter')?.value || '',
      lang:document.getElementById('seriesLangFilter')?.value || '',
      yearRange:document.getElementById('seriesYearFilter')?.value || '',
      minRating:document.getElementById('seriesRatingFilter')?.value || '',
      sort:document.getElementById('seriesSortFilter')?.value || 'default'
    };
  }

  function setText(id, value){ const el = document.getElementById(id); if(el)el.textContent = value; }
  function totalText(total, q){ const n = Number(total) || 0; return q ? `${n.toLocaleString()} result${n === 1 ? '' : 's'}` : `${n.toLocaleString()} show${n === 1 ? '' : 's'}`; }

  function matchesExtra(item, f){
    if(f.genre){
      const genres = String(item.genre || '').split(',').map(g=>g.trim().toLowerCase());
      if(!genres.includes(f.genre.toLowerCase()))return false;
    }
    if(f.lang){
      const lang = String(item.language || '').toLowerCase();
      if(!lang.includes(f.lang.toLowerCase()))return false;
    }
    if(f.yearRange){
      const [min,max] = f.yearRange.split('-').map(Number);
      const y = parseInt(String(item.year || '').replace(/[^0-9]/g,''), 10);
      if(!y || y < min || y > max)return false;
    }
    if(f.minRating){
      const r = parseFloat(item.rating || 0);
      if(!r || r < parseFloat(f.minRating))return false;
    }
    return true;
  }

  function sortItems(items, sort){
    const list = items.slice();
    if(sort === 'rating-desc')list.sort((a,b)=>(parseFloat(b.rating||0))-(parseFloat(a.rating||0)));
    else if(sort === 'year-desc')list.sort((a,b)=>parseInt(b.year||0)-parseInt(a.year||0));
    else if(sort === 'year-asc')list.sort((a,b)=>parseInt(a.year||0)-parseInt(b.year||0));
    else if(sort === 'az')list.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    else if(sort === 'za')list.sort((a,b)=>String(b.name||'').localeCompare(String(a.name||'')));
    return list;
  }

  async function fetchJson(url){ const res = await fetch(url, { cache:'no-store' }); if(!res.ok)throw new Error(`HTTP ${res.status}`); return res.json(); }

  function endpoint(page, f){
    if(f.q)return `/api/search?q=${encodeURIComponent(f.q)}&kind=series&page=${page + 1}&limit=${SERIES_PAGE_SIZE}`;
    return `/api/series?page=${page}&limit=${SERIES_PAGE_SIZE}`;
  }

  function itemsFrom(data, q){
    if(q)return Array.isArray(data?.items) ? data.items : [];
    if(Array.isArray(data?.series))return data.series;
    if(Array.isArray(data?.shows))return data.shows;
    return Array.isArray(data) ? data : [];
  }

  function totalFrom(data, fallback){ const n = Number(data?.total ?? data?.count ?? data?.totalCount); return Number.isFinite(n) && n >= 0 ? n : fallback; }
  function pagesFrom(data, total){ const n = Number(data?.pages); if(Number.isFinite(n) && n >= 0)return n; return Math.max(1, Math.ceil((Number(total)||0)/SERIES_PAGE_SIZE)); }

  function renderBatch(grid, items, append){
    const html = items.map(item=>{ try{return sCardHTML(item);}catch(err){console.warn('[Series page] card failed:', err);return '';} }).join('');
    requestAnimationFrame(()=>{
      if(append)grid.insertAdjacentHTML('beforeend', html);
      else grid.innerHTML = html;
      if(typeof svQueuePosterImages === 'function')svQueuePosterImages(grid);
    });
  }

  async function loadPage(page, append){
    if(state.loading)return;
    state.loading = true;
    const grid = document.getElementById('seriesGrid');
    const f = filters();
    if(!grid){ state.loading = false; return; }
    if(!append && !f.q)grid.innerHTML = '<div class="downloads-empty">Loading shows...</div>';
    if(!append && f.q)grid.innerHTML = '<div class="downloads-empty">Searching...</div>';
    try{
      const data = await fetchJson(endpoint(page, f));
      let items = itemsFrom(data, f.q).filter(item=>matchesExtra(item, f));
      items = sortItems(items, f.sort);
      const total = totalFrom(data, items.length);
      state.page = page; state.pages = pagesFrom(data, total); state.total = total; state.q = f.q;
      setText('seriesCount', totalText(total, f.q));
      if(typeof renderSeriesChips === 'function')renderSeriesChips(f);
      if(!items.length && !append)grid.innerHTML = '<div class="movies-empty"><h2>No series found</h2><p>Try different filters</p></div>';
      else renderBatch(grid, items, append);
      const wrap = document.getElementById('seriesLoadMoreWrap');
      if(wrap)wrap.style.display = state.page + 1 < state.pages ? 'flex' : 'none';
    }catch(err){
      console.warn('[Series page] load failed:', err);
      grid.innerHTML = '<div class="movies-empty"><h2>Could not load shows</h2></div>';
    }finally{ state.loading = false; }
  }

  function fixedRenderSeriesPage(){ return loadPage(0, false); }
  function fixedFilterSeriesPage(){ return loadPage(0, false); }
  function fixedDebounceSeriesPage(){ clearTimeout(state.timer); state.timer = setTimeout(()=>loadPage(0, false), SEARCH_DELAY); }
  function fixedSeriesLoadMore(){ if(state.loading)return; if(state.page + 1 < state.pages)loadPage(state.page + 1, true); }

  window.renderSeriesPage = renderSeriesPage = fixedRenderSeriesPage;
  window.filterSeriesPage = filterSeriesPage = fixedFilterSeriesPage;
  window.debounceSeriesPage = debounceSeriesPage = fixedDebounceSeriesPage;
  window.seriesLoadMore = seriesLoadMore = fixedSeriesLoadMore;
})();
