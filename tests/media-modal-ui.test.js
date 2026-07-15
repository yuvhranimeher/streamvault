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
  assert(source.includes('svRestoreDetailState(svPlayerReturnState)'), `${relative} must restore the launching detail modal after player close`);
  assert(!source.includes('closeMovieDetail();\n  if(movie.streamUrl)'), `${relative} must not close the movie detail modal before playback`);
  assert(!source.includes('closeMediaModal();\n    playSeriesEpisode'), `${relative} must not close the desktop series modal before playback`);
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
  assert(css.includes('.modal-wishlist-btn.active{background:var(--accent);color:var(--accent-contrast)}'), `${relative} must show active modal wishlist state`);
  assert(css.includes('.sm-watchlist.active{background:var(--accent);color:var(--accent-contrast)}'), `${relative} must show active series wishlist state`);
}

console.log('Media modal UI regression tests passed');
