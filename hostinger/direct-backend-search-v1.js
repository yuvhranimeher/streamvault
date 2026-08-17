(function(){
  'use strict';

  const BACKEND='https://backend.streamvault.fit';
  const VERSION='20260817-direct-backend-search-v1';
  const previousHandle=window.handleSearch;
  let timer=0;
  let xhr=null;
  let seq=0;

  function isSeries(item){
    return !!(item && (item._isSeries || item.type==='series' || item.type==='tv' || item.seasons));
  }

  function syncInputs(value){
    for(const id of ['searchInputDesktop','searchInputMobile']){
      const el=document.getElementById(id);
      if(el && el.value!==value)el.value=value;
    }
  }

  function showDesktopSearch(){
    try{ currentTab='search'; }catch(_){ }
    for(const id of ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','downloadsSection','liveSection','mobileMp4Section']){
      const el=document.getElementById(id);
      if(el)el.style.display='none';
    }
    const section=document.getElementById('searchSection');
    if(section)section.style.display='block';
  }

  function targetNodes(){
    const mobile=!!document.getElementById('searchOverlay')?.classList.contains('open');
    return {
      mobile,
      grid:document.getElementById(mobile?'mobileSearchGrid':'searchGrid'),
      label:document.getElementById(mobile?'mobileSearchLabel':'searchLabel')
    };
  }

  function displayable(item){
    if(!item)return false;
    if(item.streamUrl || item.hasStream===true || item.streamAvailable===true)return true;
    try{return typeof isPlayableMediaItem!=='function' || isPlayableMediaItem(item);}catch(_){return true;}
  }

  function render(items,query){
    const {grid,label}=targetNodes();
    if(!grid)return;
    const visible=(Array.isArray(items)?items:[]).filter(displayable);
    if(!visible.length){
      grid.innerHTML='<div class="empty"><h2>Nothing found</h2><p>Try another spelling or fewer words.</p></div>';
      if(label)label.textContent=`No results for "${query}"`;
      return;
    }
    const html=visible.map(item=>{
      try{return isSeries(item)?sCardHTML(item):cardHTML(item);}catch(err){console.warn('[Direct Search] card render failed',err);return '';}
    }).join('');
    grid.innerHTML=html;
    if(label)label.textContent=`${visible.length.toLocaleString()} result${visible.length===1?'':'s'} for "${query}"`;
    try{ if(typeof svQueuePosterImages==='function')svQueuePosterImages(grid); }catch(_){ }
  }

  function request(query){
    const my=++seq;
    try{xhr?.abort();}catch(_){ }
    const {label}=targetNodes();
    if(label)label.textContent=`Searching for "${query}"`;

    const params=new URLSearchParams({
      q:query,
      kind:'mixed',
      page:'1',
      limit:'100',
      massive:'1',
      background:'1',
      direct:'1',
      v:VERSION,
      _:String(Date.now())
    });

    xhr=new XMLHttpRequest();
    xhr.open('GET',`${BACKEND}/api/search?${params.toString()}`,true);
    xhr.timeout=12000;
    xhr.onload=function(){
      if(my!==seq)return;
      if(xhr.status<200 || xhr.status>=300){
        render([],query);
        return;
      }
      try{
        const data=JSON.parse(xhr.responseText||'{}');
        render(Array.isArray(data.items)?data.items:[],query);
      }catch(err){
        console.error('[Direct Search] invalid response',err);
        render([],query);
      }
    };
    xhr.onerror=function(){ if(my===seq)render([],query); };
    xhr.ontimeout=function(){ if(my===seq)render([],query); };
    xhr.send();
  }

  window.handleSearch=function(q){
    const value=String(q||'');
    syncInputs(value);
    clearTimeout(timer);
    try{xhr?.abort();}catch(_){ }
    seq++;

    if(!value.trim()){
      try{previousHandle?.('');}catch(_){ }
      return;
    }

    if(!document.getElementById('searchOverlay')?.classList.contains('open'))showDesktopSearch();
    timer=setTimeout(()=>request(value.trim()),120);
  };

  const previousRenderSearchPage=window.renderSearchPage;
  window.renderSearchPage=function(q=''){
    const value=String(q||'');
    syncInputs(value);
    if(!value.trim()){
      try{return previousRenderSearchPage?.('');}catch(_){return;}
    }
    showDesktopSearch();
    request(value.trim());
  };

  window.__SV_DIRECT_SEARCH_HOTFIX_20260817=true;
})();
