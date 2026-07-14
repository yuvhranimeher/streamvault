/* SV_SERIES_INSTANT_PREFETCH_V9 */
(function(){
  if(window.__svSeriesInstantPrefetchV9)return;
  window.__svSeriesInstantPrefetchV9=true;

  const nativeFetch=window.fetch.bind(window);
  const cacheByKey=new Map();
  const cacheByTitle=new Map();
  const inflightByKey=new Map();

  const queue=[];
  let active=0;
  let queuedCount=0;
  const MAX_PREFETCH=30;
  const MAX_CONCURRENT=4;

  function titleKey(value){
    return String(value||"")
      .toLowerCase()
      .replace(/\[[^\]]*]/g," ")
      .replace(/\b(tv series|web series|series|2160p|1080p|720p|480p|4k|dual audio|multi audio)\b/g," ")
      .replace(/\b(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?\b/g," ")
      .replace(/[^a-z0-9]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function yearOf(value){
    return String(value||"").match(/\b(?:19|20)\d{2}\b/)?.[0]||"";
  }

  function episodeCount(show){
    return Object.values(show?.seasons||{}).reduce((total,value)=>{
      if(Array.isArray(value))return total+value.length;
      if(Array.isArray(value?.episodes))return total+value.episodes.length;
      return total;
    },0);
  }

  function cacheTitle(show,summary){
    const names=[
      show?.name,
      show?.title,
      summary?.name,
      summary?.title
    ];

    names.forEach(name=>{
      const key=titleKey(name);
      if(key)cacheByTitle.set(key,show);
    });
  }

  function storeShow(detailKey,show,summary){
    if(!show||episodeCount(show)<1)return;

    if(detailKey){
      cacheByKey.set(detailKey,show);
      _seriesDetailRegistry.set(detailKey,show);
    }

    cacheTitle(show,summary);

    if(Array.isArray(series)){
      const id=String(show.id||"");
      const name=titleKey(show.name||show.title);

      const index=series.findIndex(item=>
        (id&&String(item?.id||"")===id) ||
        titleKey(item?.name||item?.title)===name
      );

      if(index>=0)series[index]=show;
      else series.push(show);
    }
  }

  function detailKeyFromCard(card){
    const code=card?.getAttribute("onclick")||"";
    const match=code.match(
      /openSeriesDetail\(\s*(['"])(.*?)\1\s*\)/
    );

    return match?.[2]||"";
  }

  function cachedForRequest(url){
    const id=url.searchParams.get("id")||"";
    const name=url.searchParams.get("name")||"";
    const normalized=titleKey(name);

    if(id){
      for(const show of cacheByKey.values()){
        if(String(show?.id||"")===id)return show;
      }
    }

    if(normalized&&cacheByTitle.has(normalized)){
      return cacheByTitle.get(normalized);
    }

    return null;
  }

  function responseFor(show){
    return new Response(
      JSON.stringify(show),
      {
        status:200,
        headers:{
          "Content-Type":"application/json",
          "X-SV-Series-Cache":"instant-v9"
        }
      }
    );
  }

  window.fetch=function(input,options){
    try{
      const raw=typeof input==="string" ? input : input?.url;
      const url=new URL(raw,location.origin);

      if(url.pathname==="/api/series/detail"){
        const cached=cachedForRequest(url);

        if(cached){
          return Promise.resolve(responseFor(cached));
        }

        const normalized=titleKey(url.searchParams.get("name")||"");

        for(const [key,promise] of inflightByKey.entries()){
          const summary=_seriesDetailRegistry.get(key);

          if(
            normalized &&
            titleKey(summary?.name||summary?.title)===normalized
          ){
            return promise.then(responseFor);
          }
        }
      }
    }catch(_){}

    return nativeFetch(input,options);
  };

  function prefetchKey(detailKey){
    if(!detailKey)return Promise.resolve(null);

    const cached=cacheByKey.get(detailKey);
    if(cached)return Promise.resolve(cached);

    const running=inflightByKey.get(detailKey);
    if(running)return running;

    const summary=_seriesDetailRegistry.get(detailKey);
    if(!summary)return Promise.resolve(null);

    if(episodeCount(summary)>0){
      storeShow(detailKey,summary,summary);
      return Promise.resolve(summary);
    }

    const params=new URLSearchParams();

    if(summary.id!=null){
      params.set("id",String(summary.id));
    }

    params.set(
      "name",
      String(summary.name||summary.title||"")
    );

    if(summary.year){
      params.set("year",String(summary.year));
    }

    const promise=nativeFetch(
      "/api/series/detail?"+params.toString(),
      {cache:"no-store"}
    )
      .then(response=>{
        if(!response.ok){
          throw new Error("HTTP "+response.status);
        }

        return response.json();
      })
      .then(show=>{
        show=window.StreamVaultConfig?.normalizeBackendUrls?.(show) ?? show;
        if(episodeCount(show)>0){
          storeShow(detailKey,show,summary);
          return show;
        }

        return null;
      })
      .catch(error=>{
        console.warn("[Series prefetch v9]",error?.message||error);
        return null;
      })
      .finally(()=>{
        inflightByKey.delete(detailKey);
      });

    inflightByKey.set(detailKey,promise);
    return promise;
  }

  function runQueue(){
    while(active<MAX_CONCURRENT&&queue.length){
      const key=queue.shift();
      active++;

      prefetchKey(key).finally(()=>{
        active--;
        runQueue();
      });
    }
  }

  function enqueue(detailKey){
    if(
      !detailKey ||
      cacheByKey.has(detailKey) ||
      inflightByKey.has(detailKey) ||
      queue.includes(detailKey) ||
      queuedCount>=MAX_PREFETCH
    ){
      return;
    }

    queuedCount++;
    queue.push(detailKey);
    runQueue();
  }

  function cardFromTarget(target){
    return target?.closest?.(
      '[onclick*="openSeriesDetail"]'
    )||null;
  }

  function prefetchTarget(target){
    const card=cardFromTarget(target);
    if(!card)return;

    const key=detailKeyFromCard(card);
    if(key)enqueue(key);
  }

  document.addEventListener(
    "pointerover",
    event=>prefetchTarget(event.target),
    true
  );

  document.addEventListener(
    "focusin",
    event=>prefetchTarget(event.target),
    true
  );

  document.addEventListener(
    "pointerdown",
    event=>prefetchTarget(event.target),
    true
  );

  document.addEventListener(
    "touchstart",
    event=>prefetchTarget(event.target),
    {capture:true,passive:true}
  );

  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;

      const key=detailKeyFromCard(entry.target);
      if(key)enqueue(key);

      observer.unobserve(entry.target);
    });
  },{
    rootMargin:"900px 0px"
  });

  function scanCards(){
    document
      .querySelectorAll(
        '[onclick*="openSeriesDetail"]:not([data-sv-prefetch-v9])'
      )
      .forEach(card=>{
        card.dataset.svPrefetchV9="1";
        observer.observe(card);
      });
  }

  const originalOpenSeriesDetail=openSeriesDetail;

  openSeriesDetail=function(detailKey){
    const cached=cacheByKey.get(detailKey);

    if(cached){
      storeShow(
        detailKey,
        cached,
        _seriesDetailRegistry.get(detailKey)
      );
    }else{
      prefetchKey(detailKey);
    }

    return originalOpenSeriesDetail.apply(this,arguments);
  };

  scanCards();

  new MutationObserver(scanCards).observe(
    document.body,
    {
      childList:true,
      subtree:true
    }
  );
})();
