(function(){
  window.API_BASE = window.STREAMVAULT_CONFIG?.backendOrigin || window.API_BASE || '';

  const FALLBACK_POSTER = '/fallback.webp';

  function fixUrl(u){
    if(!u) return u;
    try{
      const parsed = new URL(u, location.href);
      if(parsed.pathname === '/poster-cache' || parsed.pathname === '/image-proxy'){
        const source = parsed.searchParams.get('url');
        if(source && /^https:\/\/image\.tmdb\.org\/t\/p\//i.test(source))return source;
        return FALLBACK_POSTER;
      }
    }catch(_error){
      return FALLBACK_POSTER;
    }
    return u;
  }

  function fixImgs(root){
    const scope = root || document;
    const images = [];
    if(scope.matches?.('img'))images.push(scope);
    scope.querySelectorAll?.('img').forEach(img=>images.push(img));
    images.forEach(img=>{
      ["src","data-src","data-sv-src"].forEach(a=>{
        const v=img.getAttribute(a);
        if(v) img.setAttribute(a, fixUrl(v));
      });

      const sv=img.getAttribute("data-sv-src");
      if(sv && (!img.getAttribute("src") || img.getAttribute("src").startsWith("data:"))){
        img.setAttribute("src", fixUrl(sv));
      }

      if(!img.getAttribute('decoding'))img.decoding='async';
    });
  }

  if(document.readyState === 'loading')document.addEventListener('DOMContentLoaded', ()=>fixImgs(document), { once:true });
  else fixImgs(document);

  new MutationObserver(ms=>{
    ms.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.nodeType===1) fixImgs(n);
    }));
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
