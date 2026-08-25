/* STREAMVAULT_DETAIL_FAST_PATH_V2 */
(function(){
  'use strict';
  if(window.__SV_DETAIL_FAST_PATH_V1)return;
  window.__SV_DETAIL_FAST_PATH_V1=true;
  window.__SV_DETAIL_FAST_PATH_VERSION='20260825-poster-modal-perf-v2';

  const seriesCache=new Map();
  const seriesInflight=new Map();
  const detailCache=new Map();
  const detailInflight=new Map();
  const warmedImages=new Set();
  const queuedItems=new Set();
  let backgroundPrefetchCount=0;
  const MAX_BACKGROUND_PREFETCH=0;
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

  // Card-detail prefetch is deliberately interaction-free. The previous
  // observer enriched 16 cards and decoded large artwork during startup.

  let posterPriorityFrame=0;
  function prioritizeVisiblePosters(){
    posterPriorityFrame=0;
    const viewportBottom=window.innerHeight+240;
    const visible=Array.from(document.querySelectorAll('#mainSection .card img, #moviesSection .card img, #seriesSection .card img'))
      .filter(image=>{
        const rect=image.getBoundingClientRect();
        return rect.bottom>0 && rect.top<viewportBottom
          && rect.right>-240 && rect.left<window.innerWidth+480;
      });
    visible.forEach((image,index)=>{
      image.loading='eager';
      image.decoding='async';
      try{image.fetchPriority=index<8?'high':'auto';}catch(_){}
      const source=image.getAttribute('data-sv-src') || image.getAttribute('data-src');
      if(source && !image.getAttribute('src'))image.src=source;
    });
  }
  function queuePosterPriority(){
    if(!posterPriorityFrame)posterPriorityFrame=requestAnimationFrame(prioritizeVisiblePosters);
  }
  const posterRoot=document.getElementById('mainSection') || document.body;
  new MutationObserver(queuePosterPriority).observe(posterRoot,{childList:true,subtree:true});
  queuePosterPriority();

  // The base modal already renders from in-memory catalog data. Avoid an
  // additional title-details request and artwork warmup around every open.

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

  function svModalStillCurrent(item,token){
    const modal=document.getElementById('mediaModal');
    return token===mediaModalRenderToken && currentMediaModalItem===item && modal && !modal.classList.contains('hidden');
  }
  function svModalIdle(callback){
    if('requestIdleCallback' in window)return requestIdleCallback(callback,{timeout:600});
    return setTimeout(callback,0);
  }
  function svModalTitleData(item,type,details={}){
    const local={
      ok:true,
      title:item?.name || item?.title || '',
      overview:item?.overview || '',
      poster:item?.poster || '',
      backdrop:item?.backdrop || item?.poster || '',
      year:item?.year || '',
      rating:item?.rating || '',
      runtime:item?.runtime || '',
      genres:item?.genre || item?.genres || '',
      language:item?.language || '',
      cast:Array.isArray(item?.cast) ? item.cast : [],
      similar:Array.isArray(item?.similar) ? item.similar : []
    };
    return details?.ok ? {...local,...details} : local;
  }
  function svUpdateModalHeader(item,type,data){
    const title=data.title || item.name || item.title || 'Untitled';
    const meta=[data.rating ? '\u2605 '+data.rating : '',data.year || item.year || '',data.runtime || item.runtime || '',data.genres || item.genre || '',type==='tv'?'Series':'Movie'].filter(Boolean);
    document.getElementById('modalTitle').textContent=title;
    document.getElementById('modalMeta').textContent=meta.join('  \u2022  ');
    document.getElementById('modalDescriptionHeading').textContent='About '+title;
    document.getElementById('modalDescription').textContent=data.overview || item.overview || 'No overview is available for this title yet.';
  }
  function svRenderModalMetadata(item,type,data){
    const extra=document.getElementById('modalExtraInfo');
    extra.className='media-modal-section';
    extra.innerHTML='<h2 class="media-modal-heading">Details</h2><div class="metadata-grid">'+metadataGridFromItems([
      {label:'Year',value:data.year || item.year || 'Unknown'},
      {label:'Rating',value:data.rating ? data.rating+'/10' : 'Unrated'},
      {label:'Runtime',value:data.runtime || item.runtime || (type==='tv' ? Object.keys(item.seasons || {}).length+' seasons' : 'Unknown')},
      {label:'Genres',value:data.genres || item.genre || 'Unknown'},
      {label:'Language',value:data.language || item.language || 'Unknown'},
      {label:'Type',value:type==='tv' ? 'Series' : 'Movie'}
    ])+'</div>';
  }
  function svRenderModalCast(data){
    const cast=Array.isArray(data.cast) ? data.cast.slice(0,12) : [];
    const root=document.getElementById('modalCast');
    root.className='media-modal-section';
    root.style.display=cast.length ? '' : 'none';
    root.innerHTML=cast.length ? '<h2 class="media-modal-heading">Cast</h2><div class="media-modal-cast-track">'+cast.map(person=>'<div class="person-card"><div class="person-photo">'+(person.image?'<img src="'+esc(person.image)+'" alt="'+esc(person.name || '')+'" loading="lazy" decoding="async">':personPlaceholder())+'</div><div class="person-name">'+esc(person.name || 'Unknown')+'</div><div class="person-role">'+esc(person.role || '')+'</div></div>').join('')+'</div>' : '';
  }
  function svRenderModalRelated(item,type,data){
    const local=localTitleDetails(item,type);
    const candidates=[...(Array.isArray(data.similar)?data.similar:[]),...(Array.isArray(local.similar)?local.similar:[])];
    const seen=new Set();
    const playable=filterPlayableMediaItems(candidates).filter(candidate=>{
      const key=String(candidate.tmdbId || candidate.id || candidate.streamUrl || candidate.name || '').toLowerCase();
      if(!key || seen.has(key))return false;
      seen.add(key);return true;
    }).slice(0,16);
    const root=document.getElementById('modalRelated');
    root.className='media-modal-section';
    root.style.display=playable.length ? '' : 'none';
    root.innerHTML=playable.length ? '<h2 class="media-modal-heading">More Like This</h2><div class="media-modal-related-track">'+playable.map(candidate=>(candidate.type==='tv'||candidate.seasons)?sCardHTML(candidate):cardHTML(candidate)).join('')+'</div>' : '';
  }
  function svRenderModalShell(item,type){
    const data=svModalTitleData(item,type);
    svUpdateModalHeader(item,type,data);
    renderMediaModalActions(item,type);
    const preview=document.getElementById('modalPreview');
    preview.pause();
    preview.removeAttribute('src');
    preview.preload='none';
    const artworkItem=data.backdrop || data.poster ? {...item,...data} : item;
    svApplyMediaModalArtwork(preview,artworkItem,type,item);
    svRenderModalMetadata(item,type,data);
    const cast=document.getElementById('modalCast');
    cast.innerHTML='';cast.style.display='none';
    const related=document.getElementById('modalRelated');
    related.innerHTML='';related.style.display='none';
    if(type==='tv')renderMediaModalEpisodes(item);
    else{
      const episodes=document.getElementById('modalEpisodes');
      episodes.innerHTML='';episodes.className='';episodes.style.display='none';
    }
  }

  // Detail UI and playback metadata are separate. Playback fetches its own
  // media information only after the user presses Play.
  try{svPrewarmPlaybackMetadata=function(){};window.svPrewarmPlaybackMetadata=svPrewarmPlaybackMetadata;}catch(_){}
  try{svQueueModalArtworkPreload=function(){};window.svQueueModalArtworkPreload=svQueueModalArtworkPreload;}catch(_){}

  try{
    populateModalFields=async function(item){
      const type=currentMediaModalType;
      const token=++mediaModalRenderToken;
      svRenderModalShell(item,type);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      try{
        const details=await fetchTitleDetails(item,type);
        if(!svModalStillCurrent(item,token))return;
        mergeTitleDetails(item,details);
        const data=svModalTitleData(item,type,details || {});
        svUpdateModalHeader(item,type,data);
        renderMediaModalActions(item,type);
        svRenderModalMetadata(item,type,data);
        if(data.backdrop || data.poster)svApplyMediaModalArtwork(document.getElementById('modalPreview'),{...item,...data},type,item);
        svModalIdle(()=>{if(svModalStillCurrent(item,token))svRenderModalCast(data);});
        svModalIdle(()=>{if(svModalStillCurrent(item,token))svRenderModalRelated(item,type,data);});
      }catch(error){
        if(error?.name!=='AbortError')console.warn('[Media Modal] Online details unavailable:',error?.message || error);
      }
    };
    populateModal=function(item){return populateModalFields(item);};
    window.populateModalFields=populateModalFields;
    window.populateModal=populateModal;
  }catch(_){}

})();
