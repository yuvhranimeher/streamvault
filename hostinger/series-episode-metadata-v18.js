/* SV_SERIES_EPISODE_METADATA_V18 — current-season metadata authority, DOM-first */
(function(){
  'use strict';
  if(window.__SV_SERIES_EPISODE_METADATA_V18)return;
  window.__SV_SERIES_EPISODE_METADATA_V18=true;

  const STORE_KEY='sv_episode_metadata_v18';
  const STORE_TTL=7*24*60*60*1000;
  const memory=new Map();
  const pending=new Map();
  let timer=0;

  function modal(){return document.getElementById('mediaModal');}
  function visible(){
    const el=modal();
    if(!el||el.classList.contains('hidden'))return false;
    try{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden';}catch(_){return true;}
  }
  function runtimeShow(){
    try{if(typeof currentShow!=='undefined'&&currentShow)return currentShow;}catch(_){}
    try{if(typeof currentMediaModalItem!=='undefined'&&currentMediaModalItem)return currentMediaModalItem;}catch(_){}
    return null;
  }
  function decodeDeep(value){
    let text=String(value||'').trim();
    for(let i=0;i<4&&/%[0-9a-f]{2}/i.test(text);i++){
      try{const next=decodeURIComponent(text);if(next===text)break;text=next;}catch(_){break;}
    }
    return text.replace(/\+/g,' ');
  }
  function cleanTitle(value){
    return decodeDeep(value)
      .replace(/^\s*about\s+/i,'')
      .replace(/\[[^\]]*]/g,' ')
      .replace(/\([^)]*(?:tv|web|series|mini)[^)]*\)/gi,' ')
      .replace(/\b(?:tv\s+mini\s+series|tv\s+series|web\s+series|mini\s+series|series)\b/gi,' ')
      .replace(/\b(?:2160p|1080p|720p|480p|4k|uhd|hdr|dual\s+audio|multi\s+audio)\b/gi,' ')
      .replace(/\b(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2})?\b/g,' ')
      .replace(/\b(?:19|20)\d{2}\b/g,' ')
      .replace(/[._]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function yearFrom(value){return String(value||'').match(/(?:19|20)\d{2}/)?.[0]||'';}
  function identity(){
    const show=runtimeShow();
    const root=modal();
    let raw=String(show?.name||show?.title||'').trim();
    if(!raw&&root){
      const about=[...root.querySelectorAll('h1,h2,h3,[class*="title"]')].map(n=>String(n.textContent||'').trim()).find(t=>/^About\s+/i.test(t));
      if(about)raw=about.replace(/^About\s+/i,'').trim();
    }
    const title=cleanTitle(raw)||raw;
    const year=yearFrom(show?.year)||yearFrom(raw)||yearFrom(root?.textContent||'');
    return {show,title,year};
  }
  function season(){
    const root=document.getElementById('modalEpisodes');
    const selected=Number(root?.querySelector('select')?.value||0);
    if(selected)return selected;
    try{if(typeof currentSeason!=='undefined'&&Number(currentSeason))return Number(currentSeason);}catch(_){}
    return 1;
  }
  function readStore(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{};}catch(_){return {};}}
  function getStored(key){
    const e=readStore()[key];
    return e&&Date.now()-Number(e.at||0)<STORE_TTL&&e.data?e.data:null;
  }
  function putStored(key,data){
    try{
      const s=readStore();s[key]={at:Date.now(),data};
      const keys=Object.keys(s).sort((a,b)=>Number(s[b]?.at||0)-Number(s[a]?.at||0));
      keys.slice(80).forEach(k=>delete s[k]);
      localStorage.setItem(STORE_KEY,JSON.stringify(s));
    }catch(_){}
  }
  function keyFor(title,year,seasonNo){return `${String(title).toLowerCase()}|${year}|${seasonNo}`;}

  function applyRuntime(show,seasonNo,list){
    if(!show||!show.seasons||!Array.isArray(list))return;
    const eps=show.seasons?.[seasonNo]||show.seasons?.[String(seasonNo)]||show.seasons?.[seasonNo]?.episodes||show.seasons?.[String(seasonNo)]?.episodes||[];
    if(!Array.isArray(eps))return;
    const byNo=new Map(list.map(x=>[Number(x?.episode),x]));
    eps.forEach((ep,index)=>{
      const number=Number(ep?.episode||ep?.number||index+1)||index+1;
      const meta=byNo.get(number);if(!meta)return;
      const title=String(meta?.title||'').trim();
      if(title){ep.displayTitle=title;ep.epTitle=title;ep.title=title;ep.name=title;}
      if(meta?.still){ep.thumb=meta.still;ep.thumbnail=meta.still;}
      if(meta?.overview&&!ep.overview)ep.overview=meta.overview;
      if(meta?.runtime&&!ep.runtime)ep.runtime=meta.runtime;
    });
  }
  function applyDom(seasonNo,list){
    const root=document.getElementById('modalEpisodes');
    if(!root||!Array.isArray(list)||!list.length)return;
    const selected=Number(root.querySelector('select')?.value||seasonNo)||seasonNo;
    if(selected!==Number(seasonNo))return;
    const byNo=new Map(list.map(x=>[Number(x?.episode),x]));
    const cards=[...root.querySelectorAll('.media-modal-episode')];
    cards.forEach((card,index)=>{
      const numberText=String(card.querySelector('.media-modal-episode-number')?.textContent||'');
      const number=Number(numberText.match(/\d+/)?.[0]||index+1)||index+1;
      const meta=byNo.get(number);if(!meta)return;
      const title=String(meta?.title||'').trim();
      const titleNode=card.querySelector('.media-modal-episode-title');
      if(titleNode&&title)titleNode.textContent=title;
      const img=card.querySelector('img');
      if(img&&meta?.still){
        const expected=String(meta.still);
        if(img.getAttribute('src')!==expected){img.src=expected;img.setAttribute('data-sv-src',expected);}
      }
    });
  }
  function apply(data,show,seasonNo){
    const list=data?.seasons?.[String(seasonNo)]||data?.seasons?.[seasonNo]||[];
    if(!Array.isArray(list)||!list.length)return false;
    applyRuntime(show,seasonNo,list);
    applyDom(seasonNo,list);
    return true;
  }

  async function parse(response){
    if(!response?.ok)throw new Error(`HTTP ${response?.status||0}`);
    const data=await response.json();
    if(!data?.seasons)throw new Error('metadata empty');
    return data;
  }
  async function fetchMeta(title,year,seasonNo){
    const params=new URLSearchParams({title,seasons:String(seasonNo)});
    if(year)params.set('year',year);
    const query=params.toString();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),6500);
    const jobs=[];
    jobs.push(fetch('/series-episode-metadata.php?'+query,{cache:'default',signal:controller.signal,headers:{Accept:'application/json'}}).then(parse));
    jobs.push((async()=>{
      const path='/api/series/episode-metadata?'+query;
      const fn=window.StreamVaultConfig?.fetchWithTimeout;
      const response=fn
        ? await fn(path,{cache:'default',signal:controller.signal,headers:{Accept:'application/json'}},6000)
        : await fetch(path,{cache:'default',signal:controller.signal,headers:{Accept:'application/json'}});
      return parse(response);
    })());
    try{
      const data=await Promise.any(jobs);
      controller.abort();
      return data;
    }finally{clearTimeout(timeout);}
  }

  async function run(){
    if(!visible())return;
    const root=document.getElementById('modalEpisodes');
    if(!root||!root.querySelector('.media-modal-episode'))return;
    const {show,title,year}=identity();
    if(!title)return;
    const seasonNo=season();
    const key=keyFor(title,year,seasonNo);
    if(memory.has(key)){apply(memory.get(key),show,seasonNo);return;}
    const stored=getStored(key);
    if(stored){memory.set(key,stored);apply(stored,show,seasonNo);return;}
    if(pending.has(key))return;
    const task=(async()=>{
      try{
        const data=await fetchMeta(title,year,seasonNo);
        memory.set(key,data);putStored(key,data);
        if(visible())apply(data,runtimeShow()||show,seasonNo);
      }catch(_){}finally{pending.delete(key);}
    })();
    pending.set(key,task);
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{void run();},20);}

  document.addEventListener('change',event=>{
    if(event.target?.closest?.('#modalEpisodes')&&event.target?.matches?.('select'))schedule();
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  setInterval(()=>{if(visible())void run();},650);
  try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});}catch(_){}
})();
