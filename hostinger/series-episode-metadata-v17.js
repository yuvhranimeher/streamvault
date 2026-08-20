/* SV_SERIES_EPISODE_METADATA_V17 — instant catalog episodes + authoritative episode names/stills */
(function(){
  'use strict';
  if(window.__SV_SERIES_EPISODE_METADATA_V17)return;
  window.__SV_SERIES_EPISODE_METADATA_V17=true;

  const META_STORE='sv_episode_metadata_v17';
  const META_TTL=7*24*60*60*1000;
  const pending=new Map();
  const memory=new Map();
  let timer=0;

  try{
    if(localStorage.getItem('sv_episode_v17_migrated')!=='1'){
      localStorage.removeItem('sv_episode_cache_v16');
      localStorage.setItem('sv_episode_v17_migrated','1');
    }
  }catch(_){}

  function modalVisible(){
    const el=document.getElementById('mediaModal');
    if(!el||el.classList.contains('hidden'))return false;
    try{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden';}catch(_){return true;}
  }
  function current(){
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
  function cleanSeriesTitle(value){
    return decodeDeep(value)
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
  function yearOf(show){return String(show?.year||show?.name||show?.title||'').match(/(?:19|20)\d{2}/)?.[0]||'';}
  function seasons(show){
    const src=show?.seasons||{};const out={};
    Object.entries(src).forEach(([k,v])=>{const eps=Array.isArray(v)?v:(Array.isArray(v?.episodes)?v.episodes:[]);if(eps.length)out[String(Number(k)||k)]=eps;});
    return out;
  }
  function generic(value,number){
    const text=String(value||'').trim();
    return !text||/^(?:episode|ep)\s*0*\d+$/i.test(text)||/^s\d{1,2}e\d{1,3}$/i.test(text)||text===String(number);
  }
  function unsafeTitle(value){
    const text=String(value||'');
    return /%[0-9a-f]{2}/i.test(text)||/^https?:\/\//i.test(text)||text.length>150||/[\\/]DHAKA-FLIX/i.test(decodeDeep(text));
  }
  function safeExisting(ep,index){
    const number=Number(ep?.episode||ep?.number||index+1)||index+1;
    for(const value of [ep?.displayTitle,ep?.epTitle,ep?.title,ep?.name]){
      const text=String(value||'').trim();
      if(text&&!generic(text,number)&&!unsafeTitle(text))return text;
    }
    return `Episode ${number}`;
  }
  function sanitize(show){
    Object.entries(seasons(show)).forEach(([season,eps])=>eps.forEach((ep,index)=>{
      const number=Number(ep?.episode||ep?.number||index+1)||index+1;
      const title=safeExisting(ep,index);
      ep.episode=number;ep.season=Number(ep?.season||season)||Number(season)||1;
      ep.displayTitle=title;ep.epTitle=title;ep.title=title;ep.name=title;
    }));
  }
  function readStore(){try{return JSON.parse(localStorage.getItem(META_STORE)||'{}')||{};}catch(_){return {};}}
  function stored(key){
    const e=readStore()[key];
    return e&&Date.now()-Number(e.at||0)<META_TTL&&e.data?e.data:null;
  }
  function save(key,data){
    try{
      const s=readStore();s[key]={at:Date.now(),data};
      const keys=Object.keys(s).sort((a,b)=>Number(s[b]?.at||0)-Number(s[a]?.at||0));
      keys.slice(30).forEach(k=>delete s[k]);localStorage.setItem(META_STORE,JSON.stringify(s));
    }catch(_){}
  }
  function keyFor(show){
    const title=cleanSeriesTitle(show?.name||show?.title||'');
    const year=yearOf(show);
    const seasonList=Object.keys(seasons(show)).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    return {title,year,seasonList,key:`${title.toLowerCase()}|${year}|${seasonList.join(',')}`};
  }
  function applyMetadata(show,data){
    if(!show||!data?.seasons)return false;
    const local=seasons(show);let changed=false;
    Object.entries(data.seasons).forEach(([season,metadata])=>{
      const eps=local[String(season)]||[];
      if(!Array.isArray(metadata)||!eps.length)return;
      const byNo=new Map(metadata.map(m=>[Number(m?.episode),m]));
      eps.forEach((ep,index)=>{
        const number=Number(ep?.episode||ep?.number||index+1)||index+1;
        const meta=byNo.get(number);if(!meta)return;
        const title=String(meta.title||'').trim();
        if(title){ep.displayTitle=title;ep.epTitle=title;ep.title=title;ep.name=title;changed=true;}
        if(meta.still){ep.thumb=meta.still;ep.thumbnail=meta.still;}
        if(meta.overview&&!ep.overview)ep.overview=meta.overview;
        if(meta.runtime&&!ep.runtime)ep.runtime=meta.runtime;
      });
    });
    if(changed)renderCurrent(show);
    return changed;
  }
  function renderCurrent(show){
    const root=document.getElementById('modalEpisodes');if(!root)return;
    let season=Number(root.querySelector('select')?.value||1)||1;
    const eps=seasons(show)[String(season)]||[];
    const cards=[...root.querySelectorAll('.media-modal-episode')];
    eps.forEach((ep,index)=>{
      const title=safeExisting(ep,index);
      const node=cards[index]?.querySelector('.media-modal-episode-title');
      if(node)node.textContent=title;
      const img=cards[index]?.querySelector('img');
      const still=ep?.thumb||ep?.thumbnail||'';
      if(img&&still&&img.src!==still)img.src=still;
    });
  }
  async function fetchMetadata(show){
    const info=keyFor(show);if(!info.title||!info.seasonList.length)return null;
    if(memory.has(info.key)){applyMetadata(show,memory.get(info.key));return memory.get(info.key);}
    const cached=stored(info.key);
    if(cached){memory.set(info.key,cached);applyMetadata(show,cached);return cached;}
    if(pending.has(info.key))return pending.get(info.key);
    const task=(async()=>{
      const params=new URLSearchParams({title:info.title,seasons:info.seasonList.join(',')});
      if(info.year)params.set('year',info.year);
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);
      try{
        const response=await fetch('/series-episode-metadata.php?'+params.toString(),{cache:'default',signal:controller.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error('metadata HTTP '+response.status);
        const data=await response.json();
        if(!data?.seasons)throw new Error('metadata empty');
        memory.set(info.key,data);save(info.key,data);
        if(current()===show||modalVisible())applyMetadata(show,data);
        return data;
      }finally{clearTimeout(timeout);pending.delete(info.key);}
    })();
    pending.set(info.key,task);task.catch(()=>{});return task;
  }
  function run(){
    if(!modalVisible())return;
    const show=current();if(!show)return;
    const ss=seasons(show);if(!Object.keys(ss).length)return;
    sanitize(show);renderCurrent(show);void fetchMetadata(show);
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(run,30);}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  setInterval(run,700);
  try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});}catch(_){}
})();
