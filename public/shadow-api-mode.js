(function(){
  const SHADOW_ORIGIN = 'http://127.0.0.1:3031';
  const STORE_KEY = 'sv_shadow_api';

  function paramValue(){
    try { return new URLSearchParams(location.search).get('shadowApi'); }
    catch { return null; }
  }

  const p = paramValue();
  try {
    if (p === '1') localStorage.setItem(STORE_KEY, '1');
    if (p === '0') localStorage.removeItem(STORE_KEY);
  } catch {}

  const enabled = p === '1' || (() => {
    try { return localStorage.getItem(STORE_KEY) === '1'; }
    catch { return false; }
  })();

  window.SV_SHADOW_API_ENABLED = enabled;
  window.SV_SHADOW_API_ORIGIN = SHADOW_ORIGIN;

  if (!enabled) return;

  const originalFetch = window.fetch.bind(window);

  function shouldShadow(pathname){
    // Keep playback-safe mode:
    // downloads + search only.
    return (
      pathname === '/api/downloads' ||
      pathname === '/api/search'
    );
  }

  function rawUrl(input){
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  window.fetch = async function(input, init){
    const raw = rawUrl(input);
    if (!raw) return originalFetch(input, init);

    let url;
    try { url = new URL(raw, location.origin); }
    catch { return originalFetch(input, init); }

    if (url.origin !== location.origin || !shouldShadow(url.pathname)) {
      return originalFetch(input, init);
    }

    const shadowUrl = SHADOW_ORIGIN + url.pathname + url.search;

    try {
      const res = await originalFetch(shadowUrl, init);
      const text = await res.clone().text();

      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!text || !text.trim()) throw new Error('empty shadow response');
      if (text.indexOf('No matching Haskell fixture') !== -1) throw new Error('missing Haskell fixture');

      const headers = new Headers(res.headers);
      headers.set('x-sv-shadow-api', '1');
      console.log('[SV shadow API downloads+search]', url.pathname + url.search, '->', shadowUrl);

      return new Response(text, {
        status: res.status,
        statusText: res.statusText,
        headers
      });
    } catch (err) {
      console.warn('[SV shadow API fallback to Node]', url.pathname + url.search, err && err.message ? err.message : err);
      return originalFetch(input, init);
    }
  };

  window.addEventListener('DOMContentLoaded', function(){
    try {
      const badge = document.createElement('div');
      badge.textContent = 'Haskell Shadow API: downloads + search';
      badge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;background:rgba(0,0,0,.82);color:#fff;font:12px system-ui;padding:7px 10px;border-radius:999px;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.25)';
      document.body.appendChild(badge);
    } catch {}
  });
})();
