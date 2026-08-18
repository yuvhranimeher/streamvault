/* STREAMVAULT_DETAIL_FAST_PATH_V1 */
(function(){
  'use strict';
  if(window.__SV_DETAIL_FAST_PATH_V1)return;
  window.__SV_DETAIL_FAST_PATH_V1=true;
  window.__SV_DETAIL_FAST_PATH_VERSION='20260818-detail-fast-v1';

  const seriesCache=new Map();
  const seriesInflight=new Map();
  const detailCache=new Map();
  const detailInflight=new Map();
  const warmedImages=new Set();
  const queuedItems=new Set();
  let backgroundPrefetchCount=0;
  const MAX_BACKGROUND_PREFETCH=16;
  const SESSION_PREFIX='sv:series-fast:v1:';

  function text(value){return String(value??'').trim();}
  function cleanTitle(value){
    return text(value)
      .replace(/^\s*about\s+/i,'')
      .replace(/\[[^\]]*]/g,' ')
      .replace(/\([^)]*(?:tv|web|series|mini)[^)]*\)/gi,' ')
      .replace(/\b(?:tv\s+mini\s+series|tv\s+series|web\s+series|mini\s+series|series)\b/gi,' ')
      .replace(/\b(?:2160p|1080p|720p|480p|4k|uhd|hdr|dual\s+audio|multi\s+audio|multi-audio)\b/gi,' ')
      .replace(/\b(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2})?\b/g,' ')
      .replace(/[._]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function norm(value){return cleanTitle(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function yearOf(item){return text(item?.year).match(/(?:19|20)\d{2}/)?.[0]||text(item?.name||item?.title).match(/(?:19|20)\d{2}/)?.[0]||'';}
  function isSeries(item){
    const type=text(item?.type||item?.mediaType).toLowerCase();
    return type==='series'||type==='tv'||type==='show'||!!item?.seasons||/\b(?:tv\s+(?:mini\s+)?series|web\s+series)\b/i.test(text(item?.name||item?.title));
  }
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
    Object.entries(source).forEach(([key,value])=>{
      const eps=Array.isArray(value)?value:(Array.isArray(value?.episodes)?value.episodes:[]);
      if(eps.length)out[Number(key)||key]=eps;
    });
    return out;
  }
  function episodeCount(show){return Object.values(seasonsObject(show)).reduce((n,eps)=>n+(Array.isArray(eps)?eps.length:0),0);}
  function seriesKey(item){return [text(item?.id),norm(item?.name||item?.title),yearOf(item)].join('|');}
  function detailKey(item){return [isSeries(item)?'tv':'movie',text(item?.tmdbId),norm(item?.name||item?.title),yearOf(item)].join('|');}

  function allSeriesRows(){
    const rows=[];
    try{if(typeof currentShow!=='undefined'&&currentShow)rows.push(currentShow);}catch(_){ }
    try{if(typeof currentMediaModalItem!=='undefined'&&currentMediaModalItem&&isSeries(currentMediaModalItem))rows.push(currentMediaModalItem);}catch(_){ }
    try{if(typeof series!=='undefined'&&Array.isArray(series))rows.push(...series);}catch(_){ }
    try{if(typeof _seriesDetailRegistry!=='undefined'&&_seriesDetailRegistry?.values)rows.push(..._seriesDetailRegistry.values());}catch(_){ }
    return rows.filter(Boolean);
  }
  function allMediaRows(){
    const rows=[];
    try{if(typeof movies!=='undefined'&&Array.isArray(movies))rows.push(...movies);}catch(_){ }
    try{if(typeof series!=='undefined'&&Array.isArray(series))rows.push(...series);}catch(_){ }
    return rows.filter(Boolean);
  }
  function bestSeries(rows,item){
    const list=(Array.isArray(rows)?rows:[]).filter(row=>episodeCount(row)>0);
    if(!list.length)return null;
    const id=text(item?.id);
    if(id){const byId=list.find(row=>text(row?.id)===id);if(byId)return byId;}
    const target=norm(item?.name||item?.title);
    const year=yearOf(item);
    let candidates=list.filter(row=>norm(row?.name||row?.title)===target);
    if(year){const yearMatch=candidates.find(row=>!yearOf(row)||yearOf(row)===year);if(yearMatch)return yearMatch;}
    if(candidates[0])return candidates[0];
    return list.find(row=>{
      const value=norm(row?.name||row?.title);
      return target&&value&&(value.startsWith(target+' ')||target.startsWith(value+' '));
    })||null;
  }
  function mergeSeries(item,show){
    if(!item||!show||episodeCount(show)<1)return null;
    const preserved={poster:item.poster,backdrop:item.backdrop,overview:item.overview,rating:item.rating,genre:item.genre,year:item.year};
    Object.assign(item,show,{seasons:seasonsObject(show),isSummary:false});
    for(const [key,value] of Object.entries(preserved)){if(!item[key]&&value)item[key]=value;}
    const key=seriesKey(item);
    seriesCache.set(key,item);
    try{
      if(typeof series!=='undefined'&&Array.isArray(series)){
        const id=text(item.id),title=norm(item.name||item.title);
        const idx=series.findIndex(row=>(id&&text(row?.id)===id)||norm(row?.name||row?.title)===title);
        if(idx>=0)series[idx]=item;
      }
    }catch(_){ }
    try{
      const payload=JSON.stringify(item);
      if(payload.length<700000)sessionStorage.setItem(SESSION_PREFIX+encodeURIComponent(key).slice(0,220),payload);
    }catch(_){ }
    return item;
  }
  function sessionSeries(item){
    const key=seriesKey(item);
    try{
      const raw=sessionStorage.getItem(SESSION_PREFIX+encodeURIComponent(key).slice(0,220));
      if(!raw)return null;
      const parsed=JSON.parse(raw);
      return episodeCount(parsed)>0?parsed:null;
    }catch(_){return null;}
  }

  function normalizePayload(payload){return window.StreamVaultConfig?.normalizeBackendUrls?.(payload)??payload;}
  async function fetchJson(url,timeoutMs=6000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{cache:'default',signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('HTTP '+response.status);
      return normalizePayload(await response.json());
    }finally{clearTimeout(timer);}
  }

  async function fetchSeriesFast(item){
    const key=seriesKey(item);
    if(seriesCache.has(key))return seriesCache.get(key);
    const stored=sessionSeries(item);
    if(stored){mergeSeries(item,stored);return item;}
    const local=bestSeries(allSeriesRows(),item);
    if(local){mergeSeries(item,local);return item;}
    if(seriesInflight.has(key))return seriesInflight.get(key);

    const task=(async()=>{
      const title=cleanTitle(item?.name||item?.title)||text(item?.name||item?.title);
      const year=yearOf(item);
      if(title){
        try{
          const params=new URLSearchParams({q:title,page:'1',limit:'24'});
          const payload=await fetchJson('/api/series?'+params.toString(),5000);
          const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.series)?payload.series:[]);
          const best=bestSeries(rows,item);
          if(best)return mergeSeries(item,best);
        }catch(_){ }
      }
      try{
        const params=new URLSearchParams();
        if(item?.id!=null)params.set('id',text(item.id));
        if(title)params.set('name',title);
        if(year)params.set('year',year);
        const payload=await fetchJson('/api/series/detail?'+params.toString(),4500);
        if(episodeCount(payload)>0)return mergeSeries(item,payload);
      }catch(_){ }
      return null;
    })().finally(()=>seriesInflight.delete(key));
    seriesInflight.set(key,task);
    return task;
  }

  function updateSeasonCount(item){
    const count=Object.keys(seasonsObject(item)).length;
    if(!count)return;
    const root=document.getElementById('modalExtraInfo');
    if(!root)return;
    const cards=[...root.querySelectorAll('.metadata-item,.metadata-card,.meta-card,.info-card,div')];
    for(const card of cards){
      const label=[...card.children].find(child=>/^runtime$/i.test(text(child.textContent)));
      if(!label)continue;
      const value=[...card.children].find(child=>child!==label);
      if(value){value.textContent=count+' season'+(count===1?'':'s');break;}
    }
  }
  function renderEpisodesFast(item){
    try{if(typeof currentShow!=='undefined')currentShow=item;}catch(_){ }
    try{
      if(typeof renderMediaModalEpisodes==='function')renderMediaModalEpisodes(item);
      updateSeasonCount(item);
    }catch(_){ }
  }

  async function fastHydrate(item){
    if(!item||!isSeries(item))return item||null;
    if(episodeCount(item)>0){renderEpisodesFast(item);return item;}
    const ready=await fetchSeriesFast(item);
    if(ready)renderEpisodesFast(item);
    return ready;
  }

  try{
    if(typeof svLoadFullSeriesCatalog==='function'){
      svLoadFullSeriesCatalog=async function(){return allSeriesRows().filter(row=>episodeCount(row)>0);};
      window.svLoadFullSeriesCatalog=svLoadFullSeriesCatalog;
    }
    if(typeof svHydrateSeriesEpisodes==='function'){
      svHydrateSeriesEpisodes=fastHydrate;
      window.svHydrateSeriesEpisodes=fastHydrate;
    }
  }catch(_){ }
  window.__svFastSeriesHydrate=fastHydrate;

  function warmImage(url,priority='low'){
    const src=text(url);
    if(!src||warmedImages.has(src))return;
    warmedImages.add(src);
    const image=new Image();
    image.decoding='async';
    try{image.fetchPriority=priority;}catch(_){ }
    image.src=src;
    if(typeof image.decode==='function')image.decode().catch(()=>{});
  }
  function warmArtwork(item,priority='low'){
    warmImage(item?.backdrop||item?.poster,priority);
    if(item?.poster&&item?.poster!==item?.backdrop)warmImage(item.poster,priority);
  }
  function applyDetail(item,data){
    if(!item||!data)return;
    for(const key of ['overview','poster','backdrop','rating','genre','genres','language','tmdbId']){
      if(data[key]!==undefined&&data[key]!==null&&data[key]!==''&&!item[key])item[key]=data[key];
    }
    warmArtwork(item,'low');
  }
  async function prefetchTitleDetails(item){
    if(!item)return null;
    const key=detailKey(item);
    if(detailCache.has(key)){applyDetail(item,detailCache.get(key));return detailCache.get(key);}
    if(detailInflight.has(key))return detailInflight.get(key);
    const title=cleanTitle(item?.name||item?.title)||text(item?.name||item?.title);
    if(!title)return null;
    const params=new URLSearchParams({title:title,type:isSeries(item)?'tv':'movie'});
    const year=yearOf(item);if(year)params.set('year',year);
    if(item?.tmdbId)params.set('tmdbId',text(item.tmdbId));
    const task=fetchJson('/api/title-details?'+params.toString(),5500)
      .then(data=>{detailCache.set(key,data);applyDetail(item,data);return data;})
      .catch(()=>null)
      .finally(()=>detailInflight.delete(key));
    detailInflight.set(key,task);
    return task;
  }

  function primePreview(item){
    const src=text(item?.backdrop||item?.poster);
    if(!src)return;
    warmImage(src,'high');
    const preview=document.getElementById('modalPreview');
    if(preview){
      preview.preload='none';
      if(!preview.poster)preview.poster=src;
    }
    const hero=document.querySelector('#mediaModal .modal-hero');
    if(hero&&!hero.style.backgroundImage){
      hero.style.backgroundImage='url("'+src.replace(/"/g,'%22')+'")';
      hero.style.backgroundSize='cover';
      hero.style.backgroundPosition='center';
    }
  }

  async function primeItem(item,priority='low'){
    if(!item)return;
    warmArtwork(item,priority);
    const tasks=[prefetchTitleDetails(item)];
    if(isSeries(item))tasks.push(fetchSeriesFast(item));
    await Promise.allSettled(tasks);
  }

  function candidateFromElement(element){
    const card=element?.closest?.('.card,.movie-card,.series-card,.media-card,.search-card,.row-card,[onclick*="openSeriesDetail"],[onclick*="openMediaModal"]');
    if(!card)return null;
    let label=text(card.getAttribute('data-title')||card.getAttribute('aria-label'));
    if(!label){
      const titleNode=card.querySelector('.card-title,.media-title,.series-title,.movie-title,.item-title,.title,[data-title]');
      label=text(titleNode?.textContent||card.querySelector('img')?.alt||'');
    }
    if(!label){label=text(card.textContent).split('\n').map(text).find(Boolean)||'';}
    const target=norm(label);
    if(!target)return null;
    const rows=allMediaRows();
    return rows.find(item=>norm(item?.name||item?.title)===target)
      || rows.find(item=>{const value=norm(item?.name||item?.title);return value&&(target.startsWith(value+' ')||value.startsWith(target+' '));})
      || null;
  }

  function schedulePrime(item,urgent=false){
    if(!item)return;
    const key=detailKey(item);
    if(queuedItems.has(key))return;
    queuedItems.add(key);
    const run=()=>primeItem(item,urgent?'high':'low').finally(()=>queuedItems.delete(key));
    if(urgent){run();return;}
    if(backgroundPrefetchCount>=MAX_BACKGROUND_PREFETCH){queuedItems.delete(key);return;}
    backgroundPrefetchCount++;
    if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:900});
    else setTimeout(run,80);
  }

  document.addEventListener('pointerover',event=>{const item=candidateFromElement(event.target);if(item)schedulePrime(item,true);},{capture:true,passive:true});
  document.addEventListener('focusin',event=>{const item=candidateFromElement(event.target);if(item)schedulePrime(item,true);},true);
  document.addEventListener('pointerdown',event=>{const item=candidateFromElement(event.target);if(item)schedulePrime(item,true);},{capture:true,passive:true});

  const observed=new WeakSet();
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const item=candidateFromElement(entry.target);
      if(item)schedulePrime(item,false);
      observer.unobserve(entry.target);
    }
  },{rootMargin:'700px 0px'}):null;
  function scanCards(){
    if(!observer)return;
    document.querySelectorAll('.card,.movie-card,.series-card,.media-card,.search-card,.row-card,[onclick*="openSeriesDetail"],[onclick*="openMediaModal"]').forEach(card=>{
      if(observed.has(card))return;
      if(!card.querySelector('img')&&!/series|movie/i.test(text(card.className)))return;
      observed.add(card);observer.observe(card);
    });
  }
  let scanTimer=0;
  function queueScan(){clearTimeout(scanTimer);scanTimer=setTimeout(scanCards,120);}
  new MutationObserver(queueScan).observe(document.body,{childList:true,subtree:true});
  setTimeout(scanCards,80);

  try{
    const previousOpenMediaModal=openMediaModal;
    openMediaModal=function(item,requestedType=''){
      if(item){
        const cached=seriesCache.get(seriesKey(item))||sessionSeries(item)||bestSeries(allSeriesRows(),item);
        if(cached&&isSeries(item))mergeSeries(item,cached);
        const details=detailCache.get(detailKey(item));if(details)applyDetail(item,details);
        primePreview(item);
      }
      const result=previousOpenMediaModal.apply(this,arguments);
      if(item){
        queueMicrotask(()=>{
          if(isSeries(item))fastHydrate(item);
          prefetchTitleDetails(item);
        });
      }
      return result;
    };
    window.openMediaModal=openMediaModal;
  }catch(_){ }

  try{
    const style=document.createElement('style');
    style.id='sv-detail-fast-style-v1';
    style.textContent=`
      #mediaModal .media-modal-backdrop{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}
      #mediaModal .media-modal-content{contain:layout paint;overscroll-behavior:contain;scroll-behavior:auto!important;}
      #mediaModal #modalRelated,#mediaModal #modalCast{content-visibility:auto;contain-intrinsic-size:1px 320px;}
      #mediaModal .ep-thumb-img,#mediaModal img{content-visibility:auto;}
      #mediaModal .modal-hero{background-color:#111;background-repeat:no-repeat;}
      @media (max-width:900px),(prefers-reduced-motion:reduce){
        #mediaModal *,#mediaModal *::before,#mediaModal *::after{animation-duration:.001ms!important;transition-duration:.001ms!important;}
      }
    `;
    document.head.appendChild(style);
    const preview=document.getElementById('modalPreview');if(preview)preview.preload='none';
  }catch(_){ }
})();
