(function(){
  window.API_BASE = window.API_BASE || "https://streamvault.fit";

  function fixUrl(u){
    if(!u) return u;
    if(u.startsWith("/poster-cache") || u.startsWith("/image-proxy")){
      return window.API_BASE + u;
    }
    return u;
  }

  function fixImgs(root){
    (root || document).querySelectorAll("img").forEach(img=>{
      ["src","data-src","data-sv-src"].forEach(a=>{
        const v=img.getAttribute(a);
        if(v) img.setAttribute(a, fixUrl(v));
      });

      const sv=img.getAttribute("data-sv-src");
      if(sv && (!img.getAttribute("src") || img.getAttribute("src").startsWith("data:"))){
        img.setAttribute("src", fixUrl(sv));
      }

      img.loading="eager";
      img.fetchPriority="high";
      img.decoding="async";
    });
  }

  window.addEventListener("load",()=>{
    fixImgs(document);
    setInterval(()=>fixImgs(document),1200);
  });

  new MutationObserver(ms=>{
    ms.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.nodeType===1) fixImgs(n);
    }));
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
