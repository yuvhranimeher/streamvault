window.API_BASE = "https://streamvault.fit";
(function(){
  const state = {
    loaded: false,
    loading: false,
    items: [],
    filtered: [],
    rendered: 0,
    pageSize: 72,
    filter: 'All',
    query: '',
    timer: 0
  };

  const filters = ['All', 'Windows', 'Android', 'Games', 'Console', 'OS', 'Archives'];

  function dEsc(value){
    if (typeof esc === 'function') return esc(value);
    return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function safeIconUrl(url){
    const value = String(url || '').trim();
    return /^(\/|https?:\/\/|data:image\/)/i.test(value) ? value : '';
  }

  function itemText(item){
    return [
      item.name,
      item.filename,
      item.category,
      item.platform,
      item.type,
      item.extension
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function itemMatchesFilter(item){
    const filter = state.filter;
    const platform = String(item.platform || '').toLowerCase();
    const category = String(item.category || '').toLowerCase();
    const type = String(item.type || '').toLowerCase();
    const ext = String(item.extension || '').toLowerCase();

    if (filter === 'All') return true;
    if (filter === 'Windows') return platform.includes('windows') || ext === 'exe' || ext === 'msi';
    if (filter === 'Android') return platform.includes('android') || ['apk','xapk','apks'].includes(ext);
    if (filter === 'Games') return (type === 'game' || category.includes('game')) && !platform.includes('console');
    if (filter === 'Console') return platform.includes('console') || category.includes('console');
    if (filter === 'OS') return platform.includes('os') || category === 'os' || ['iso','img'].includes(ext);
    if (filter === 'Archives') return platform.includes('archive') || category.includes('archive') || ['zip','rar','7z'].includes(ext);
    return true;
  }

  function filteredItems(){
    const terms = String(state.query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return state.items.filter(item => {
      if (!itemMatchesFilter(item)) return false;
      if (!terms.length) return true;
      const text = itemText(item);
      return terms.every(term => text.includes(term));
    });
  }

  function sizeLabel(size){
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return '';
    const units = ['B','KB','MB','GB','TB'];
    let value = n;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    return `${value >= 10 || idx === 0 ? Math.round(value) : value.toFixed(1)} ${units[idx]}`;
  }

  function iconKind(item){
    const ext = String(item.extension || '').toLowerCase();
    const platform = String(item.platform || '').toLowerCase();
    const category = String(item.category || '').toLowerCase();
    if (['apk','xapk','apks'].includes(ext) || platform.includes('android')) return 'android';
    if (['exe','msi'].includes(ext) || platform.includes('windows')) return 'windows';
    if (['iso','img'].includes(ext) || platform.includes('disk') || platform.includes('os')) return 'disk';
    if (platform.includes('console') || category.includes('game') || ['nsp','xci','cia','3ds','gba','nds','nes','snes','wbfs'].includes(ext)) return 'game';
    if (['zip','rar','7z'].includes(ext) || platform.includes('archive')) return 'archive';
    if (['dmg','pkg'].includes(ext) || platform.includes('mac')) return 'mac';
    return 'file';
  }

  function iconSvg(kind){
    if (kind === 'android') return '<svg viewBox="0 0 24 24"><path d="M7 9h10v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9zm1.2-3.7L6.7 3.8 7.8 2.7 9.6 4.5a7.1 7.1 0 0 1 4.8 0l1.8-1.8 1.1 1.1-1.5 1.5A5.8 5.8 0 0 1 18 8H6a5.8 5.8 0 0 1 2.2-2.7zM9 12.5h1.6V14H9v-1.5zm4.4 0H15V14h-1.6v-1.5z"/></svg>';
    if (kind === 'windows') return '<svg viewBox="0 0 24 24"><path d="M3 5.2 10.8 4v7H3V5.2zm9.2-1.4L21 2.5V11h-8.8V3.8zM3 12.6h7.8v7.1L3 18.5v-5.9zm9.2 0H21v8.9l-8.8-1.4v-7.5z"/></svg>';
    if (kind === 'disk') return '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zm0 2.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/></svg>';
    if (kind === 'game') return '<svg viewBox="0 0 24 24"><path d="M7 8h10a5 5 0 0 1 4.7 3.3l.8 2.3a3.3 3.3 0 0 1-5.5 3.4L15.3 15H8.7L7 17a3.3 3.3 0 0 1-5.5-3.4l.8-2.3A5 5 0 0 1 7 8zm1 2.5H6.5V12H5v1.5h1.5V15H8v-1.5h1.5V12H8v-1.5zm8.7.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm2.2 2.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>';
    if (kind === 'archive') return '<svg viewBox="0 0 24 24"><path d="M5 3h6l2 2h6v16H5V3zm7 4h-2v2h2V7zm0 3h-2v2h2v-2zm0 3h-2v2h2v-2zm-2 3v2h4v-2h-4z"/></svg>';
    if (kind === 'mac') return '<svg viewBox="0 0 24 24"><path d="M16.5 2.5c.1 1.4-.4 2.6-1.3 3.5-.8.8-1.9 1.4-3.1 1.3-.1-1.3.5-2.5 1.3-3.3.9-.9 2.1-1.5 3.1-1.5zM20 16.8c-.5 1.1-.8 1.6-1.5 2.5-1 1.4-2.5 3.1-4.3 3.1-1.6 0-2-.9-4.2-.9s-2.7.9-4.2.9c-1.8 0-3.2-1.6-4.3-3-3-4.2-3.3-9.1-1.5-11.8 1.3-1.9 3.3-3 5.2-3 2 0 3.2 1 4.8 1s2.6-1 4.9-1c1.7 0 3.6.9 4.9 2.6-4.3 2.4-3.6 8.5.2 9.6z"/></svg>';
    return '<svg viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6V2zm7 1.8V7h3.2L13 3.8zM8 11h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>';
  }

  function iconHtml(item){
    const custom = safeIconUrl(item.icon);
    if (custom) {
      return `<div class="download-icon download-icon-custom"><img src="${dEsc(custom)}" alt="" loading="lazy"></div>`;
    }
    const kind = iconKind(item);
    return `<div class="download-icon download-icon-${kind}" aria-hidden="true">${iconSvg(kind)}</div>`;
  }

  function cardHtml(item){
    const id = encodeURIComponent(String(item.id || ''));
    const ext = String(item.extension || '').toUpperCase();
    const size = sizeLabel(item.size);
    const meta = [item.platform, ext].filter(Boolean).join(' - ');
    return `<article class="download-card">
      ${iconHtml(item)}
      <div class="download-card-body">
        <div class="download-name" title="${dEsc(item.name || item.filename || '')}">${dEsc(item.name || item.filename || 'Untitled')}</div>
        <div class="download-meta">${dEsc(meta || item.category || 'Download')}</div>
        ${size ? `<div class="download-size">${dEsc(size)}</div>` : ''}
      </div>
      <a class="download-action" href="/download/${id}" target="_blank" rel="noopener">Download</a>
    </article>`;
  }

  function setFilterButtons(){
    const wrap = document.getElementById('downloadsFilters');
    if (!wrap) return;
    wrap.querySelectorAll('.download-filter').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === state.filter);
    });
  }

  function appendDownloads(){
    const grid = document.getElementById('downloadsGrid');
    if (!grid) return;
    const from = state.rendered;
    const to = Math.min(state.filtered.length, from + state.pageSize);
    if (from === 0) grid.innerHTML = '';
    grid.insertAdjacentHTML('beforeend', state.filtered.slice(from, to).map(cardHtml).join(''));
    state.rendered = to;
  }

  function renderDownloads(){
    const grid = document.getElementById('downloadsGrid');
    const count = document.getElementById('downloadsCount');
    if (!grid) return;

    setFilterButtons();

    if (state.loading) {
      grid.innerHTML = '<div class="downloads-empty">Loading downloads...</div>';
      if (count) count.textContent = '';
      return;
    }

    state.filtered = filteredItems();
    state.rendered = 0;
    if (count) {
      count.textContent = `${state.filtered.length} item${state.filtered.length === 1 ? '' : 's'}`;
    }

    if (!state.filtered.length) {
      grid.innerHTML = '<div class="downloads-empty">No downloads found.</div>';
      return;
    }

    appendDownloads();
  }

  async function loadDownloads(){
    if (state.loaded || state.loading) return;
    state.loading = true;
    renderDownloads();
    try {
      const res = await fetch(API_BASE + '/api/downloads');
      const data = await res.json();
      const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
      state.items = items.filter(item => item && item.id);
      state.loaded = true;
    } catch {
      state.items = [];
      const grid = document.getElementById('downloadsGrid');
      if (grid) grid.innerHTML = '<div class="downloads-empty">Could not load downloads.</div>';
    } finally {
      state.loading = false;
      renderDownloads();
    }
  }

  function setHashForDownloads(active){
    try {
      if (active && location.hash !== '#downloads') history.pushState(null, '', '#downloads');
      if (!active && location.hash === '#downloads') history.replaceState(null, '', location.pathname + location.search);
    } catch {}
  }

  function showDownloadsPage(){
    if (typeof closeSearchOverlay === 'function') closeSearchOverlay(true);
    const sectionPage = document.getElementById('sectionSection');
    if (sectionPage) sectionPage.classList.remove('open');

    ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','liveSection','mobileMp4Section','searchSection'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const downloads = document.getElementById('downloadsSection');
    if (downloads) downloads.style.display = 'block';

    try { currentTab = 'downloads'; } catch {}
    ['bnDiscover','bnShows','bnMovies','bnLibrary','bnDownloads','bnSearch'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
    document.getElementById('bnDownloads')?.classList.add('active');
    document.getElementById('livetvNavBtn')?.classList.remove('active');
    document.getElementById('allMoviesNavBtn')?.classList.remove('active');
    document.getElementById('downloadNavBtn')?.classList.add('active');
    setHashForDownloads(true);
    if (state.loaded) renderDownloads();
    else loadDownloads();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.setDownloadFilter = function(filter){
    state.filter = filters.includes(filter) ? filter : 'All';
    renderDownloads();
  };

  window.handleDownloadSearch = function(value){
    state.query = String(value || '');
    clearTimeout(state.timer);
    state.timer = setTimeout(renderDownloads, 140);
  };

  window.renderDownloadsPage = renderDownloads;

  if (typeof switchTab === 'function' && !window._svDownloadsSwitchWrapped) {
    window._svDownloadsSwitchWrapped = true;
    const originalSwitchTab = switchTab;
    switchTab = function(tab){
      if (tab === 'downloads') return showDownloadsPage();
      const downloads = document.getElementById('downloadsSection');
      if (downloads) downloads.style.display = 'none';
      document.getElementById('downloadNavBtn')?.classList.remove('active');
      setHashForDownloads(false);
      return originalSwitchTab.apply(this, arguments);
    };
  }

  document.addEventListener('scroll', () => {
    try { if (currentTab !== 'downloads') return; } catch { return; }
    if (!state.filtered.length || state.rendered >= state.filtered.length) return;
    if (window.innerHeight + window.scrollY > document.body.offsetHeight - 700) appendDownloads();
  }, { passive: true });

  function hasDownloadsHash(){
    return String(location.hash || '').replace(/^#/, '').toLowerCase() === 'downloads';
  }

  window.addEventListener('hashchange', () => {
    if (hasDownloadsHash()) switchTab('downloads');
    else {
      try {
        if (currentTab === 'downloads' && typeof goHome === 'function') goHome();
      } catch {}
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (hasDownloadsHash()) setTimeout(() => switchTab('downloads'), 0);
  }, { once: true });
})();



