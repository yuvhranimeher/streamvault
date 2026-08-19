/* SV_MEDIA_EPISODES_V14 — same-origin episode proxy first, backend fallbacks second */
(function(){
  'use strict';
  if(window.__svMediaEpisodesV14)return;
  window.__svMediaEpisodesV14=true;
  window.__svMediaEpisodesV13=true;
  window.__svMediaEpisodesV12=true;
  window.__SV_SERIES_EPISODES_VERSION='20260820-series-episodes-v14-proxy';

  let activeToken=0;
  let activeKey='';
  let activePromise=null;
  const resolvedCache=new Map();

  function modalOpen(){
    const modal=document.getElementById('mediaModal');
    return !!modal&&!modal.classList.contains('hidden')&&modal.getAttribute('aria-hidden')!=='true';
  }
  function currentItem(){
    try{if(typeof currentMediaModalItem!=='undefined'&&currentMediaModalItem)return currentMediaModalItem;}catch(_){}
    try{if(typeof currentShow!=='undefined'&&currentShow)return currentShow;}catch(_){}
    return null;
  }
  function currentType(){try{return String(typeof currentMediaModalType!=='undefined'?currentMediaModalType:'').toLowerCase();}catch(_){return '';}}
  function isSeries(item){
    const type=String(item?.type||item?.mediaType||currentType()).toLowerCase();
    return type==='tv'||type==='series'||type==='show'||!!item?.seasons||/\b(?:tv\s+(?:mini\s+)?series|web\s+series|series)\b/i.test(String(item?.name||item?.title||''));
  }
  function cleanTitle(value){
    return String(value||'')
      .replace(/^\s*about\s+/i,'')
      .replace(/\[[^\]]*]/g,' ')
      .replace(/\([^)]*(?:tv|web|series|mini)[^)]*\)/gi,' ')
      .replace(/\b(?:tv\s+mini\s+series|tv\s+series|web\s+series|mini\s+series|series)\b/gi,' ')
      .replace(/\b(?:2160p|1080p|720p|480p|4k|uhd|hdr|dual\s+audio|multi\s+audio|multi-audio)\b/gi,' ')
      .replace(/\b(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2})?\b/g,' ')
      .replace(/\b(?:19|20)\d{2}\b/g,' ')
      .replace(/[._]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function norm(value){return cleanTitle(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function yearOf(item){
    const direct=String(item?.year||'').match(/(?:19|20)\d{2}/)?.[0];
    if(direct)return direct;
    return String(item?.name||item?.title||'').match(/(?:19|20)\d{2}/)?.[0]||'';
  }
  function identityKey(item){return [String(item?.id??''),norm(item?.name||item?.title),yearOf(item)].join('|');}
  function sameIdentity(a,b){
    if(!a||!b)return false;
    const aid=String(a?.id??'').trim(),bid=String(b?.id??'').trim();
    if(aid&&bid&&aid===bid)return true;
    const at=norm(a?.name||a?.title),bt=norm(b?.name||b?.title);
    if(!at||!bt||at!==bt)return false;
    const ay=yearOf(a),by=yearOf(b);
    return !ay||!by||ay===by;
  }
  function seasonsObject(show){
    const source=show?.seasons||{};
    if(Array.isArray(source)){
      const out={};
      source.forEach((season,index)=>{
        const num=Number(season?.season??season?.seasonNumber??season?.number??index+1)||index+1;
        const eps=Array.isArray(season?.episodes)?season.episodes:(Array.isArray(season)?season:[]);
        if(eps.length)out[num]=eps;
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
  function normalizePayload(payload){try{return window.StreamVaultConfig?.normalizeBackendUrls?.(payload)??payload;}catch(_){return payload;}}
  function rowsFromPayload(payload){
    if(Array.isArray(payload))return payload;
    for(const key of ['series','items','results'])if(Array.isArray(payload?.[key]))return payload[key];
    return [];
  }
  function candidateScore(row,item,title){
    const episodes=episodeCount(row);if(!episodes)return -1;
    const target=norm(title||item?.name||item?.title),name=norm(row?.name||row?.title);
    if(!target||!name)return -1;
    let score=0;
    if(String(item?.id??'')&&String(row?.id??'')===String(item.id))score+=5000;
    if(name===target)score+=4000;
    else if(name.startsWith(target+' ')||target.startsWith(name+' '))score+=2500;
    else{
      const a=new Set(target.split(/\s+/)),b=new Set(name.split(/\s+/));let hit=0;a.forEach(x=>{if(b.has(x))hit++;});
      score+=(hit/Math.max(1,a.size))*1200;
    }
    const iy=yearOf(item),ry=yearOf(row);if(iy&&ry)score+=iy===ry?800:-800;
    score+=Math.min(episodes,999);
    return score;
  }
  function bestCandidate(rows,item,title){
    return (Array.isArray(rows)?rows:[])
      .map(row=>({row,score:candidateScore(row,item,title)}))
      .filter(x=>x.score>=1200&&episodeCount(x.row)>0)
      .sort((a,b)=>b.score-a.score||episodeCount(b.row)-episodeCount(a.row))[0]?.row||null;
  }

  async function fetchJson(path,signal,timeout=10000){
    const options={cache:'no-store',signal,headers:{Accept:'application/json'}};
    const fn=window.StreamVaultConfig?.fetchWithTimeout;
    const response=fn?await fn(path,options,timeout):await fetch(path,options);
    if(!response?.ok)throw new Error(`HTTP ${response?.status||0}`);
    return normalizePayload(await response.json());
  }

  async function fetchSameOriginProxy(title,year,signal){
    const params=new URLSearchParams({title,_:String(Date.now())});
    if(year)params.set('year',year);
    const controller=new AbortController();
    const relayAbort=()=>controller.abort(signal?.reason);
    if(signal?.aborted)relayAbort();
    else signal?.addEventListener?.('abort',relayAbort,{once:true});
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('/series-episodes-direct.php?'+params.toString(),{
        cache:'no-store',
        signal:controller.signal,
        headers:{Accept:'application/json'}
      });
      if(!response.ok)throw new Error(`Proxy HTTP ${response.status}`);
      return normalizePayload(await response.json());
    }finally{
      clearTimeout(timer);
      signal?.removeEventListener?.('abort',relayAbort);
    }
  }

  async function directResolve(item,signal){
    const rawTitle=String(item?.name||item?.title||'').trim();
    const clean=cleanTitle(rawTitle)||rawTitle;
    const year=yearOf(item);
    const titles=[...new Set([clean,rawTitle].filter(Boolean))];

    for(const title of titles){
      try{
        const show=await fetchSameOriginProxy(title,year,signal);
        if(episodeCount(show)>0)return show;
      }catch(_error){}
    }

    for(const title of titles){
      try{
        const params=new URLSearchParams({title,_:String(Date.now())});
        if(year)params.set('year',year);
        const show=await fetchJson('/api/series/episodes-direct?'+params.toString(),signal,9000);
        if(episodeCount(show)>0)return show;
      }catch(_error){}
    }
    return null;
  }

  async function resolveShow(item,signal){
    const cacheKey=identityKey(item);
    const cached=resolvedCache.get(cacheKey);
    if(cached&&episodeCount(cached)>0)return cached;

    const direct=await directResolve(item,signal);
    if(direct&&episodeCount(direct)>0){resolvedCache.set(cacheKey,direct);return direct;}

    const rawTitle=String(item?.name||item?.title||'').trim();
    const title=cleanTitle(rawTitle)||rawTitle;
    const year=yearOf(item);
    const id=String(item?.id??'').trim();
    const jobs=[];

    const detail=new URLSearchParams();
    if(id)detail.set('id',id);
    if(title)detail.set('name',title);
    if(year)detail.set('year',year);
    detail.set('_',String(Date.now()));
    jobs.push(fetchJson('/api/series/detail?'+detail.toString(),signal,9000));

    for(const q of [...new Set([title,rawTitle].filter(Boolean))]){
      const search=new URLSearchParams({q,kind:'series',page:'0',limit:'48',massive:'1',authority:'episodes-v14',_:String(Date.now())});
      jobs.push(fetchJson('/api/search?'+search.toString(),signal,9000));
      const seriesParams=new URLSearchParams({q,page:'0',limit:'120',massive:'1',_:String(Date.now())});
      jobs.push(fetchJson('/api/series?'+seriesParams.toString(),signal,9000));
    }

    const settled=await Promise.allSettled(jobs);
    const rows=[];
    for(const result of settled){
      if(result.status!=='fulfilled')continue;
      const value=result.value;
      if(episodeCount(value)>0)rows.push(value);
      rows.push(...rowsFromPayload(value));
    }
    const best=bestCandidate(rows,item,title);
    if(best){resolvedCache.set(cacheKey,best);return best;}
    return null;
  }

  function showLoading(){
    const root=document.getElementById('modalEpisodes');if(!root)return;
    root.className='media-modal-section';root.style.display='';
    root.innerHTML='<h2 class="media-modal-heading">Episodes</h2><div class="no-data">Loading episodes…</div>';
  }
  function showFailure(){
    const root=document.getElementById('modalEpisodes');if(!root)return;
    root.className='media-modal-section';root.style.display='';
    root.innerHTML='<h2 class="media-modal-heading">Episodes</h2><div class="no-data">Could not load episodes</div>';
  }
  function copyIntoMatchingRuntimeObjects(source,target){
    const seasons=seasonsObject(source);
    if(!Object.keys(seasons).length)return;
    const apply=obj=>{
      if(!obj||!sameIdentity(obj,target))return;
      const keep={poster:obj.poster,backdrop:obj.backdrop,overview:obj.overview,rating:obj.rating,genre:obj.genre,year:obj.year};
      Object.assign(obj,source,{seasons,isSummary:false});
      for(const [key,value] of Object.entries(keep))if(!obj[key]&&value)obj[key]=value;
    };
    apply(target);
    try{apply(currentMediaModalItem);}catch(_){}
    try{apply(currentShow);}catch(_){}
    try{if(Array.isArray(series))series.forEach(apply);}catch(_){}
  }
  function applyShow(item,show){
    const seasons=seasonsObject(show);if(!Object.keys(seasons).length)return false;
    copyIntoMatchingRuntimeObjects({...show,seasons},item);
    const live=currentItem();
    const target=live&&sameIdentity(live,item)?live:item;
    Object.assign(target,show,{seasons,isSummary:false});
    try{currentShow=target;}catch(_){}
    try{
      const available=Object.keys(seasons).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
      if(available.length&&(!available.includes(Number(currentSeason))))currentSeason=available[0];
    }catch(_){}
    if(typeof renderMediaModalEpisodes==='function')renderMediaModalEpisodes(target);
    return true;
  }

  async function hydrate(item){
    if(!item||!isSeries(item)||!modalOpen())return;
    if(episodeCount(item)>0){applyShow(item,item);return;}

    const key=identityKey(item);
    const cached=resolvedCache.get(key);
    if(cached&&episodeCount(cached)>0){applyShow(item,cached);return;}
    if(activePromise&&activeKey===key)return activePromise;

    activeKey=key;
    const token=++activeToken;
    showLoading();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);

    activePromise=(async()=>{
      try{
        const show=await resolveShow(item,controller.signal);
        if(token!==activeToken||!modalOpen())return;
        const live=currentItem();
        if(live&&!sameIdentity(live,item))return;
        if(!show||episodeCount(show)<1){showFailure();return;}
        applyShow(live||item,show);
      }catch(error){
        if(token===activeToken&&modalOpen())showFailure();
        console.warn('[Episodes v14]',error?.message||error);
      }finally{
        clearTimeout(timer);
        if(token===activeToken)activePromise=null;
      }
    })();
    return activePromise;
  }

  function check(){
    if(!modalOpen())return;
    const item=currentItem();if(item&&isSeries(item))hydrate(item);
  }
  if(typeof openMediaModal==='function'){
    const previousOpenMediaModal=openMediaModal;
    openMediaModal=function(){
      const result=previousOpenMediaModal.apply(this,arguments);
      const item=arguments[0];setTimeout(()=>hydrate(item),0);return result;
    };
  }
  setInterval(check,650);
})();
