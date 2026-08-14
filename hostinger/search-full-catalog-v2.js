(function(){
  'use strict';

  const VERSION='20260814-full-catalog-v2';
  let timer=0;
  let controller=null;
  let seq=0;

  function norm(v){
    return String(v||'').toLowerCase().replace(/&/g,' and ').replace(/['’`]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function isSeries(item){return !!(item&&(item._isSeries||item.type==='series'||item.type==='tv'||item.seasons));}
  function displayable(item){
    if(!item)return false;
    if(item.isMassiveCatalog&&item.streamUrl)return true;
    if(item.isFtp&&item.streamUrl)return true;
    if(item.hasStream===true||item.streamAvailable===true)return true;
    return typeof isPlayableMediaItem!=='function'||isPlayableMediaItem(item);
  }
  function key(item){
    const type=isSeries(item)?'series':'movie';
    const title=norm(item?.name||item?.title||item?.file||'');
    const year=String(item?.year||item?.name||'').match(/(?:19|20)\d{2}/)?.[0]||'';
    return `${type}|${title}|${year}`;
  }
  function priority(item,q){
    const query=norm(q), title=norm(item?.name||item?.title||item?.file||'');
    const year=String(item?.year||item?.name||item?.file||'').match(/(?:19|20)\d{2}/)?.[0]||'';
    const full=norm(`${title} ${year}`);
    if(full===query)return 100000;
    if(title===query)return 95000;
    if(full.startsWith(query))return 90000;
    if(title.startsWith(query))return 85000;
    if(title.includes(query))return 80000;
    const terms=query.split(' ').filter(Boolean);
    if(terms.length&&terms.every(t=>full.includes(t)))return 70000+terms.length*100;
    return 0;
  }
  function merge(q,...groups){
    const out=[],seen=new Set();
    for(const group of groups){
      for(const item of Array.isArray(group)?group:[]){
        if(!displayable(item))continue;
        const k=key(item);if(k&&seen.has(k))continue;if(k)seen.add(k);out.push(item);
      }
    }
    return out.sort((a,b)=>priority(b,q)-priority(a,q)||String(a.name||a.title||'').localeCompare(String(b.name||b.title||'')));
  }
  async function json(url,signal){
    const r=await fetchWithTimeout(url,{cache:'no-store',signal,headers:{Accept:'application/json'}},10000);
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function fullCatalog(q,signal){
    const movieParams=new URLSearchParams({q,page:'0',limit:'100',massive:'1',v:VERSION});
    const seriesParams=new URLSearchParams({q,limit:'100',massive:'1',v:VERSION});
    const [m,s]=await Promise.allSettled([
      json(`/api/movies?${movieParams}`,signal),
      json(`/api/series?${seriesParams}`,signal)
    ]);
    const md=m.status==='fulfilled'?m.value:null;
    const sd=s.status==='fulfilled'?s.value:null;
    const movies=Array.isArray(md?.movies)?md.movies:(Array.isArray(md)?md:[]);
    const series=Array.isArray(sd?.series)?sd.series:(Array.isArray(sd)?sd:[]);
    return merge(q,movies,series);
  }
  async function regular(q,signal){
    try{
      const p=new URLSearchParams({q,kind:'mixed',page:'1',limit:'100',massive:'1',background:'1',v:VERSION});
      const d=await json(`/api/search?${p}`,signal);
      return Array.isArray(d?.items)?d.items:[];
    }catch{return [];}
  }
  function render(items,q,mobile){
    const grid=document.getElementById(mobile?'mobileSearchGrid':'searchGrid');
    const label=document.getElementById(mobile?'mobileSearchLabel':'searchLabel');
    if(!grid)return;
    const cards=items.map(item=>{
      try{return isSeries(item)?sCardHTML(item):cardHTML(item);}catch{return '';}
    }).join('');
    if(items.length){
      grid.innerHTML=cards;
      if(label)label.textContent=`${items.length.toLocaleString()} result${items.length===1?'':'s'} for "${q}"`;
      if(typeof svQueuePosterImages==='function')svQueuePosterImages(grid);
    }else{
      grid.innerHTML='<div class="empty"><h2>Nothing found</h2><p>Try another spelling or fewer words.</p></div>';
      if(label)label.textContent=`No results for "${q}"`;
    }
  }
  function showDesktop(){
    try{if(location.hash==='#downloads')history.replaceState(null,'',location.pathname+location.search);}catch{}
    try{currentTab='search';}catch{}
    ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','downloadsSection','liveSection','mobileMp4Section'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
    const section=document.getElementById('searchSection');if(section)section.style.display='block';
  }
  async function run(q){
    const query=String(q||'').trim();
    const mobile=document.getElementById('searchOverlay')?.classList.contains('open');
    if(!query)return;
    const my=++seq;
    if(controller)controller.abort();controller=new AbortController();
    if(!mobile)showDesktop();
    const grid=document.getElementById(mobile?'mobileSearchGrid':'searchGrid');
    const label=document.getElementById(mobile?'mobileSearchLabel':'searchLabel');
    if(label)label.textContent=`Searching full catalog for "${query}"`;
    try{
      const [normal,catalog]=await Promise.all([regular(query,controller.signal),fullCatalog(query,controller.signal)]);
      if(my!==seq)return;
      render(merge(query,catalog,normal).slice(0,mobile?48:100),query,mobile);
    }catch(err){
      if(err?.name!=='AbortError'&&my===seq)render([],query,mobile);
    }
  }

  const previousHandle=window.handleSearch;
  window.handleSearch=function(q){
    try{previousHandle?.(q);}catch{}
    clearTimeout(timer);
    const value=String(q||'');
    const desktop=document.getElementById('searchInputDesktop');
    const mobile=document.getElementById('searchInputMobile');
    if(desktop&&desktop.value!==value)desktop.value=value;
    if(mobile&&mobile.value!==value)mobile.value=value;
    if(!value.trim())return;
    timer=setTimeout(()=>run(value),260);
  };

  window.renderSearchPage=function(q=''){
    const value=String(q||'');
    const desktop=document.getElementById('searchInputDesktop');if(desktop)desktop.value=value;
    if(value.trim())return run(value);
    return undefined;
  };
})();
