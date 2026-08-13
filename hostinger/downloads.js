window.API_BASE = window.STREAMVAULT_CONFIG?.backendOrigin || window.API_BASE || '';
(function(){
  const CATALOG_ROOT = '/non-video';
  const CATALOG_VERSION = '20260813-nonvideo-v1';
  const RENDER_BATCH = 72;

  const state = {
    mode: 'catalog',
    manifest: null,
    category: null,
    categoryMeta: null,
    items: [],
    loadedPages: new Set(),
    loadingPages: new Set(),
    allPagesLoaded: false,
    filtered: [],
    rendered: 0,
    query: '',
    timer: 0,
    loading: false,
    searching: false,
    error: '',
    legacyItems: []
  };

  const labels = {
    books_documents: 'Books & Documents',
    comics: 'Comics',
    software_games: 'Software & Games',
    archives: 'Archives',
    subtitles: 'Subtitles',
    audio: 'Audio',
    images: 'Images',
    metadata: 'Metadata',
    other: 'Other'
  };

  function dEsc(value){
    if (typeof esc === 'function') return esc(value);
    return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function safeHttpUrl(value){
    const url = String(value || '').trim();
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function itemText(item){
    return [item.name,item.filename,item.category,item.extension,item.host,item.platform,item.type]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function categoryLabel(meta){
    return labels[meta?.category] || String(meta?.category || meta?.slug || 'Files').replace(/[_-]+/g,' ');
  }

  function categoryByValue(value){
    const needle = String(value || '').toLowerCase();
    return state.manifest?.categories?.find(meta =>
      String(meta.slug || '').toLowerCase() === needle ||
      String(meta.category || '').toLowerCase() === needle ||
      categoryLabel(meta).toLowerCase() === needle
    ) || null;
  }

  function catalogUrl(path){
    const separator = String(path).includes('?') ? '&' : '?';
    return `${path}${separator}v=${encodeURIComponent(CATALOG_VERSION)}`;
  }

  async function fetchJson(path){
    const response = await fetch(catalogUrl(path), {
      cache: 'no-cache',
      headers: { Accept: 'application/json' }
    });
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function setUiCopy(){
    const nav = document.getElementById('downloadNavBtn')?.querySelector('span');
    if(nav)nav.textContent = 'Files & Downloads';
    const title = document.querySelector('#downloadsSection .downloads-title');
    if(title)title.textContent = 'Files & Downloads';
    const subtitle = document.querySelector('#downloadsSection .downloads-subtitle');
    if(subtitle)subtitle.textContent = 'Books, comics, software, archives, subtitles and more';
    const input = document.getElementById('downloadsSearchInput');
    if(input)input.placeholder = 'Search the selected file category';
    const warning = document.querySelector('#downloadsSection .downloads-warning');
    if(warning)warning.textContent = 'Files are indexed from external CircleFTP sources. Only open or download files you trust.';
  }

  function iconKind(item){
    const category = String(item.category || '').toLowerCase();
    const ext = String(item.extension || '').toLowerCase();
    if(category === 'books_documents')return 'book';
    if(category === 'comics')return 'comic';
    if(category === 'subtitles')return 'subtitle';
    if(category === 'audio')return 'audio';
    if(category === 'images')return 'image';
    if(category === 'archives')return 'archive';
    if(category === 'software_games')return ['iso','.iso','nsp','.nsp','xci','.xci','3ds','.3ds'].includes(ext) ? 'game' : 'software';
    return 'file';
  }

  function iconSvg(kind){
    if(kind === 'book')return '<svg viewBox="0 0 24 24"><path d="M4 3h6.5c1 0 1.5.4 1.5 1.2V21c-.6-.7-1.4-1-2.5-1H4V3zm16 0h-6.5c-1 0-1.5.4-1.5 1.2V21c.6-.7 1.4-1 2.5-1H20V3z"/></svg>';
    if(kind === 'comic')return '<svg viewBox="0 0 24 24"><path d="M4 3h16v18H4V3zm2 2v6h5V5H6zm7 0v3h5V5h-5zm0 5v9h5v-9h-5zM6 13v6h5v-6H6z"/></svg>';
    if(kind === 'subtitle')return '<svg viewBox="0 0 24 24"><path d="M3 5h18v14H3V5zm3 8v2h5v-2H6zm7 0v2h5v-2h-5zm-7 3v1h8v-1H6z"/></svg>';
    if(kind === 'audio')return '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13a4 4 0 1 1-2-3.5V6L11 7.3V18a4 4 0 1 1-2-3.5z"/></svg>';
    if(kind === 'image')return '<svg viewBox="0 0 24 24"><path d="M3 4h18v16H3V4zm3 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 10h14l-4.5-5-3.2 3.5-2-2L5 17z"/></svg>';
    if(kind === 'archive')return '<svg viewBox="0 0 24 24"><path d="M5 3h6l2 2h6v16H5V3zm7 4h-2v2h2V7zm0 3h-2v2h2v-2zm0 3h-2v2h2v-2zm-2 3v2h4v-2h-4z"/></svg>';
    if(kind === 'game')return '<svg viewBox="0 0 24 24"><path d="M7 8h10a5 5 0 0 1 4.7 3.3l.8 2.3a3.3 3.3 0 0 1-5.5 3.4L15.3 15H8.7L7 17a3.3 3.3 0 0 1-5.5-3.4l.8-2.3A5 5 0 0 1 7 8zm1 2.5H6.5V12H5v1.5h1.5V15H8v-1.5h1.5V12H8v-1.5z"/></svg>';
    if(kind === 'software')return '<svg viewBox="0 0 24 24"><path d="M4 4h16v12H4V4zm3 3v2h10V7H7zm0 4v2h6v-2H7zm2 7h6v2H9v-2z"/></svg>';
    return '<svg viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6V2zm7 1.8V7h3.2L13 3.8zM8 11h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>';
  }

  function iconHtml(item){
    const kind = iconKind(item);
    return `<div class="download-icon download-icon-${dEsc(kind)}" aria-hidden="true">${iconSvg(kind)}</div>`;
  }

  function cardHtml(item){
    const directUrl = safeHttpUrl(item.url);
    const legacyId = item.id != null ? encodeURIComponent(String(item.id)) : '';
    const legacyUrl = legacyId ? (window.StreamVaultConfig?.backendUrl(`/download/${legacyId}`) || `/download/${legacyId}`) : '';
    const href = directUrl || legacyUrl || '#';
    const ext = String(item.extension || '').replace(/^\./,'').toUpperCase();
    const category = labels[item.category] || item.category || item.platform || 'File';
    const meta = [category, ext, item.host].filter(Boolean).join(' · ');
    return `<article class="download-card">
      ${iconHtml(item)}
      <div class="download-card-body">
        <div class="download-name" title="${dEsc(item.name || item.filename || '')}">${dEsc(item.name || item.filename || 'Untitled')}</div>
        <div class="download-meta">${dEsc(meta)}</div>
      </div>
      <a class="download-action" href="${dEsc(href)}" target="_blank" rel="noopener noreferrer">Open</a>
    </article>`;
  }

  function updateCount(){
    const count = document.getElementById('downloadsCount');
    if(!count)return;
    if(state.mode === 'legacy'){
      count.textContent = `${state.filtered.length} item${state.filtered.length === 1 ? '' : 's'}`;
      return;
    }
    const total = Number(state.categoryMeta?.total || state.items.length);
    if(state.searching){count.textContent = 'Searching category…';return;}
    if(state.query && state.allPagesLoaded){
      count.textContent = `${state.filtered.length} match${state.filtered.length === 1 ? '' : 'es'} in ${categoryLabel(state.categoryMeta)}`;
      return;
    }
    count.textContent = `${total.toLocaleString()} files · ${state.items.length.toLocaleString()} loaded`;
  }

  function renderFilterButtons(){
    const wrap = document.getElementById('downloadsFilters');
    if(!wrap)return;
    if(state.mode === 'legacy')return;
    wrap.innerHTML = '';
    (state.manifest?.categories || []).forEach(meta => {
      const button = document.createElement('button');
      button.className = 'download-filter' + (meta.slug === state.category ? ' active' : '');
      button.type = 'button';
      button.textContent = `${categoryLabel(meta)} (${Number(meta.total || 0).toLocaleString()})`;
      button.addEventListener('click', () => switchCategory(meta.slug));
      wrap.appendChild(button);
    });
  }

  function filterCurrentItems(){
    const terms = String(state.query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    state.filtered = !terms.length ? state.items.slice() : state.items.filter(item => {
      const text = itemText(item);
      return terms.every(term => text.includes(term));
    });
  }

  function appendDownloads(){
    const grid = document.getElementById('downloadsGrid');
    if(!grid)return;
    const from = state.rendered;
    const to = Math.min(state.filtered.length, from + RENDER_BATCH);
    if(from === 0)grid.innerHTML = '';
    if(to > from)grid.insertAdjacentHTML('beforeend', state.filtered.slice(from,to).map(cardHtml).join(''));
    state.rendered = to;
  }

  function renderDownloads(){
    const grid = document.getElementById('downloadsGrid');
    if(!grid)return;
    renderFilterButtons();
    if(state.loading && !state.items.length){
      grid.innerHTML = '<div class="downloads-empty">Loading file catalog…</div>';
      updateCount();
      return;
    }
    if(state.error){
      grid.innerHTML = `<div class="downloads-empty">${dEsc(state.error)}</div>`;
      updateCount();
      return;
    }
    filterCurrentItems();
    state.rendered = 0;
    updateCount();
    if(!state.filtered.length){
      grid.innerHTML = `<div class="downloads-empty">${state.searching ? 'Searching…' : 'No files found.'}</div>`;
      return;
    }
    appendDownloads();
  }

  function pagePath(meta, page){
    return `${CATALOG_ROOT}/${meta.slug}/page-${String(page).padStart(3,'0')}.json`;
  }

  async function loadCatalogPage(page, render=true){
    const meta = state.categoryMeta;
    if(!meta || state.loadedPages.has(page) || state.loadingPages.has(page))return;
    if(page < 1 || page > Number(meta.pages || 0))return;
    state.loadingPages.add(page);
    try{
      const payload = await fetchJson(pagePath(meta,page));
      if(meta.slug !== state.category)return;
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      state.items.push(...rows);
      state.loadedPages.add(page);
      state.allPagesLoaded = state.loadedPages.size >= Number(meta.pages || 0);
    }finally{
      state.loadingPages.delete(page);
    }
    if(render)renderDownloads();
  }

  async function loadNextCatalogPage(){
    if(state.mode !== 'catalog' || state.allPagesLoaded || state.searching)return;
    const pages = Number(state.categoryMeta?.pages || 0);
    for(let page=1; page<=pages; page++){
      if(!state.loadedPages.has(page) && !state.loadingPages.has(page)){
        await loadCatalogPage(page,true);
        return;
      }
    }
  }

  async function loadAllCategoryPages(){
    if(state.mode !== 'catalog' || state.allPagesLoaded || !state.categoryMeta)return;
    state.searching = true;
    renderDownloads();
    const pages = Number(state.categoryMeta.pages || 0);
    try{
      for(let page=1; page<=pages; page++){
        if(!state.loadedPages.has(page))await loadCatalogPage(page,false);
      }
    }catch(error){
      state.error = `Could not search the full category: ${error?.message || error}`;
    }finally{
      state.searching = false;
      renderDownloads();
    }
  }

  async function switchCategory(value){
    const meta = categoryByValue(value);
    if(!meta)return;
    state.category = meta.slug;
    state.categoryMeta = meta;
    state.items = [];
    state.filtered = [];
    state.rendered = 0;
    state.loadedPages = new Set();
    state.loadingPages = new Set();
    state.allPagesLoaded = false;
    state.error = '';
    state.loading = true;
    const input = document.getElementById('downloadsSearchInput');
    state.query = input?.value || '';
    renderDownloads();
    try{
      await loadCatalogPage(1,false);
      if(state.query.trim())await loadAllCategoryPages();
    }catch(error){
      state.error = `Could not load ${categoryLabel(meta)}: ${error?.message || error}`;
    }finally{
      state.loading = false;
      renderDownloads();
    }
  }

  async function loadLegacyDownloads(){
    state.mode = 'legacy';
    try{
      const res = await fetchWithTimeout(API_BASE + '/api/downloads', {}, 3500);
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.items = (Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : [])).filter(Boolean);
      state.error = '';
    }catch{
      state.items = [];
      state.error = 'The static file catalog is not deployed yet, and the backend download catalog is unavailable.';
    }
  }

  async function loadDownloads(){
    if(state.loading || state.manifest)return;
    state.loading = true;
    state.error = '';
    setUiCopy();
    renderDownloads();
    try{
      const manifest = await fetchJson(`${CATALOG_ROOT}/manifest.json`);
      if(!manifest || !Array.isArray(manifest.categories) || !manifest.categories.length)throw new Error('invalid manifest');
      state.manifest = manifest;
      state.mode = 'catalog';
      state.loading = false;
      const preferred = manifest.categories.find(meta => meta.category === 'software_games') || manifest.categories[0];
      await switchCategory(preferred.slug);
      return;
    }catch(error){
      state.manifest = null;
      await loadLegacyDownloads();
    }finally{
      state.loading = false;
      renderDownloads();
    }
  }

  function setHashForDownloads(active){
    try{
      if(active && location.hash !== '#downloads')history.pushState(null,'','#downloads');
      if(!active && location.hash === '#downloads')history.replaceState(null,'',location.pathname + location.search);
    }catch{}
  }

  function showDownloadsPage(){
    setUiCopy();
    if(typeof closeSearchOverlay === 'function')closeSearchOverlay(true);
    const sectionPage = document.getElementById('sectionSection');
    if(sectionPage)sectionPage.classList.remove('open');
    ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','liveSection','mobileMp4Section','searchSection'].forEach(id => {
      const el = document.getElementById(id);
      if(el)el.style.display = 'none';
    });
    const downloads = document.getElementById('downloadsSection');
    if(downloads)downloads.style.display = 'block';
    try{currentTab = 'downloads';}catch{}
    ['bnDiscover','bnShows','bnMovies','bnLibrary','bnDownloads','bnSearch'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    document.getElementById('bnDownloads')?.classList.add('active');
    document.getElementById('livetvNavBtn')?.classList.remove('active');
    document.getElementById('allMoviesNavBtn')?.classList.remove('active');
    document.getElementById('downloadNavBtn')?.classList.add('active');
    setHashForDownloads(true);
    if(state.manifest || state.items.length || state.error)renderDownloads();
    else loadDownloads();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  window.setDownloadFilter = function(filter){
    if(state.mode === 'catalog')switchCategory(filter);
  };

  window.handleDownloadSearch = function(value){
    state.query = String(value || '');
    clearTimeout(state.timer);
    state.timer = setTimeout(async () => {
      if(state.mode === 'catalog' && state.query.trim() && !state.allPagesLoaded)await loadAllCategoryPages();
      else renderDownloads();
    },180);
  };

  window.loadDownloads = loadDownloads;
  window.renderDownloadsPage = renderDownloads;

  if(typeof switchTab === 'function' && !window._svDownloadsSwitchWrapped){
    window._svDownloadsSwitchWrapped = true;
    const originalSwitchTab = switchTab;
    switchTab = function(tab){
      if(tab === 'downloads')return showDownloadsPage();
      const downloads = document.getElementById('downloadsSection');
      if(downloads)downloads.style.display = 'none';
      document.getElementById('downloadNavBtn')?.classList.remove('active');
      setHashForDownloads(false);
      return originalSwitchTab.apply(this,arguments);
    };
  }

  document.addEventListener('scroll', async () => {
    try{if(currentTab !== 'downloads')return;}catch{return;}
    if(window.innerHeight + window.scrollY <= document.body.offsetHeight - 700)return;
    if(state.rendered < state.filtered.length){appendDownloads();return;}
    if(!state.query.trim())await loadNextCatalogPage();
  },{passive:true});

  function hasDownloadsHash(){
    return String(location.hash || '').replace(/^#/,'').toLowerCase() === 'downloads';
  }

  window.addEventListener('hashchange',() => {
    if(hasDownloadsHash())switchTab('downloads');
    else{
      try{if(currentTab === 'downloads' && typeof goHome === 'function')goHome();}catch{}
    }
  });

  document.addEventListener('DOMContentLoaded',() => {
    setUiCopy();
    if(hasDownloadsHash())setTimeout(() => switchTab('downloads'),0);
  },{once:true});
})();
