/* StreamVault search reliability v2 — search the catalog, do not hide results before opening details */
(function(){
  'use strict';
  if(window.__SV_SEARCH_RELIABILITY_V2)return;
  window.__SV_SEARCH_RELIABILITY_V2=true;
  window.__SV_SEARCH_RELIABILITY_VERSION='20260819-search-reliability-v2';

  let seq=0;
  let timer=0;
  let controller=null;
  const cache=new Map();

  function isSeries(item){return !!(item&&(item._isSeries||item.type==='series'||item.type==='tv'||item.seasons));}
  function normalizeRows(data){
    if(!data||!Array.isArray(data.items))return [];
    if(!Array.isArray(data.fields))return data.items.filter(Boolean);
    return data.items.map(row=>{
      if(!Array.isArray(row))return row;
      const item={};
      data.fields.forEach((field,index)=>{
        const value=row[index];
        if(value===undefined||value===null||value==='')return;
        if(field==='type')item.type=value==='s'?'series':value==='m'?'movie':value;
        else if(field==='isFtp'||field==='hasStream'||field==='streamAvailable')item[field]=value===1||value===true;
        else item[field]=value;
      });
      item.name=item.name||item.title||item.file||'';
      if(item.type==='series'){item._isSeries=true;item.isSummary=true;}
      return item;
    }).filter(Boolean);
  }

  function key(item){
    const type=isSeries(item)?'series':'movie';
    const title=String(item?.name||item?.title||item?.file||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const year=String(item?.year||'').match(/(?:19|20)\d{2}/)?.[0]||'';
    return `${type}|${title}|${year}`;
  }

  function merge(...lists){
    const out=[];const seen=new Set();
    for(const list of lists)for(const item of (Array.isArray(list)?list:[])){
      if(!item)continue;
      const k=key(item);
      if(k&&seen.has(k))continue;
      if(k)seen.add(k);
      out.push(item);
    }
    return out;
  }

  function syncInputs(q){
    for(const id of ['searchInputDesktop','searchInputMobile']){
      const el=document.getElementById(id);if(el&&el.value!==q)el.value=q;
    }
  }

  function showSearch(){
    try{if(typeof switchTab==='function'&&document.getElementById('searchSection')?.style.display==='none')switchTab('search');}catch(_){}
    for(const id of ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','downloadsSection','liveSection','mobileMp4Section']){
      const el=document.getElementById(id);if(el)el.style.display='none';
    }
    const search=document.getElementById('searchSection');if(search)search.style.display='block';
  }

  function targets(){
    const mobileOpen=document.getElementById('searchOverlay')?.classList.contains('open');
    return mobileOpen
      ? {grid:document.getElementById('mobileSearchGrid'),label:document.getElementById('mobileSearchLabel')}
      : {grid:document.getElementById('searchGrid'),label:document.getElementById('searchLabel')};
  }

  function render(q,items){
    const {grid,label}=targets();
    if(!grid)return;
    if(!items.length){
      if(label)label.textContent=`No results for "${q}"`;
      grid.innerHTML='<div class="empty"><h2>Nothing found</h2><p>Try another spelling or fewer words.</p></div>';
      return;
    }
    if(label)label.textContent=`${items.length.toLocaleString()} result${items.length===1?'':'s'} for "${q}"`;
    const html=items.map(item=>{
      try{return isSeries(item)?sCardHTML(item):cardHTML(item);}catch(_){return '';}
    }).join('');
    grid.innerHTML=html;
    try{if(typeof svQueuePosterImages==='function')svQueuePosterImages(grid);}catch(_){}
  }

  async function requestJson(url,signal,timeout=10000){
    const fetcher=window.StreamVaultConfig?.fetchWithTimeout;
    const response=fetcher
      ? await fetcher(url,{cache:'no-store',signal,headers:{Accept:'application/json'}},timeout)
      : await fetch(url,{cache:'no-store',signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function catalogSearch(q,signal){
    const ck=q.toLowerCase();
    if(cache.has(ck))return cache.get(ck);
    const params=new URLSearchParams({q,kind:'mixed',page:'1',limit:'160',massive:'1',background:'1'});
    let primary=[];
    try{primary=normalizeRows(await requestJson(`/api/search?${params}`,signal,12000));}catch(_){}

    let boot=[];
    if(primary.length<20){
      try{
        const bp=new URLSearchParams({q,kind:'mixed',limit:'160',v:'20260819-search-reliability-v2'});
        boot=normalizeRows(await requestJson(`/api/boot-search-index?${bp}`,signal,7000));
      }catch(_){}
    }

    let alt=[];
    if(!primary.length&&!boot.length&&q.length>3){
      const variant=/s$/i.test(q)?q.replace(/s$/i,''):q+'s';
      if(variant!==q){
        try{
          const ap=new URLSearchParams({q:variant,kind:'mixed',page:'1',limit:'160',massive:'1',background:'1'});
          alt=normalizeRows(await requestJson(`/api/search?${ap}`,signal,10000));
        }catch(_){}
      }
    }

    const result=merge(primary,boot,alt);
    cache.set(ck,result);
    if(cache.size>80)cache.delete(cache.keys().next().value);
    return result;
  }

  async function run(q,mySeq){
    if(mySeq!==seq)return;
    if(controller)controller.abort();
    controller=new AbortController();
    try{
      const items=await catalogSearch(q,controller.signal);
      if(mySeq!==seq)return;
      render(q,items);
    }catch(error){
      if(error?.name==='AbortError')return;
      if(mySeq!==seq)return;
      render(q,[]);
    }
  }

  const previous=window.handleSearch;
  window.handleSearch=function reliableHandleSearch(value){
    const q=String(value||'').trim();
    const mySeq=++seq;
    clearTimeout(timer);
    syncInputs(String(value||''));
    showSearch();
    if(!q){
      if(controller)controller.abort();
      const {grid,label}=targets();
      if(label)label.textContent='Start typing to search your vault';
      if(grid)grid.innerHTML='';
      return;
    }
    timer=setTimeout(()=>run(q,mySeq),120);
  };

  // Inline oninput handlers resolve handleSearch at event time, so replacing the
  // global function above replaces the old filtered search without touching cards/player.
  window.__svPreviousHandleSearch=previous;
})();
