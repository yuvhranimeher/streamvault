/* StreamVault Search Authority v2
 * One browser controller -> one backend /api/search route.
 * Loaded after legacy search assets and intercepts search input at window-capture
 * so older document-level search handlers cannot race or erase valid results.
 */
(function(){
  'use strict';

  const VERSION='20260819-search-authority-v2';
  const DESKTOP_LIMIT=72;
  const MOBILE_LIMIT=36;
  const DEBOUNCE_MS=90;
  const CACHE_MS=120000;
  const SEARCH_IDS=new Set(['searchInputDesktop','searchInputMobile']);
  const cache=new Map();

  let timer=0;
  let controller=null;
  let sequence=0;
  let activeQuery='';
  let activePage=1;
  let activePages=0;
  let activeMobile=false;
  let loading=false;

  function backendBase(){
    return String(window.API_BASE || window.STREAMVAULT_CONFIG?.backendOrigin || '').replace(/\/$/,'');
  }
  function api(path){return `${backendBase()}${path}`;}
  function isSeries(item){return !!(item && (item._isSeries || item.type==='series' || item.type==='tv' || item.seasons));}
  function normalizeItem(item){
    if(!item || typeof item!=='object')return item;
    try{return window.StreamVaultConfig?.normalizeBackendUrls?.(item) ?? item;}catch(_){return item;}
  }
  function inputs(){return [...SEARCH_IDS].map(id=>document.getElementById(id)).filter(Boolean);}
  function syncInputs(value,source=null){
    for(const input of inputs())if(input!==source && input.value!==value)input.value=value;
    for(const input of inputs()){
      const wrap=input.closest('.search-box,.search-overlay-box');
      const has=!!String(input.value||'').trim();
      wrap?.classList.toggle('has-query',has);
      const clear=wrap?.querySelector('.search-clear-btn');
      if(clear){clear.setAttribute('aria-hidden',has?'false':'true');clear.tabIndex=has?0:-1;}
    }
  }
  function mobileTarget(source=null){
    return source?.id==='searchInputMobile' || !!document.getElementById('searchOverlay')?.classList.contains('open');
  }
  function target(mobile=activeMobile){
    return {
      grid:document.getElementById(mobile?'mobileSearchGrid':'searchGrid'),
      label:document.getElementById(mobile?'mobileSearchLabel':'searchLabel')
    };
  }
  function showSearchView(){
    try{currentTab='search';}catch(_){}
    for(const id of ['mainSection','hero','discoverIntro','seriesSection','moviesSection','librarySection','downloadsSection','liveSection','mobileMp4Section']){
      const el=document.getElementById(id);if(el)el.style.display='none';
    }
    const section=document.getElementById('sectionSection');if(section)section.classList.remove('open');
    const search=document.getElementById('searchSection');if(search)search.style.display='block';
    for(const id of ['bnDiscover','bnShows','bnMovies','bnLibrary','bnDownloads','bnSearch'])document.getElementById(id)?.classList.remove('active');
    document.getElementById('bnSearch')?.classList.add('active');
    document.getElementById('downloadNavBtn')?.classList.remove('active');
  }
  function cardHtml(item){
    try{return isSeries(item)?sCardHTML(item):cardHTML(item);}catch(error){console.warn('[Search Authority] card render failed',error);return '';}
  }
  function dedupe(items){
    const out=[];const seen=new Set();
    for(const raw of Array.isArray(items)?items:[]){
      const item=normalizeItem(raw);if(!item)continue;
      const kind=isSeries(item)?'s':'m';
      const key=`${kind}|${String(item.streamUrl||item.id||'').toLowerCase()}|${String(item.name||item.title||'').toLowerCase()}|${item.year||''}`;
      if(seen.has(key))continue;seen.add(key);out.push(item);
    }
    return out;
  }
  function renderItems(items,query,append=false,mobile=activeMobile){
    const {grid,label}=target(mobile);if(!grid)return;
    const list=dedupe(items);
    const html=list.map(cardHtml).join('');
    if(!append)grid.innerHTML=html;
    else grid.insertAdjacentHTML('beforeend',html);
    if(label)label.textContent=`${Number(window.__SV_SEARCH_LAST_TOTAL||list.length).toLocaleString()} result${Number(window.__SV_SEARCH_LAST_TOTAL||list.length)===1?'':'s'} for “${query}”`;
    try{if(typeof svQueuePosterImages==='function')svQueuePosterImages(grid);}catch(_){}
  }
  function renderEmpty(query,mobile=activeMobile){
    const {grid,label}=target(mobile);if(!grid)return;
    grid.innerHTML='<div class="empty"><h2>Nothing found</h2><p>Try another spelling or fewer words.</p></div>';
    if(label)label.textContent=`No results for “${query}”`;
  }
  function renderError(query,mobile=activeMobile){
    const {grid,label}=target(mobile);if(!grid)return;
    grid.innerHTML='<div class="empty"><h2>Search temporarily unavailable</h2><p>StreamVault will retry on your next keystroke.</p></div>';
    if(label)label.textContent=`Could not complete search for “${query}”`;
  }
  function cacheKey(query,page,limit){return `${query.toLowerCase()}|${page}|${limit}`;}
  async function fetchPage(query,page,mobile,signal){
    const limit=mobile?MOBILE_LIMIT:DESKTOP_LIMIT;
    const key=cacheKey(query,page,limit);
    const hit=cache.get(key);
    if(hit && Date.now()-hit.at<CACHE_MS)return hit.data;
    const params=new URLSearchParams({q:query,kind:'mixed',page:String(page),limit:String(limit),massive:'1',authority:'1'});
    const url=api(`/api/search?${params}`);
    let lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'},signal});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const data=await response.json();
        cache.set(key,{at:Date.now(),data});
        if(cache.size>100)cache.delete(cache.keys().next().value);
        return data;
      }catch(error){
        if(error?.name==='AbortError')throw error;
        lastError=error;
        if(attempt===0)await new Promise(resolve=>setTimeout(resolve,300));
      }
    }
    throw lastError || new Error('search failed');
  }
  async function execute(query,page=1,mobile=activeMobile,append=false){
    const my=++sequence;
    try{controller?.abort();}catch(_){}
    controller=new AbortController();
    loading=true;
    const {label}=target(mobile);if(label && !append)label.textContent=`Searching everywhere for “${query}”…`;
    try{
      const data=await fetchPage(query,page,mobile,controller.signal);
      if(my!==sequence || query!==activeQuery)return;
      const items=Array.isArray(data?.items)?data.items:[];
      activePage=Number(data?.page)||page;
      activePages=Number(data?.pages)||0;
      window.__SV_SEARCH_LAST_TOTAL=Number(data?.total)||items.length;
      window.__SV_SEARCH_LAST_RESPONSE=data;
      if(!items.length && page===1)renderEmpty(query,mobile);
      else renderItems(items,query,append,mobile);
    }catch(error){
      if(error?.name==='AbortError' || my!==sequence)return;
      console.error('[Search Authority] request failed',error);
      if(page===1)renderError(query,mobile);
    }finally{
      if(my===sequence)loading=false;
    }
  }
  function run(value,source=null){
    const query=String(value||'');
    const mobile=mobileTarget(source);
    syncInputs(query,source);
    clearTimeout(timer);
    try{controller?.abort();}catch(_){}
    sequence++;
    activeQuery=query.trim();
    activePage=1;activePages=0;activeMobile=mobile;
    if(!activeQuery){
      const {grid,label}=target(mobile);
      if(grid)grid.innerHTML='<div class="empty"><h2>Search your vault</h2><p>Movies and shows will appear here.</p></div>';
      if(label)label.textContent='Start typing to search your vault';
      return;
    }
    if(!mobile)showSearchView();
    timer=setTimeout(()=>execute(activeQuery,1,mobile,false),DEBOUNCE_MS);
  }
  async function loadMore(){
    if(loading || !activeQuery || activePage>=activePages)return;
    await execute(activeQuery,activePage+1,activeMobile,true);
  }
  function clear(){
    clearTimeout(timer);try{controller?.abort();}catch(_){}
    sequence++;activeQuery='';activePage=1;activePages=0;window.__SV_SEARCH_LAST_TOTAL=0;
    syncInputs('');
    const {grid,label}=target(activeMobile);
    if(grid)grid.innerHTML='<div class="empty"><h2>Search your vault</h2><p>Movies and shows will appear here.</p></div>';
    if(label)label.textContent='Start typing to search your vault';
    inputs()[0]?.focus?.();
  }

  // Window capture executes before the old document-capture listener. This makes
  // this controller the only search handler even while legacy assets remain cached.
  window.addEventListener('input',event=>{
    if(!SEARCH_IDS.has(event.target?.id))return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    run(event.target.value,event.target);
  },true);

  window.addEventListener('scroll',()=>{
    if(!activeMobile && activeQuery && !loading && activePage<activePages && innerHeight+scrollY>=document.documentElement.scrollHeight-900)loadMore();
  },{passive:true});

  function bindMobileScroll(){
    document.querySelector('.search-overlay-results')?.addEventListener('scroll',event=>{
      const el=event.currentTarget;
      if(activeMobile && activeQuery && !loading && activePage<activePages && el.scrollTop+el.clientHeight>=el.scrollHeight-500)loadMore();
    },{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindMobileScroll,{once:true});else bindMobileScroll();

  window.handleSearch=(value)=>run(value,document.activeElement);
  window.renderSearchPage=(value='')=>{showSearchView();run(value,document.getElementById('searchInputDesktop'));};
  window.clearGlobalSearch=clear;
  window.loadMoreSearchResults=loadMore;
  window.__SV_SEARCH_AUTHORITY_VERSION=VERSION;
  window.__SV_SEARCH_AUTHORITY_ACTIVE=true;
})();
