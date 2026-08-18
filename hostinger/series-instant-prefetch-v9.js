/* SV_SERIES_INSTANT_PREFETCH_V10 — one resolver for every series */
(function(){
  'use strict';
  if(window.__svSeriesInstantPrefetchV10)return;
  window.__svSeriesInstantPrefetchV10=true;
  window.__SV_SERIES_EPISODE_RESOLVER_VERSION='20260818-series-resolver-v10';

  const nativeFetch=window.fetch.bind(window);
  const byKey=new Map();
  const byTitle=new Map();
  const inflight=new Map();
  const queued=new Set();
  let active=0;
  const queue=[];
  const MAX_CONCURRENT=3;

  function text(v){return String(v??'').trim();}
  function cleanTitle(v){
    return text(v)
      .replace(/^\s*about\s+/i,'')
      .replace(/\[[^\]]*]/g,' ')
      .replace(/\([^)]*(?:tv|web|series|mini)[^)]*\)/gi,' ')
      .replace(/\b(?:tv\s+mini\s+series|tv\s+series|web\s+series|mini\s+series|series)\b/gi,' ')
      .replace(/\b(?:2160p|1080p|720p|540p|480p|4k|uhd|hdr|dual\s+audio|multi\s+audio|multi-audio)\b/gi,' ')
      .replace(/\b(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2})?\b/g,' ')
      .replace(/[._]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function keyTitle(v){return cleanTitle(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function yearOf(v){return text(v?.year||v?.name||v?.title||v).match(/(?:19|20)\d{2}/)?.[0]||'';}
  function seasonsObject(show){
    const source=show?.seasons||{};
    if(Array.isArray(source)){
      const out={};
      source.forEach((season,index)=>{
        const n=Number(season?.season??season?.seasonNumber??season?.number??index+1)||index+1;
        const eps=Array.isArray(season?.episodes)?season.episodes:(Array.isArray(season)?season:[]);
        if(eps.length)out[n]=eps;
      });
      return out;
    }
    const out={};
    Object.entries(source).forEach(([k,v])=>{
      const eps=Array.isArray(v)?v:(Array.isArray(v?.episodes)?v.episodes:[]);
      if(eps.length)out[Number(k)||k]=eps;
    });
    return out;
  }
  function episodeCount(show){return Object.values(seasonsObject(show)).reduce((n,eps)=>n+eps.length,0);}
  function normalizePayload(v){return window.StreamVaultConfig?.normalizeBackendUrls?.(v)??v;}
  function registrySummary(detailKey){try{return _seriesDetailRegistry?.get?.(detailKey)||null;}catch(_){return null;}}

  function best(rows,summary){
    const list=(Array.isArray(rows)?rows:[]).filter(row=>episodeCount(row)>0);
    if(!list.length)return null;
    const id=text(summary?.id);
    if(id){const exactId=list.find(row=>text(row?.id)===id);if(exactId)return exactId;}
    const target=keyTitle(summary?.name||summary?.title);
    const year=yearOf(summary);
    const exact=list.filter(row=>keyTitle(row?.name||row?.title)===target);
    if(exact.length){
      return exact.find(row=>!year||!yearOf(row)||yearOf(row)===year)||exact[0];
    }
    return list.find(row=>{
      const t=keyTitle(row?.name||row?.title);
      return target&&t&&(t.startsWith(target+' ')||target.startsWith(t+' '));
    })||null;
  }

  function cacheShow(detailKey,show,summary){
    if(!show||episodeCount(show)<1)return null;
    show=normalizePayload(show);
    show.seasons=seasonsObject(show);
    show.isSummary=false;
    if(summary&&summary!==show){
      const keep={poster:summary.poster,backdrop:summary.backdrop,overview:summary.overview,rating:summary.rating,genre:summary.genre,year:summary.year};
      Object.assign(summary,show,{seasons:show.seasons,isSummary:false});
      for(const [k,v] of Object.entries(keep))if(!summary[k]&&v)summary[k]=v;
      show=summary;
    }
    if(detailKey){
      byKey.set(detailKey,show);
      try{_seriesDetailRegistry?.set?.(detailKey,show);}catch(_){ }
    }
    for(const n of [show.name,show.title,summary?.name,summary?.title]){
      const k=keyTitle(n);if(k)byTitle.set(k,show);
    }
    try{
      if(Array.isArray(series)){
        const id=text(show.id),title=keyTitle(show.name||show.title);
        const i=series.findIndex(row=>(id&&text(row?.id)===id)||keyTitle(row?.name||row?.title)===title);
        if(i>=0)series[i]=show;else series.push(show);
      }
    }catch(_){ }
    return show;
  }

  async function fetchJson(url,timeout=5000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const r=await nativeFetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error('HTTP '+r.status);
      return normalizePayload(await r.json());
    }finally{clearTimeout(timer);}
  }

  async function resolveSeries(summary,detailKey=''){
    if(!summary)return null;
    if(episodeCount(summary)>0)return cacheShow(detailKey,summary,summary);
    const title=cleanTitle(summary.name||summary.title)||text(summary.name||summary.title);
    const titleKey=keyTitle(title);
    const cached=(detailKey&&byKey.get(detailKey))||byTitle.get(titleKey);
    if(cached&&episodeCount(cached)>0)return cacheShow(detailKey,cached,summary);
    const requestKey=[detailKey,text(summary.id),titleKey,yearOf(summary)].join('|');
    if(inflight.has(requestKey))return inflight.get(requestKey);

    const task=(async()=>{
      // Fastest path: title-specific series search includes the massive catalog.
      if(title){
        try{
          const p=new URLSearchParams({q:title,page:'1',limit:'60',massive:'1'});
          const payload=await fetchJson('/api/series?'+p.toString(),4500);
          const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.series)?payload.series:[]);
          const hit=best(rows,summary);
          if(hit)return cacheShow(detailKey,hit,summary);
        }catch(_){ }
      }

      // Stable detail resolver path.
      try{
        const p=new URLSearchParams();
        if(summary.id!=null)p.set('id',text(summary.id));
        if(title)p.set('name',title);
        const y=yearOf(summary);if(y)p.set('year',y);
        const show=await fetchJson('/api/series/detail?'+p.toString(),4500);
        if(episodeCount(show)>0)return cacheShow(detailKey,show,summary);
      }catch(_){ }

      // Last resolver: search the playable catalog, then retry detail with its stable id.
      if(title){
        try{
          const p=new URLSearchParams({q:title,kind:'series',massive:'1',limit:'30'});
          const payload=await fetchJson('/api/search?'+p.toString(),4500);
          const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.items)?payload.items:[]);
          const candidate=rows.find(row=>keyTitle(row?.name||row?.title)===titleKey)||rows[0];
          if(candidate){
            const d=new URLSearchParams();
            if(candidate.id!=null)d.set('id',text(candidate.id));
            d.set('name',cleanTitle(candidate.name||candidate.title)||title);
            const y=yearOf(candidate)||yearOf(summary);if(y)d.set('year',y);
            const show=await fetchJson('/api/series/detail?'+d.toString(),4500);
            if(episodeCount(show)>0)return cacheShow(detailKey,show,summary);
          }
        }catch(_){ }
      }
      return null;
    })().finally(()=>inflight.delete(requestKey));
    inflight.set(requestKey,task);
    return task;
  }

  function responseFor(show){return new Response(JSON.stringify(show),{status:200,headers:{'Content-Type':'application/json','X-SV-Series-Cache':'resolver-v10'}});}

  // Any caller asking /api/series/detail benefits from the same resolver and cache.
  window.fetch=function(input,options){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw,location.origin);
      if(url.pathname==='/api/series/detail'){
        const id=url.searchParams.get('id')||'';
        const name=url.searchParams.get('name')||url.searchParams.get('title')||'';
        const title=keyTitle(name);
        let cached=null;
        if(title)cached=byTitle.get(title)||null;
        if(!cached&&id){for(const show of byKey.values()){if(text(show?.id)===id){cached=show;break;}}}
        if(cached&&episodeCount(cached)>0)return Promise.resolve(responseFor(cached));
      }
    }catch(_){ }
    return nativeFetch(input,options);
  };

  async function resolveKey(detailKey){
    const summary=registrySummary(detailKey);
    return resolveSeries(summary,detailKey);
  }
  window.__svResolveSeriesEpisodesV10=resolveSeries;

  function detailKeyFromCard(card){
    const code=card?.getAttribute?.('onclick')||'';
    return code.match(/openSeriesDetail\(\s*(['"])(.*?)\1\s*\)/)?.[2]||'';
  }
  function enqueue(key){
    if(!key||queued.has(key)||byKey.has(key))return;
    queued.add(key);queue.push(key);runQueue();
  }
  function runQueue(){
    while(active<MAX_CONCURRENT&&queue.length){
      const key=queue.shift();active++;
      resolveKey(key).catch(()=>null).finally(()=>{active--;queued.delete(key);runQueue();});
    }
  }
  function targetCard(target){return target?.closest?.('[onclick*="openSeriesDetail"]')||null;}
  function warmTarget(target){const card=targetCard(target);const key=detailKeyFromCard(card);if(key)enqueue(key);}
  document.addEventListener('pointerover',e=>warmTarget(e.target),true);
  document.addEventListener('focusin',e=>warmTarget(e.target),true);
  document.addEventListener('pointerdown',e=>warmTarget(e.target),true);
  document.addEventListener('touchstart',e=>warmTarget(e.target),{capture:true,passive:true});

  if('IntersectionObserver'in window){
    const seen=new WeakSet();
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){if(!entry.isIntersecting)continue;warmTarget(entry.target);observer.unobserve(entry.target);}
    },{rootMargin:'1000px 0px'});
    const scan=()=>document.querySelectorAll('[onclick*="openSeriesDetail"]').forEach(card=>{if(!seen.has(card)){seen.add(card);observer.observe(card);}});
    scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  }

  try{
    const originalOpenSeriesDetail=window.openSeriesDetail;
    if(typeof originalOpenSeriesDetail==='function'){
      window.openSeriesDetail=function(detailKey){resolveKey(detailKey).catch(()=>null);return originalOpenSeriesDetail.apply(this,arguments);};
    }
  }catch(_){ }
})();
