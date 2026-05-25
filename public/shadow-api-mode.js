(function(){
  var KEY = 'sv_shadow_api_enabled';
  var SHADOW = 'http://127.0.0.1:3031';

  function params(){
    try { return new URLSearchParams(window.location.search || ''); }
    catch(e){ return new URLSearchParams(''); }
  }

  var q = params();
  if (q.has('shadowApi')) {
    if (q.get('shadowApi') === '1') {
      try { localStorage.setItem(KEY, '1'); } catch(e) {}
    } else if (q.get('shadowApi') === '0') {
      try { localStorage.removeItem(KEY); } catch(e) {}
    }
  }

  var enabled = false;
  try { enabled = localStorage.getItem(KEY) === '1'; } catch(e) {}
  if (!enabled) return;

  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!nativeFetch) return;

  window.__SV_SHADOW_API__ = true;
  console.warn('[StreamVault] Shadow API mode ON:', SHADOW);

  window.fetch = function(input, init){
    try {
      var raw = (input && input.url) ? input.url : String(input || '');
      var u = new URL(raw, window.location.origin);
      if (u.origin === window.location.origin && u.pathname.indexOf('/api/') === 0) {
        var shadowUrl = SHADOW + u.pathname + u.search;
        return nativeFetch(shadowUrl, init);
      }
    } catch(e) {}
    return nativeFetch(input, init);
  };
})();
