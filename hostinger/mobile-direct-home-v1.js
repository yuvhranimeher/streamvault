/* StreamVault mobile direct-play v6 — preserve poster nodes while catalog pages merge */
(function(){
  'use strict';
  if(window.__SV_MOBILE_DIRECT_HOME_V5)return;
  window.__SV_MOBILE_DIRECT_HOME_V5=true;
  window.__SV_MOBILE_DIRECT_HOME_VERSION='20260825-poster-node-reuse-v6';

  const certified=new Map();
  const probe=document.createElement('video');
  let items=[];
  let installedPlayback=false;
  let touchStart=null;
  let openedAt=0;
  let loading=false;

  function mobile(){
    try{if(typeof isMobilePlaybackClient==='function')return !!isMobilePlaybackClient();}catch(_){}
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'')||matchMedia('(max-width:900px)').matches;
  }
  function base(){return String(window.API_BASE||window.STREAMVAULT_CONFIG?.backendOrigin||'').replace(/\/$/,'');}
  function proxy(url){return `${base()}/api/mobile-direct/proxy?url=${encodeURIComponent(String(url||''))}`;}

  function supportsProfile(id){
    if(id==='universal-h264')return !!(probe.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')||probe.canPlayType('video/mp4'));
    if(id==='apple-hevc')return !!(probe.canPlayType('video/mp4; codecs="hvc1"')||probe.canPlayType('video/mp4; codecs="hev1"'));
    if(id==='webm-modern')return !!(probe.canPlayType('video/webm; codecs="vp9, opus"')||probe.canPlayType('video/webm'));
    return false;
  }
  function profiles(item){return Array.isArray(item?.mobileDirectProfiles)&&item.mobileDirectProfiles.length?item.mobileDirectProfiles:[item?.mobileDirectProfile].filter(Boolean);}
  function supported(item){const p=profiles(item);return item?.mobileDirect===true&&p.length>0&&p.every(supportsProfile);}
  function register(item){
    if(!supported(item))return;
    if(item.streamUrl)certified.set(String(item.streamUrl),item.mobileDirectProfile||profiles(item)[0]);
    for(const eps of Object.values(item.seasons||{}))for(const ep of (Array.isArray(eps)?eps:[]))if(ep?.streamUrl)certified.set(String(ep.streamUrl),ep.mobileDirectProfile||profiles(item)[0]);
  }
  function certifiedSource(url){const p=certified.get(String(url||''));return p&&supportsProfile(p);}
  function directPlan(url){const src=proxy(url);return {ok:true,mode:'proxy',src,proxyUrl:src,directUrl:src,mobileDirect:true,transcoding:false,duration:0};}

  function installPlaybackHooks(){
    if(installedPlayback)return;installedPlayback=true;
    const prevFetch=window.fetchFtpPlaybackPlan;
    if(typeof prevFetch==='function')window.fetchFtpPlaybackPlan=async function(url,start=0,options={}){
      const mapped=!!(options?.forceAudio||options?.forceRemux||options?.mode==='audio'||options?.mode==='remux');
      if(mobile()&&certifiedSource(url)&&!mapped)return directPlan(url);
      return prevFetch.apply(this,arguments);
    };
    const prevLocal=window.localFtpPlaybackPlan;
    if(typeof prevLocal==='function')window.localFtpPlaybackPlan=function(url,options={}){
      const mapped=!!(options?.forceAudio||options?.forceRemux||options?.mode==='audio'||options?.mode==='remux');
      if(mobile()&&certifiedSource(url)&&!mapped)return directPlan(url);
      return prevLocal.apply(this,arguments);
    };
    const prevSeek=window.seekToTime;
    if(typeof prevSeek==='function')window.seekToTime=function(seconds){
      let source='';try{if(typeof _ftpStreamUrl!=='undefined')source=String(_ftpStreamUrl||'');}catch(_){}
      if(mobile()&&certifiedSource(source)){
        const video=document.getElementById('videoPlayer');
        if(video){try{video.currentTime=Math.max(0,Number(seconds)||0);if(video.paused&&video._svPlaybackShouldPlay!==false)video.play().catch(()=>{});return;}catch(_){}}
      }
      return prevSeek.apply(this,arguments);
    };
  }

  function titleKey(item){
    return String(item?.name||item?.title||item?.file||'')
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,5}$/i,' ')
      .replace(/\b(?:2160p|1080p|720p|480p|4k|uhd|hdr|webrip|web[-\s]?dl|bluray|brrip|x264|x265|hevc|aac|dual audio|multi audio|hindi|english)\b.*$/ig,' ')
      .replace(/\b(?:19|20)\d{2}\b/g,' ')
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  const franchisePriority=[
    [/avengers|endgame|infinity war|age of ultron/i,1500],
    [/spider[- ]?man|no way home|far from home|homecoming/i,1420],
    [/iron man|captain america|winter soldier|civil war/i,1380],
    [/thor|guardians of the galaxy|black panther|doctor strange/i,1320],
    [/batman|dark knight|joker/i,1280],
    [/superman|man of steel|justice league|wonder woman/i,1230],
    [/harry potter|fantastic beasts/i,1190],
    [/star wars|mandalorian/i,1160],
    [/lord of the rings|hobbit/i,1130],
    [/fast (?:and|&) furious|furious 7|fate of the furious|\bf9\b/i,1090],
    [/jurassic park|jurassic world/i,1060],
    [/mission:? impossible/i,1030],
    [/transformers/i,1000],
    [/john wick/i,970],
    [/pirates of the caribbean/i,940],
    [/james bond|casino royale|skyfall|no time to die/i,910],
    [/matrix/i,880],
    [/avatar/i,850],
    [/terminator/i,820],
    [/top gun/i,790],
    [/indiana jones/i,760],
    [/alien|predator/i,730],
    [/godzilla|king kong|kong/i,700],
    [/bourne/i,670],
    [/rocky|creed/i,640],
    [/deadpool|wolverine|x[- ]?men/i,610]
  ];

  function listRankBoost(item,list,maxBoost){
    if(!Array.isArray(list)||!list.length)return 0;
    const key=titleKey(item);if(!key)return 0;
    const index=list.findIndex(candidate=>titleKey(candidate)===key);
    return index<0?0:Math.max(0,maxBoost-index*18);
  }

  function popularityScore(item){
    let score=0;
    try{if(typeof movieScore==='function')score+=Number(movieScore(item)||0)*6;}catch(_){}
    const rating=Number(item?.rating)||0;
    const popularity=Number(item?.popularity||item?.tmdbPopularity||item?.votePopularity)||0;
    const voteCount=Number(item?.voteCount||item?.vote_count)||0;
    const year=Number(String(item?.year||'').match(/(?:19|20)\d{2}/)?.[0])||0;
    score+=rating*18;
    score+=Math.min(popularity,1000)*2;
    score+=Math.min(Math.log10(Math.max(1,voteCount))*90,450);
    if(year>=2020)score+=35;else if(year>=2010)score+=22;else if(year>=2000)score+=12;
    const title=String(item?.name||item?.title||item?.file||'');
    for(const [pattern,boost] of franchisePriority){if(pattern.test(title)){score+=boost;break;}}
    try{if(typeof trendingMovies!=='undefined')score+=listRankBoost(item,trendingMovies,1700);}catch(_){}
    try{if(typeof trendingSeries!=='undefined')score+=listRankBoost(item,trendingSeries,1700);}catch(_){}
    try{if(typeof heroMovies!=='undefined')score+=listRankBoost(item,heroMovies,1350);}catch(_){}
    if(item?.poster)score+=12;
    return score;
  }

  function rankItems(list){
    // popularityScore performs title normalization and trending-list lookups.
    // Compute it once per item instead of on every sort comparison.
    return list.map(item=>({
      item,
      score:popularityScore(item),
      rating:Number(item?.rating||0),
      year:Number(String(item?.year||'').match(/(?:19|20)\d{2}/)?.[0]||0),
      title:String(item?.name||item?.title||'')
    })).sort((a,b)=>
      b.score-a.score
      || b.rating-a.rating
      || b.year-a.year
      || a.title.localeCompare(b.title)
    ).map(entry=>entry.item);
  }

  function dedupe(list){
    const seen=new Set();
    return list.filter(item=>{
      const key=String(item?.id||item?.streamUrl||`${titleKey(item)}|${item?.year||''}`);
      if(!key||seen.has(key))return false;
      seen.add(key);return true;
    });
  }

  function nativeCard(item){
    const normalized={...item,isFtp:true,hasStream:true,streamAvailable:true,mobileDirect:true};
    const isSeries=normalized.type==='series'||normalized.type==='tv'||normalized.seasons;
    try{
      if(isSeries&&typeof sCardHTML==='function')return sCardHTML(normalized);
      if(!isSeries&&typeof cardHTML==='function')return cardHTML(normalized);
    }catch(_){}
    return '';
  }

  function openNative(item){
    if(!item||Date.now()-openedAt<450)return;
    openedAt=Date.now();
    const isSeries=item.type==='series'||item.type==='tv'||item.seasons;
    try{
      if(isSeries&&typeof registerSeriesForDetail==='function'&&typeof openSeriesDetail==='function')return openSeriesDetail(registerSeriesForDetail(item));
      if(!isSeries&&typeof registerMovieForDetail==='function'&&typeof openMovieDetail==='function')return openMovieDetail(registerMovieForDetail(item));
    }catch(error){console.warn('[Mobile Direct] detail open failed',error);}
  }

  function bindTrack(track){
    [...track.querySelectorAll('.card')].forEach((card,index)=>{
      card.dataset.svMobileDirectIndex=String(index);
      card.style.pointerEvents='auto';
      card.style.touchAction='pan-x';
    });
    track.onpointerdown=function(event){
      const card=event.target.closest?.('.card[data-sv-mobile-direct-index]');
      if(!card)return;
      touchStart={card,x:event.clientX,y:event.clientY,t:Date.now()};
    };
    track.onpointerup=function(event){
      const card=event.target.closest?.('.card[data-sv-mobile-direct-index]');
      const start=touchStart;touchStart=null;
      if(!card||!start||start.card!==card)return;
      const moved=Math.hypot(event.clientX-start.x,event.clientY-start.y);
      if(moved>12||Date.now()-start.t>900)return;
      event.preventDefault();event.stopPropagation();
      openNative(items[Number(card.dataset.svMobileDirectIndex)]);
    };
    track.onclick=function(event){
      const card=event.target.closest?.('.card[data-sv-mobile-direct-index]');
      if(!card)return;
      event.preventDefault();event.stopPropagation();
      openNative(items[Number(card.dataset.svMobileDirectIndex)]);
    };
  }

  function installBadgeStyle(){
    if(document.getElementById('svMobileDirectV5Style'))return;
    const style=document.createElement('style');
    style.id='svMobileDirectV5Style';
    style.textContent=`#mobileDirectRow .card{pointer-events:auto!important;cursor:pointer!important}#mobileDirectRow .card:after{content:'DIRECT';position:absolute;top:8px;left:8px;z-index:9;background:rgba(0,185,104,.94);color:#fff;border-radius:999px;padding:4px 7px;font-size:.54rem;font-weight:900;letter-spacing:.08em;pointer-events:none}`;
    document.head.appendChild(style);
  }

  function itemKey(item){
    return String(item?.id || item?.streamUrl || (titleKey(item)+'|'+String(item?.year || '')));
  }

  function renderTrack(track){
    const next=items.slice(0,60);
    const existing=new Map(
      Array.from(track.children).map(card=>[String(card.dataset.svMobileDirectKey || ''),card])
    );
    const fragment=document.createDocumentFragment();
    next.forEach((item,index)=>{
      const key=itemKey(item);
      let card=existing.get(key);
      if(!card){
        const template=document.createElement('template');
        template.innerHTML=nativeCard(item).trim();
        card=template.content.firstElementChild;
      }
      if(!card)return;
      card.dataset.svMobileDirectKey=key;
      card.dataset.svMobileDirectIndex=String(index);
      fragment.appendChild(card);
    });
    track.replaceChildren(fragment);
  }

  function mount(){
    if(!items.length)return;
    const main=document.getElementById('mainSection');if(!main)return;
    installBadgeStyle();
    let row=document.getElementById('mobileDirectRow');
    if(!row){
      row=document.createElement('div');row.className='row';row.id='mobileDirectRow';
      row.innerHTML='<div class="row-header"><div><div class="row-title">📱 Plays Instantly on Mobile</div><div style="font-size:.7rem;opacity:.55;margin-top:3px">Popular first · device-compatible direct play · no transcoding</div></div></div><div class="cards-track" id="mobileDirectTrack"></div>';
      const first=main.querySelector('.row');if(first)main.insertBefore(row,first);else main.prepend(row);
    }
    row.style.display='';
    const track=row.querySelector('#mobileDirectTrack');
    renderTrack(track);
    bindTrack(track);
  }

  async function fetchCatalogPage(page,device){
    const response=await fetch(`/api/mobile-direct/catalog?page=${page}&limit=500&device=${device}`,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function load(){
    if(loading)return;loading=true;
    try{
      const device=/iPhone|iPad|iPod/i.test(navigator.userAgent||'')?'ios':/Android/i.test(navigator.userAgent||'')?'android':'generic';
      const first=await fetchCatalogPage(1,device);
      let pool=(Array.isArray(first?.items)?first.items:[]).filter(supported);
      items=rankItems(dedupe(pool));
      certified.clear();items.forEach(register);
      window.__SV_MOBILE_DIRECT_CATALOG=first;
      window.__SV_MOBILE_DIRECT_ITEMS=items;
      installPlaybackHooks();mount();

      const pageCount=Math.min(6,Math.max(1,Number(first?.pages)||1));
      if(pageCount>1){
        const rest=await Promise.all(Array.from({length:pageCount-1},(_,i)=>fetchCatalogPage(i+2,device).catch(()=>null)));
        for(const page of rest)if(Array.isArray(page?.items))pool.push(...page.items.filter(supported));
        items=rankItems(dedupe(pool));
        certified.clear();items.forEach(register);
        window.__SV_MOBILE_DIRECT_ITEMS=items;
        window.__SV_MOBILE_DIRECT_RANKED_COUNT=items.length;
        mount();
      }
    }catch(error){window.__SV_MOBILE_DIRECT_ERROR=String(error?.message||error);}
    finally{loading=false;}
  }

  function boot(){
    installPlaybackHooks();load();
    new MutationObserver(()=>{if(items.length&&!document.getElementById('mobileDirectRow'))mount();}).observe(document.documentElement,{childList:true,subtree:true});
    setInterval(load,5*60*1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
