const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

for (const relative of ['public/app.js', 'hostinger/app-v3.js']) {
  const source = read(relative);

  assert(source.includes('function svApplyModalArtwork'), `${relative} is missing modal artwork upgrade helper`);
  assert(source.includes('Image();'), `${relative} must decode modal artwork with Image`);
  assert(source.includes('img.decode?.()'), `${relative} must use Image.decode when available`);
  assert(source.includes('svModalArtworkDecodeCache'), `${relative} must cache decoded modal artwork`);
  assert(source.includes('SV_MODAL_PRELOAD_LIMIT = 2'), `${relative} must bound artwork preload concurrency`);
  assert(source.includes("document.addEventListener('pointerover',preload"), `${relative} must preload on pointer intent`);
  assert(source.includes("document.addEventListener('focusin',preload"), `${relative} must preload on keyboard focus`);
  assert(source.includes("document.addEventListener('touchstart',preload"), `${relative} must preload on touch intent`);

  assert(source.includes('function svStableMediaKey'), `${relative} is missing stable media keys`);
  assert(source.includes("return `${kind}:${String(id).trim()}:${String(year).trim()}`"), `${relative} must include media type in wishlist keys`);
  assert(source.includes("localStorage.setItem('sv_movie_watchlist'"), `${relative} must keep the existing movie watchlist storage`);
  assert(source.includes("localStorage.setItem('sv_series_watchlist'"), `${relative} must keep the existing series watchlist storage`);
  assert(source.includes('aria-pressed'), `${relative} must expose wishlist pressed state`);

  assert(source.includes('function svPushDetailHistory'), `${relative} is missing detail history state`);
  assert(source.includes('function svPushPlayerHistory'), `${relative} is missing player history state`);
  assert(source.includes("window.addEventListener('popstate'"), `${relative} is missing browser Back handling`);
  assert(source.includes("source:'media-modal'"), `${relative} must mark modern modal navigation snapshots explicitly`);
  assert(source.includes('createModalNavigationSnapshot'), `${relative} must capture a deterministic modern modal snapshot`);
  assert(source.includes('selectedSeason:extra.season ?? currentSeason'), `${relative} must preserve the selected season`);
  assert(source.includes('selectedEpisode:extra.epIdx ?? svMediaModalSelectedEpisode'), `${relative} must preserve the selected episode`);
  assert(source.includes('modalScrollTop:modal?.scrollTop || 0'), `${relative} must preserve modern modal scroll position`);
  assert(source.includes('browsingView:browse'), `${relative} must preserve the browsing view below the modal`);
  assert(source.includes('filters:Object.fromEntries'), `${relative} must preserve category and filter state`);
  assert(source.includes("theme:document.documentElement.getAttribute('data-theme')"), `${relative} must preserve the active theme`);
  assert(source.includes('if(svMediaModalVisible())'), `${relative} must prefer modern modal return state over legacy launchers`);
  assert(source.includes("const returnsToModernModal=returnState?.source === 'media-modal'"), `${relative} must retain the underlying browsing DOM for modern modal playback`);
  assert(source.includes("history.state?.view === 'player'"), `${relative} must unwind player history instead of duplicating modal state`);
  assert(source.includes("history.replaceState({...history.state,returnTo:svPlayerReturnState}"), `${relative} must update an existing player entry without adding history duplicates`);
  assert(source.includes('closePlayer({fromHistory:true,restore:false,returnState})'), `${relative} must teardown playback exactly once during browser Back`);
  assert(source.includes("document.getElementById('movieDetailModal')?.classList.remove('open')"), `${relative} must suppress the obsolete movie detail renderer`);
  assert(source.includes("document.getElementById('seriesModal')?.classList.remove('open')"), `${relative} must suppress the obsolete series detail renderer`);
  assert(source.includes('svResolveMediaModalItem(state)'), `${relative} must reject stale media restoration`);
  assert(source.includes('token !== mediaModalRenderToken || currentMediaModalItem !== item'), `${relative} must prevent stale async modal data from overwriting the restored title`);
  assert(source.includes('updateMediaModalWishlistButton();'), `${relative} must resynchronize wishlist state after restoration`);
  assert(source.includes("if(!returnsToModernModal){\n    buildRows();"), `${relative} must keep the existing browsing DOM beneath modern modal playback`);
  assert(source.includes('if(!item){\n      svRestoreBrowseState(state);'), `${relative} must safely fall back for direct or stale player links`);
  assert(!source.includes('closeMovieDetail();\n  if(movie.streamUrl)'), `${relative} must not close the movie detail modal before playback`);
  assert(!source.includes('closeMediaModal();\n    playSeriesEpisode'), `${relative} must not close the desktop series modal before playback`);
  assert(!source.includes("svPlayerReturnState = svCurrentDetailState('movie');\n  else if(type === 'series')"), `${relative} must not unconditionally overwrite modern modal return state`);
}

for (const relative of ['public/index.html', 'hostinger/index.html']) {
  const html = read(relative);
  assert(html.includes('id="modalWishlistBtn"'), `${relative} is missing desktop modal wishlist control`);
  assert(html.includes('id="smWatchlistTopBtn"'), `${relative} is missing series modal wishlist control`);
  assert(html.includes('aria-label="Add to wishlist"'), `${relative} must expose add wishlist labels`);
  assert(html.includes('aria-pressed="false"'), `${relative} must expose initial wishlist pressed state`);
}

for (const relative of ['public/styles.css', 'hostinger/styles.css']) {
  const css = read(relative);
  assert(css.includes('.player-title{font-size:.95rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9)}'), `${relative} must keep player title white over video`);
  assert(css.includes('.player-subtitle-title{font-size:.72rem;color:rgba(255,255,255,.78);margin-top:2px;text-shadow:0 1px 4px rgba(0,0,0,.9)}'), `${relative} must keep player metadata visible`);
  assert(css.includes('.media-modal .details-section{position:relative;z-index:3;padding:8px 6% 64px;background:var(--bg);color:var(--text)}'), `${relative} must theme desktop modal content`);
  assert(css.includes('.media-modal-episode{display:flex;gap:14px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-glass);color:var(--text);text-align:left;cursor:pointer}'), `${relative} must theme modal episode cards`);
  assert(css.includes('.media-modal-episode.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}'), `${relative} must show the restored episode selection`);
  assert(css.includes('.modal-wishlist-btn.active{background:var(--accent);color:var(--accent-contrast)}'), `${relative} must show active modal wishlist state`);
  assert(css.includes('.sm-watchlist.active{background:var(--accent);color:var(--accent-contrast)}'), `${relative} must show active series wishlist state`);
}

console.log('Media modal UI regression tests passed');
