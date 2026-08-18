/* SV_MEDIA_EPISODES_V10 — stable identity hydration */
(function(){
  'use strict';
  if(window.__svMediaEpisodesV10)return;
  window.__svMediaEpisodesV10=true;
  window.__SV_SERIES_EPISODES_VERSION='20260818-series-episodes-v10';

  let activeToken=0;
  let activeKey='';
  let activePromise=null;

  function modalOpen(){
    const modal=document.getElementById('mediaModal');
    return !!modal && !modal.classList.contains('hidden') && modal.getAttribute('aria-hidden')!=='true';
  }

  function currentItem(){
    try{
      if(typeof currentMediaModalItem!=='undefined' && currentMediaModalItem)return currentMediaModalItem;
      if(typeof currentShow!=='undefined' && currentShow)return currentShow;
    }catch(_){ }
    return null;
  }

  function currentType(){
    try{return String(typeof currentMediaModalType!=='undefined' ? currentMediaModalType : '').toLowerCase();}catch(_){return '';}
  }

  function isSeries(item){
    const type=String(item?.type||item?.mediaType||currentType()).toLowerCase();
    if(type==='tv'||type==='series'||type==='show')return true;
    if(item?.seasons)return true;
    return /\b(?:tv\s+(?:mini\s+)?series|web\s+series|series)\b/i.test(String(item?.name||item?.title||''));
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

  function norm(value){
    return cleanTitle(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  }

  function yearOf(item){
    const direct=String(item?.year||'').match(/(?:19|20)\d{2}/)?.[0];
    if(direct)return direct;
    return String(item?.name||item?.title||'').match(/(?:19|20)\d{2}/)?.[0]||'';
  }

  function seasonsObject(show){
    const source=show?.seasons||{};
    if(Array.isArray(source)){
      const out={};
      source.forEach((season,index)=>{
        const num=Number(season?.season ?? season?.seasonNumber ?? season?.number ?? index+1)||index+1;
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

  function episodeCount(show){
    return Object.values(seasonsObject(show)).reduce((n,eps)=>n+(Array.isArray(eps)?eps.length:0),0);
  }

  function normalizePayload(payload){
    return window.StreamVaultConfig?.normalizeBackendUrls?.(payload) ?? payload;
  }

  function bestCandidate(rows,item,title){
    const list=(Array.isArray(rows)?rows:[]).filter(row=>episodeCount(row)>0);
    if(!list.length)return null;
    const id=String(item?.id??'');
    if(id){
      const exactId=list.find(row=>String(row?.id??'')===id);
      if(exactId)return exactId;
    }
    const target=norm(title||item?.name||item?.title);
    if(target){
      const exact=list.find(row=>norm(row?.name||row?.title)===target);
      if(exact)return exact;
      const prefix=list.find(row=>{
        const value=norm(row?.name||row?.title);
        return value && (value.startsWith(target+' ')||target.startsWith(value+' '));
      });
      if(prefix)return prefix;
    }
    return null;
  }

  async function fetchJson(url,signal){
    const response=await fetch(url,{cache:'no-store',signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return normalizePayload(await response.json());
  }

  async function resolveShow(item,signal){
    const rawTitle=String(item?.name||item?.title||'').trim();
    const title=cleanTitle(rawTitle)||rawTitle;
    const year=yearOf(item);
    const id=String(item?.id??'').trim();

    const detailParams=new URLSearchParams();
    if(id)detailParams.set('id',id);
    if(title)detailParams.set('name',title);
    if(year)detailParams.set('year',year);
    detailParams.set('_',String(Date.now()));

    try{
      const detail=await fetchJson('/api/series/detail?'+detailParams.toString(),signal);
      if(episodeCount(detail)>0)return detail;
    }catch(_){ }

    if(id){
      try{
        const byId=new URLSearchParams({id:id,_:String(Date.now())});
        const detail=await fetchJson('/api/series/detail?'+byId.toString(),signal);
        if(episodeCount(detail)>0)return detail;
      }catch(_){ }
    }

    if(title){
      try{
        const query=new URLSearchParams({q:title,page:'1',limit:'200',_:String(Date.now())});
        const payload=await fetchJson('/api/series?'+query.toString(),signal);
        const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.series)?payload.series:[]);
        const best=bestCandidate(rows,item,title);
        if(best)return best;
      }catch(_){ }
    }

    return null;
  }

  function showLoading(){
    const root=document.getElementById('modalEpisodes');
    if(!root)return;
    root.className='media-modal-section';
    root.style.display='';
    root.innerHTML='<h2 class="media-modal-heading">Episodes</h2><div class="no-data">Loading episodes…</div>';
  }

  function showFailure(){
    const root=document.getElementById('modalEpisodes');
    if(!root)return;
    root.className='media-modal-section';
    root.style.display='';
    root.innerHTML='<h2 class="media-modal-heading">Episodes</h2><div class="no-data">Could not load episodes</div>';
  }

  function applyShow(item,show){
    const seasons=seasonsObject(show);
    if(!Object.keys(seasons).length)return false;

    const preserved={
      poster:item?.poster,
      backdrop:item?.backdrop,
      overview:item?.overview,
      rating:item?.rating,
      genre:item?.genre,
      year:item?.year
    };

    Object.assign(item,show,{seasons,isSummary:false});
    for(const [key,value] of Object.entries(preserved)){
      if(!item[key]&&value)item[key]=value;
    }

    try{
      currentShow=item;
      const available=Object.keys(seasons).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
      if(available.length && !available.includes(Number(currentSeason)))currentSeason=available[0];
    }catch(_){ }

    try{
      if(Array.isArray(series)){
        const id=String(item?.id??'');
        const title=norm(item?.name||item?.title);
        const index=series.findIndex(row=>(id&&String(row?.id??'')===id)||norm(row?.name||row?.title)===title);
        if(index>=0)series[index]=item;
      }
    }catch(_){ }

    if(typeof renderMediaModalEpisodes==='function'){
      renderMediaModalEpisodes(item);
    }

    try{
      if(typeof populateModal==='function')populateModal(item);
    }catch(_){ }
    return true;
  }

  async function hydrate(item){
    if(!item||!isSeries(item)||!modalOpen())return;
    if(episodeCount(item)>0){
      applyShow(item,item);
      return;
    }

    const key=[String(item?.id??''),norm(item?.name||item?.title),yearOf(item)].join('|');
    if(activePromise&&activeKey===key)return activePromise;

    activeKey=key;
    const token=++activeToken;
    showLoading();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);

    activePromise=(async()=>{
      try{
        const show=await resolveShow(item,controller.signal);
        if(token!==activeToken||!modalOpen()||currentItem()!==item)return;
        if(!show||episodeCount(show)<1){showFailure();return;}
        applyShow(item,show);
      }catch(error){
        if(token===activeToken&&modalOpen())showFailure();
        console.warn('[Episodes v10]',error?.message||error);
      }finally{
        clearTimeout(timer);
        if(token===activeToken)activePromise=null;
      }
    })();

    return activePromise;
  }

  function check(){
    if(!modalOpen())return;
    const item=currentItem();
    if(item&&isSeries(item))hydrate(item);
  }

  if(typeof openMediaModal==='function'){
    const previousOpenMediaModal=openMediaModal;
    openMediaModal=function(){
      const result=previousOpenMediaModal.apply(this,arguments);
      const item=arguments[0];
      setTimeout(()=>hydrate(item),0);
      return result;
    };
  }

  setInterval(check,500);
})();
