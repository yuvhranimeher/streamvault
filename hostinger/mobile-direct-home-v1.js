/* StreamVault verified mobile direct-play surface — strict MP4/H.264/AAC/206 only */
(function(){
  'use strict';
  if(window.__SV_MOBILE_DIRECT_HOME_V1)return;
  window.__SV_MOBILE_DIRECT_HOME_V1=true;
  window.__SV_MOBILE_DIRECT_HOME_VERSION='20260819-mobile-direct-home-v1';

  const certified=new Map();
  let catalogItems=[];
  let installedPlaybackHooks=false;
  let preloadVideo=null;
  let preloadTimer=null;

  function isMobile(){
    try{
      if(typeof isMobilePlaybackClient==='function')return !!isMobilePlaybackClient();
    }catch(_){}
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'') || matchMedia('(max-width: 900px)').matches;
  }

  function apiBase(){
    return String(window.API_BASE || window.STREAMVAULT_CONFIG?.backendOrigin || '').replace(/\/$/,'');
  }

  function proxyUrl(url){
    return `${apiBase()}/api/mobile-direct/proxy?url=${encodeURIComponent(String(url||''))}`;
  }

  function registerSource(url,meta={}){
    const key=String(url||'').trim();
    if(key)certified.set(key,meta||{});
  }

  function registerItem(item){
    if(!item)return;
    if(item.streamUrl)registerSource(item.streamUrl,{duration:Number(item.mobileDirectDuration)||0,item});
    for(const episodes of Object.values(item.seasons||{})){
      for(const ep of (Array.isArray(episodes)?episodes:[])){
        if(ep?.streamUrl)registerSource(ep.streamUrl,{duration:Number(ep.duration)||0,item,episode:ep});
      }
    }
  }

  function currentFtpUrl(){
    try{
      if(typeof _ftpStreamUrl!=='undefined'&&_ftpStreamUrl)return String(_ftpStreamUrl);
    }catch(_){}
    return '';
  }

  function directPlan(url){
    const meta=certified.get(String(url||''))||{};
    const src=proxyUrl(url);
    return {
      ok:true,
      mode:'proxy',
      src,
      proxyUrl:src,
      directUrl:src,
      duration:Number(meta.duration)||0,
      mobileDirect:true,
      transcoding:false,
      profile:'mp4-h264-aac-range206'
    };
  }

  function installPlaybackHooks(){
    if(installedPlaybackHooks)return;
    installedPlaybackHooks=true;

    const previousFetch=window.fetchFtpPlaybackPlan;
    if(typeof previousFetch==='function'){
      window.fetchFtpPlaybackPlan=async function mobileDirectFetchPlan(url,start=0,options={}){
        const key=String(url||'');
        const compatibilityForced=!!(options?.forceHls||options?.forceAudio||options?.forceRemux||options?.mode==='audio'||options?.mode==='remux');
        if(isMobile()&&certified.has(key)&&!compatibilityForced)return directPlan(key);
        return previousFetch.apply(this,arguments);
      };
    }

    const previousLocal=window.localFtpPlaybackPlan;
    if(typeof previousLocal==='function'){
      window.localFtpPlaybackPlan=function mobileDirectLocalPlan(url,options={}){
        const key=String(url||'');
        const compatibilityForced=!!(options?.forceHls||options?.forceAudio||options?.forceRemux||options?.mode==='audio'||options?.mode==='remux');
        if(isMobile()&&certified.has(key)&&!compatibilityForced)return directPlan(key);
        return previousLocal.apply(this,arguments);
      };
    }

    const previousPlaybackSrc=window.ftpPlaybackSrc;
    if(typeof previousPlaybackSrc==='function'){
      window.ftpPlaybackSrc=function mobileDirectPlaybackSrc(url){
        const key=String(url||'');
        if(isMobile()&&certified.has(key))return proxyUrl(key);
        return previousPlaybackSrc.apply(this,arguments);
      };
    }

    // Certified sources have proven HTTP 206 support, so seeking stays inside
    // the same byte-range source instead of rebuilding/transcoding the stream.
    const previousSeek=window.seekToTime;
    if(typeof previousSeek==='function'){
      window.seekToTime=function mobileDirectNativeSeek(seconds){
        const source=currentFtpUrl();
        if(isMobile()&&certified.has(source)){
          const video=document.getElementById('videoPlayer');
          const target=Math.max(0,Number(seconds)||0);
          if(video){
            try{
              video.currentTime=target;
              if(typeof schedulePlayerProgressRender==='function')schedulePlayerProgressRender(target,typeof playerDuration==='function'?playerDuration():0,{force:true});
              if(video.paused&&video._svPlaybackShouldPlay!==false){
                if(typeof svPlayVideo==='function')svPlayVideo('mobile direct native seek',{force:true,onError:()=>false}).catch(()=>{});
                else video.play().catch(()=>{});
              }
              return;
            }catch(_){}
          }
        }
        return previousSeek.apply(this,arguments);
      };
    }
  }

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function titleOf(item){return item?.name||item?.title||item?.file||'Untitled';}

  function posterOf(item){return item?.poster||item?.backdrop||'';}

  function card(item,index){
    const poster=posterOf(item);
    const type=(item?.type==='series'||item?.type==='tv'||item?.seasons)?'Series':'Movie';
    const rating=Number(item?.rating||0);
    return `<button class="sv-mobile-direct-card" type="button" data-sv-mobile-direct-index="${index}" aria-label="${esc(titleOf(item))}">
      <span class="sv-mobile-direct-art">${poster?`<img src="${esc(poster)}" alt="" loading="lazy" decoding="async">`:'<span class="sv-mobile-direct-placeholder"></span>'}<span class="sv-mobile-direct-badge">DIRECT</span></span>
      <span class="sv-mobile-direct-copy"><strong>${esc(titleOf(item))}</strong><small>${esc(type)}${item?.year?` · ${esc(item.year)}`:''}${rating?` · ★ ${rating.toFixed(1)}`:''}</small></span>
    </button>`;
  }

  function installStyles(){
    if(document.getElementById('svMobileDirectStyles'))return;
    const style=document.createElement('style');
    style.id='svMobileDirectStyles';
    style.textContent=`
      #mobileDirectRow{display:block;margin:18px 0 26px;padding:0 0 2px}
      #mobileDirectRow .sv-mobile-direct-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:0 0 12px;padding:0 5.2vw}
      #mobileDirectRow .sv-mobile-direct-title{font-size:clamp(1.2rem,2.1vw,1.8rem);font-weight:900;letter-spacing:-.03em;color:#fff}
      #mobileDirectRow .sv-mobile-direct-sub{font-size:.72rem;color:rgba(255,255,255,.52);font-weight:650;margin-top:3px}
      #mobileDirectTrack{display:flex;gap:14px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;padding:2px 5.2vw 10px;scrollbar-width:none}
      #mobileDirectTrack::-webkit-scrollbar{display:none}
      .sv-mobile-direct-card{appearance:none;border:0;background:transparent;color:#fff;text-align:left;padding:0;flex:0 0 var(--card-w,176px);width:var(--card-w,176px);cursor:pointer;scroll-snap-align:start}
      .sv-mobile-direct-art{display:block;position:relative;width:100%;aspect-ratio:2/3;border-radius:14px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.12);transform:translateZ(0)}
      .sv-mobile-direct-art img,.sv-mobile-direct-placeholder{width:100%;height:100%;display:block;object-fit:cover;background:linear-gradient(135deg,#171717,#080808)}
      .sv-mobile-direct-badge{position:absolute;left:8px;top:8px;padding:4px 7px;border-radius:999px;background:rgba(0,185,104,.92);color:#fff;font-size:.56rem;font-weight:900;letter-spacing:.08em;box-shadow:0 4px 14px rgba(0,0,0,.28)}
      .sv-mobile-direct-copy{display:block;padding:8px 2px 0;min-width:0}
      .sv-mobile-direct-copy strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.82rem;line-height:1.25}
      .sv-mobile-direct-copy small{display:block;color:rgba(255,255,255,.55);font-size:.65rem;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @media(max-width:760px){#mobileDirectRow{margin-top:10px}#mobileDirectRow .sv-mobile-direct-head{padding:0 16px}#mobileDirectTrack{padding-left:16px;padding-right:16px;gap:10px}.sv-mobile-direct-card{flex-basis:132px;width:132px}.sv-mobile-direct-art{border-radius:11px}}
    `;
    document.head.appendChild(style);
  }

  function mountRow(){
    if(!catalogItems.length)return;
    const main=document.getElementById('mainSection');
    if(!main)return;
    installStyles();
    let row=document.getElementById('mobileDirectRow');
    if(!row){
      row=document.createElement('section');
      row.id='mobileDirectRow';
      row.innerHTML='<div class="sv-mobile-direct-head"><div><div class="sv-mobile-direct-title">📱 Plays Instantly on Mobile</div><div class="sv-mobile-direct-sub">Verified MP4 · H.264 · AAC · HTTP 206 · no transcoding</div></div></div><div id="mobileDirectTrack"></div>';
      const firstRow=main.querySelector('.row');
      if(firstRow)main.insertBefore(row,firstRow);else main.prepend(row);
    }
    const track=row.querySelector('#mobileDirectTrack');
    track.innerHTML=catalogItems.slice(0,40).map(card).join('');
    track.querySelectorAll('[data-sv-mobile-direct-index]').forEach(button=>{
      const index=Number(button.dataset.svMobileDirectIndex);
      button.addEventListener('pointerenter',()=>primeItem(catalogItems[index]),{passive:true});
      button.addEventListener('pointerdown',()=>primeItem(catalogItems[index]),{passive:true});
      button.addEventListener('click',()=>openItem(catalogItems[index]));
    });
  }

  function firstSource(item){
    if(item?.streamUrl)return item.streamUrl;
    const seasons=item?.seasons||{};
    const keys=Object.keys(seasons).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    for(const season of keys){
      const ep=(Array.isArray(seasons[season])?seasons[season]:[])[0];
      if(ep?.streamUrl)return ep.streamUrl;
    }
    return '';
  }

  function primeItem(item){
    if(!isMobile())return;
    const source=firstSource(item);
    if(!source||!certified.has(source))return;
    const src=proxyUrl(source);
    if(preloadVideo&&preloadVideo.dataset.svSource===source)return;
    if(preloadTimer){clearTimeout(preloadTimer);preloadTimer=null;}
    if(preloadVideo){try{preloadVideo.pause();preloadVideo.removeAttribute('src');preloadVideo.load();preloadVideo.remove();}catch(_){}preloadVideo=null;}
    const video=document.createElement('video');
    video.preload='auto';
    video.muted=true;
    video.playsInline=true;
    video.style.cssText='position:fixed;width:1px;height:1px;opacity:.001;pointer-events:none;left:-10px;top:-10px';
    video.dataset.svSource=source;
    video.src=src;
    document.body.appendChild(video);
    try{video.load();}catch(_){}
    preloadVideo=video;
    preloadTimer=setTimeout(()=>{
      if(preloadVideo===video){try{video.pause();video.removeAttribute('src');video.load();video.remove();}catch(_){}preloadVideo=null;}
    },20000);
  }

  function openItem(item){
    if(!item)return;
    primeItem(item);
    const type=(item?.type==='series'||item?.type==='tv'||item?.seasons)?'tv':'movie';
    if(typeof window.openMediaModal==='function')return window.openMediaModal(item,type);
    if(type==='tv'&&typeof window.openSeriesModal==='function')return window.openSeriesModal(item);
    if(typeof window.openMovieModal==='function')return window.openMovieModal(item);
  }

  async function loadCatalog(){
    try{
      const response=await fetch('/api/mobile-direct/catalog?limit=80',{cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      if(!payload?.ok||!Array.isArray(payload.items))return;
      catalogItems=payload.items.filter(item=>item?.mobileDirect===true);
      window.__SV_MOBILE_DIRECT_CATALOG=payload;
      window.__SV_MOBILE_DIRECT_ITEMS=catalogItems;
      catalogItems.forEach(item=>registerItem(item));
      installPlaybackHooks();
      mountRow();
    }catch(error){
      window.__SV_MOBILE_DIRECT_ERROR=String(error?.message||error);
    }
  }

  function boot(){
    installPlaybackHooks();
    loadCatalog();
    const observer=new MutationObserver(()=>{if(catalogItems.length&&!document.getElementById('mobileDirectRow'))mountRow();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(()=>loadCatalog(),5*60*1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
