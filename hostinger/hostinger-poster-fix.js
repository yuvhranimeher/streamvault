(function(){
  window.API_BASE = window.API_BASE || "https://streamvault.fit";

  function fixPosterUrl(url){
    if(!url) return url;
    if(url.startsWith("/poster-cache") || url.startsWith("/image-proxy")){
      return window.API_BASE + url;
    }
    try{
      const u = new URL(url, location.href);
      if(u.origin === location.origin && (u.pathname.startsWith("/poster-cache") || u.pathname.startsWith("/image-proxy"))){
        return window.API_BASE + u.pathname + u.search;
      }
    }catch(e){}
    return url;
  }

  function boostImages(root){
    (root || document).querySelectorAll("img").forEach(img=>{
      const ds = img.getAttribute("data-src");
      if(ds) img.setAttribute("data-src", fixPosterUrl(ds));

      const src = img.getAttribute("src");
      const fixed = fixPosterUrl(src);
      if(fixed && fixed !== src) img.setAttribute("src", fixed);

      img.loading = "eager";
      img.decoding = "async";
      img.fetchPriority = "high";

      if(img.dataset && img.dataset.src && !img.src){
        img.src = fixPosterUrl(img.dataset.src);
      }
    });

    (root || document).querySelectorAll("[data-bg],[data-poster]").forEach(el=>{
      ["data-bg","data-poster"].forEach(a=>{
        const v = el.getAttribute(a);
        if(v) el.setAttribute(a, fixPosterUrl(v));
      });
    });
  }

  function preloadPosters(){
    const urls = new Set();
    document.querySelectorAll("img").forEach(img=>{
      const u = img.currentSrc || img.src || img.dataset.src;
      if(u) urls.add(fixPosterUrl(u));
    });
    Array.from(urls).slice(0,300).forEach(u=>{
      const im = new Image();
      im.decoding = "async";
      im.loading = "eager";
      im.src = u;
    });
  }

  window.addEventListener("load", ()=>{
    boostImages(document);
    setTimeout(preloadPosters, 300);
    setTimeout(()=>boostImages(document), 1000);
    setTimeout(()=>boostImages(document), 2500);
  });

  new MutationObserver(muts=>{
    muts.forEach(m=>{
      m.addedNodes.forEach(n=>{
        if(n.nodeType === 1) boostImages(n);
      });
    });
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
