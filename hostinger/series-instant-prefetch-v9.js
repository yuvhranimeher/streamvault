/* SV_CANONICAL_SERIES_PREFETCH_V10 */
(function(){
  if(window.__svCanonicalSeriesPrefetchV10)return;
  window.__svCanonicalSeriesPrefetchV10=true;

  const detailCache=window.__svCanonicalSeriesDetailCache || new Map();
  window.__svCanonicalSeriesDetailCache=detailCache;
  const maxConcurrentRequests=8;
  const requestQueue=[];
  const debug=window.__svSeriesPrefetchDebug || {
    networkRequests:0,
    cacheHits:0,
    inFlightHits:0,
    observedCards:0,
    activeRequests:0,
    queuedRequests:0
  };
  window.__svSeriesPrefetchDebug=debug;
  let activeRequests=0;
  let requestSequence=0;

  function episodeCount(item){
    return Object.values(item?.seasons || {}).reduce((count,list)=>{
      if(Array.isArray(list))return count+list.length;
      if(Array.isArray(list?.episodes))return count+list.episodes.length;
      return count;
    },0);
  }
  function getSeriesDetailKey(show){
    const id=String(show?.id || '').trim();
    return /^series_[a-f0-9]+$/i.test(id) ? id : '';
  }
  function getCachedSeriesDetail(show){
    const key=getSeriesDetailKey(show);
    if(!key)return null;
    const cached=detailCache.get(key);
    return cached && typeof cached.then!=='function' ? cached : null;
  }
  function runRequestQueue(){
    while(activeRequests<maxConcurrentRequests && requestQueue.length){
      const entry=requestQueue.shift();
      activeRequests++;
      debug.activeRequests=activeRequests;
      debug.queuedRequests=requestQueue.length;
      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve,entry.reject)
        .finally(()=>{
          activeRequests--;
          debug.activeRequests=activeRequests;
          runRequestQueue();
        });
    }
  }
  function enqueueRequest(task,priority=false){
    return new Promise((resolve,reject)=>{
      const entry={task,resolve,reject};
      if(priority)requestQueue.unshift(entry);
      else requestQueue.push(entry);
      debug.queuedRequests=requestQueue.length;
      runRequestQueue();
    });
  }
  async function requestCanonicalSeries(show,key){
    const params=new URLSearchParams();
    if(show?.name || show?.title)params.set('name',show.name || show.title);
    if(show?.year)params.set('year',show.year);
    if(show?.tmdbId)params.set('tmdbId',show.tmdbId);
    debug.networkRequests++;
    const response=await fetchWithTimeout(`/api/series/${encodeURIComponent(key)}?${params.toString()}`,{cache:'no-store'},15000);
    if(!response?.ok)return null;
    let full=await response.json();
    full=window.StreamVaultConfig?.normalizeBackendUrls?.(full) ?? full;
    if(!full?.id || episodeCount(full)<=0)return null;
    return full;
  }
  function prefetchSeriesDetail(show,{priority=false}={}){
    const key=getSeriesDetailKey(show);
    if(!key)return Promise.resolve(null);
    if(episodeCount(show)>0){
      detailCache.set(key,show);
      return Promise.resolve(show);
    }
    if(detailCache.has(key)){
      const cached=detailCache.get(key);
      if(cached && typeof cached.then==='function')debug.inFlightHits++;
      else debug.cacheHits++;
      return cached && typeof cached.then==='function' ? cached : Promise.resolve(cached);
    }
    const pending=enqueueRequest(()=>requestCanonicalSeries(show,key),priority)
      .then(full=>{
        if(!full){
          if(detailCache.get(key)===pending)detailCache.delete(key);
          return null;
        }
        detailCache.set(key,full);
        detailCache.set(String(full.id),full);
        return full;
      })
      .catch(error=>{
        if(detailCache.get(key)===pending)detailCache.delete(key);
        throw error;
      });
    detailCache.set(key,pending);
    return pending;
  }
  function applyCanonicalDetail(detailKey,show,full){
    if(!full || episodeCount(full)<=0)return show;
    Object.assign(show,full,{isSummary:false,isCanonicalSeries:true});
    _seriesDetailRegistry.set(detailKey,show);
    if(Array.isArray(series)){
      const index=series.findIndex(item=>item===show || String(item?.id || '')===String(full.id));
      if(index>=0)series[index]=show;
    }
    detailCache.set(String(full.id),show);
    return show;
  }
  function seriesShowFromCard(card){
    if(!card?.querySelector?.('.series-badge'))return null;
    let key=card.dataset.seriesDetailKey || '';
    if(!key){
      const handler=String(card.getAttribute('onclick') || '');
      key=handler.match(/openSeriesDetail\(['"]([^'"]+)['"]\)/)?.[1] || '';
      if(key)card.dataset.seriesDetailKey=key;
    }
    return key ? _seriesDetailRegistry.get(key) || null : null;
  }
  function prefetchCard(card,priority=false){
    const show=seriesShowFromCard(card);
    if(!show)return;
    prefetchSeriesDetail(show,{priority}).catch(error=>{
      if(error?.name!=='AbortError')console.warn('[Series prefetch] Detail unavailable:',error?.message || error);
    });
  }

  const cardObserver='IntersectionObserver' in window
    ? new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(!entry.isIntersecting)return;
          cardObserver.unobserve(entry.target);
          prefetchCard(entry.target);
        });
      },{rootMargin:'700px 0px',threshold:0.01})
    : null;
  function observeSeriesCards(root=document){
    const cards=[];
    if(root?.matches?.('.card'))cards.push(root);
    root?.querySelectorAll?.('.card').forEach(card=>cards.push(card));
    cards.forEach(card=>{
      if(card.dataset.svSeriesPrefetchObserved || !seriesShowFromCard(card))return;
      card.dataset.svSeriesPrefetchObserved='1';
      debug.observedCards++;
      if(cardObserver)cardObserver.observe(card);
    });
  }
  function handleSeriesIntent(event){
    const card=event.target?.closest?.('.card');
    if(card)prefetchCard(card,true);
  }
  ['pointerenter','mouseenter','focus','touchstart','pointerdown'].forEach(type=>{
    document.addEventListener(type,handleSeriesIntent,{capture:true,passive:true});
  });
  const mutationObserver=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType===1)observeSeriesCards(node);
    }));
  });
  mutationObserver.observe(document.body,{childList:true,subtree:true});
  observeSeriesCards(document);
  const warmFirstCards=()=>{
    Array.from(document.querySelectorAll('.card')).filter(card=>seriesShowFromCard(card)).slice(0,12).forEach(card=>prefetchCard(card));
  };
  if('requestIdleCallback' in window)requestIdleCallback(warmFirstCards,{timeout:1800});
  else setTimeout(warmFirstCards,250);

  window.getSeriesDetailKey=getSeriesDetailKey;
  window.getCachedSeriesDetail=getCachedSeriesDetail;
  window.prefetchSeriesDetail=prefetchSeriesDetail;
  window.svObserveSeriesCards=observeSeriesCards;

  openSeriesDetail=async function(detailKey){
    const show=_seriesDetailRegistry.get(detailKey);
    if(!show)return;
    const request=++requestSequence;
    const immediate=episodeCount(show)>0 ? show : getCachedSeriesDetail(show);
    if(immediate){
      applyCanonicalDetail(detailKey,show,immediate);
      showSeriesDetail(show);
      return;
    }
    showSeriesDetail(show);
    try{
      const full=await prefetchSeriesDetail(show,{priority:true});
      if(request!==requestSequence || !full)return;
      const mobileOpen=document.getElementById('seriesModal')?.classList.contains('open');
      const desktopOpen=!document.getElementById('mediaModal')?.classList.contains('hidden');
      if(!mobileOpen && !desktopOpen)return;
      applyCanonicalDetail(detailKey,show,full);
      showSeriesDetail(show);
    }catch(error){
      console.warn('[Series detail] Canonical hydration failed:',error?.message || error);
      if(!episodeCount(show))showToast('Episodes unavailable');
    }
  };
})();
