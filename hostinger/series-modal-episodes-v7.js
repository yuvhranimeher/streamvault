/* SV_MEDIA_EPISODES_V15 — DOM-level direct episode authority */
(function(){
  'use strict';
  if(window.__svMediaEpisodesV15)return;
  window.__svMediaEpisodesV15=true;
  window.__svMediaEpisodesV14=true;
  window.__svMediaEpisodesV13=true;
  window.__svMediaEpisodesV12=true;
  window.__SV_SERIES_EPISODES_VERSION='20260820-series-episodes-v15-dom-direct';

  const cache=new Map();
  let requestKey='';
  let requestPromise=null;
  let lastPayload=null;
  let lastPayloadKey='';
  let observerTimer=0;

  function modal(){return document.getElementById('mediaModal');}
  function modalVisible(){
    const el=modal();
    if(!el||el.classList.contains('hidden'))return false;
    try{
      const style=getComputedStyle(el);
      if(style.display==='none'||style.visibility==='hidden')return false;
    }catch(_){}
    return true;
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
  function yearFrom(value){return String(value||'').match(/(?:19|20)\d{2}/)?.[0]||'';}

  function runtimeItem(){
    try{if(typeof currentMediaModalItem!=='undefined'&&currentMediaModalItem)return currentMediaModalItem;}catch(_){}
    try{if(typeof currentShow!=='undefined'&&currentShow)return currentShow;}catch(_){}
    return null;
  }

  function domTitle(){
    const el=modal();if(!el)return '';
    const nodes=[...el.querySelectorAll('h1,h2,h3,.media-modal-title,.modal-title,[class*="title"]')];
    const texts=nodes.map(node=>String(node.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
    const about=texts.find(text=>/^About\s+/i.test(text));
    if(about)return about.replace(/^About\s+/i,'').trim();
    const series=texts.find(text=>/\b(?:TV\s+(?:Mini\s+)?Series|Web\s+Series|Series)\b/i.test(text)&&!/^Episodes$/i.test(text));
    if(series)return series;
    return texts.find(text=>text.length>1&&!/^(?:Details|Episodes|About|More Like This)$/i.test(text))||'';
  }

  function titleInfo(){
    const item=runtimeItem();
    let raw='';
    try{raw=String(item?.name||item?.title||'').trim();}catch(_){}
    if(!raw)raw=domTitle();
    const clean=cleanTitle(raw)||raw;
    const year=yearFrom(item?.year)||yearFrom(raw)||yearFrom(domTitle());
    return {item,raw,clean,year,key:`${norm(clean)}|${year}`};
  }

  function looksLikeSeries(info){
    try{
      const type=String(info?.item?.type||info?.item?.mediaType||'').toLowerCase();
      if(['tv','series','show'].includes(type))return true;
      if(info?.item?.seasons)return true;
      if(typeof currentMediaModalType!=='undefined'&&['tv','series','show'].includes(String(currentMediaModalType).toLowerCase()))return true;
    }catch(_){}
    const text=`${info?.raw||''} ${modal()?.textContent||''}`;
    return /\b(?:TV\s+(?:Mini\s+)?Series|Web\s+Series|Type\s*Series)\b/i.test(text);
  }

  function seasonsObject(show){
    const source=show?.seasons||{};
    const out={};
    if(Array.isArray(source)){
      source.forEach((season,index)=>{
        const n=Number(season?.season??season?.seasonNumber??season?.number??index+1)||index+1;
        const eps=Array.isArray(season?.episodes)?season.episodes:(Array.isArray(season)?season:[]);
        if(eps.length)out[n]=eps;
      });
      return out;
    }
    Object.entries(source).forEach(([key,value])=>{
      const eps=Array.isArray(value)?value:(Array.isArray(value?.episodes)?value.episodes:[]);
      if(eps.length)out[Number(key)||key]=eps;
    });
    return out;
  }
  function episodeCount(show){return Object.values(seasonsObject(show)).reduce((sum,eps)=>sum+(Array.isArray(eps)?eps.length:0),0);}
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

  async function fetchDirect(info){
    const titles=[...new Set([info.clean,info.raw].filter(Boolean))];
    for(const title of titles){
      const params=new URLSearchParams({title,_:String(Date.now())});
      if(info.year)params.set('year',info.year);
      try{
        const response=await fetch('/series-episodes-direct.php?'+params.toString(),{
          cache:'no-store',headers:{Accept:'application/json'}
        });
        if(response.ok){
          const show=await response.json();
          if(episodeCount(show)>0)return show;
        }
      }catch(_){}
    }
    for(const title of titles){
      const params=new URLSearchParams({title,_:String(Date.now())});
      if(info.year)params.set('year',info.year);
      try{
        const path='/api/series/episodes-direct?'+params.toString();
        const fn=window.StreamVaultConfig?.fetchWithTimeout;
        const response=fn
          ? await fn(path,{cache:'no-store',headers:{Accept:'application/json'}},10000)
          : await fetch(path,{cache:'no-store',headers:{Accept:'application/json'}});
        if(response?.ok){
          const show=await response.json();
          if(episodeCount(show)>0)return show;
        }
      }catch(_){}
    }
    return null;
  }

  function normalizedShow(show){
    const seasons=seasonsObject(show);
    return {...show,seasons,isSummary:false,streamAvailable:true,hasStream:true};
  }

  function writeRuntime(show){
    try{currentShow=show;}catch(_){}
    try{
      if(typeof currentMediaModalItem!=='undefined'&&currentMediaModalItem&&typeof currentMediaModalItem==='object')Object.assign(currentMediaModalItem,show);
    }catch(_){}
    try{currentMediaModalType='tv';}catch(_){}
    try{
      if(typeof currentSeason!=='undefined'){
        const available=Object.keys(show.seasons||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
        if(available.length&&!available.includes(Number(currentSeason)))currentSeason=available[0];
      }
    }catch(_){}
  }

  function repairDetails(show){
    const count=Object.keys(show?.seasons||{}).length;
    if(!count)return;
    const el=modal();if(!el)return;
    const candidates=[...el.querySelectorAll('*')];
    for(const node of candidates){
      if(String(node.textContent||'').trim().toUpperCase()!=='RUNTIME')continue;
      const card=node.closest('[class*="detail"], [class*="meta"], div');
      if(!card)continue;
      const values=[...card.querySelectorAll('*')].filter(x=>x!==node&&/^(?:0|\d+)\s+seasons?$/i.test(String(x.textContent||'').trim()));
      if(values[0])values[0].textContent=`${count} season${count===1?'':'s'}`;
      break;
    }
  }

  function renderDirect(show,selectedSeason){
    const root=document.getElementById('modalEpisodes');if(!root)return false;
    const seasons=Object.keys(show.seasons||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    if(!seasons.length)return false;
    const season=seasons.includes(Number(selectedSeason))?Number(selectedSeason):seasons[0];
    const episodes=show.seasons[season]||[];
    const options=seasons.map(n=>`<option value="${n}"${n===season?' selected':''}>Season ${n}</option>`).join('');
    const fallback=String(show.backdrop||show.poster||'');
    const cards=episodes.map((episode,index)=>{
      const number=episode?.episode||episode?.number||index+1;
      const title=episode?.epTitle||episode?.title||episode?.name||`Episode ${number}`;
      const image=episode?.thumb||episode?.thumbnail||episode?.poster||fallback;
      return `<button class="media-modal-episode" type="button" data-episode-index="${index}" onclick="window.__svEpisodesV15Play(${season},${index})">${image?`<img src="${esc(image)}" alt="" loading="lazy">`:''}<span class="media-modal-episode-copy"><span class="media-modal-episode-number">Episode ${esc(number)}</span><span class="media-modal-episode-title">${esc(title)}</span></span></button>`;
    }).join('');
    root.className='media-modal-section';
    root.style.display='';
    root.dataset.svEpisodeAuthority='v15';
    root.innerHTML=`<h2 class="media-modal-heading">Episodes</h2><div class="media-modal-season-row"><select aria-label="Season" onchange="window.__svEpisodesV15Season(this.value)">${options}</select></div><div class="media-modal-episodes">${cards}</div>`;
    return true;
  }

  function apply(show,key){
    const normalized=normalizedShow(show);
    if(!episodeCount(normalized))return false;
    lastPayload=normalized;
    lastPayloadKey=key||lastPayloadKey;
    writeRuntime(normalized);
    let rendered=false;
    try{
      if(typeof renderMediaModalEpisodes==='function'){
        renderMediaModalEpisodes(normalized);
        rendered=!!document.querySelector('#modalEpisodes .media-modal-episode');
      }
    }catch(_){}
    if(!rendered)renderDirect(normalized);
    const root=document.getElementById('modalEpisodes');
    if(root){root.style.display='';root.classList.add('media-modal-section');root.dataset.svEpisodeAuthority='v15';}
    repairDetails(normalized);
    return true;
  }

  window.__svEpisodesV15Season=function(value){
    if(!lastPayload)return;
    try{currentSeason=Number(value);}catch(_){}
    try{
      if(typeof renderMediaModalEpisodes==='function'){
        renderMediaModalEpisodes(lastPayload,Number(value));
        const root=document.getElementById('modalEpisodes');if(root){root.style.display='';root.dataset.svEpisodeAuthority='v15';}
        return;
      }
    }catch(_){}
    renderDirect(lastPayload,Number(value));
  };

  window.__svEpisodesV15Play=function(season,index){
    if(!lastPayload)return;
    writeRuntime(lastPayload);
    try{currentSeason=Number(season);}catch(_){}
    try{
      if(typeof playMediaModalEpisode==='function')return playMediaModalEpisode(Number(season),Number(index));
    }catch(_){}
    const episode=lastPayload?.seasons?.[Number(season)]?.[Number(index)];
    const url=episode?.streamUrl||episode?.url||'';
    if(url)window.open(url,'_blank','noopener');
  };

  function showLoading(){
    const root=document.getElementById('modalEpisodes');if(!root)return;
    root.className='media-modal-section';root.style.display='';root.dataset.svEpisodeAuthority='v15-loading';
    root.innerHTML='<h2 class="media-modal-heading">Episodes</h2><div class="no-data">Loading episodes…</div>';
  }

  async function tick(){
    if(!modalVisible())return;
    const info=titleInfo();
    if(!info.clean||!looksLikeSeries(info))return;
    const root=document.getElementById('modalEpisodes');
    if(lastPayload&&lastPayloadKey===info.key){
      if(!root||root.style.display==='none'||!root.querySelector('.media-modal-episode'))apply(lastPayload,info.key);
      return;
    }
    if(cache.has(info.key)){
      apply(cache.get(info.key),info.key);
      return;
    }
    if(requestPromise&&requestKey===info.key)return;
    requestKey=info.key;
    showLoading();
    requestPromise=(async()=>{
      try{
        const show=await fetchDirect(info);
        if(!show||!episodeCount(show))return;
        cache.set(info.key,show);
        if(modalVisible()&&titleInfo().key===info.key)apply(show,info.key);
      }catch(_){}
      finally{requestPromise=null;}
    })();
    return requestPromise;
  }

  function scheduleTick(){
    clearTimeout(observerTimer);
    observerTimer=setTimeout(()=>{void tick();},40);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleTick,{once:true});
  else scheduleTick();
  setInterval(()=>{void tick();},400);
  try{
    new MutationObserver(scheduleTick).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-hidden']});
  }catch(_){}
  window.addEventListener('streamvault:backend-online',scheduleTick);
})();
