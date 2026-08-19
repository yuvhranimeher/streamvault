/* StreamVault mobile direct-play v4 — normal StreamVault row + explicit mobile tap bridge */
(function(){
  'use strict';
  if(window.__SV_MOBILE_DIRECT_HOME_V4)return;
  window.__SV_MOBILE_DIRECT_HOME_V4=true;
  window.__SV_MOBILE_DIRECT_HOME_VERSION='20260819-mobile-direct-home-v4';

  const certified=new Map();
  const probe=document.createElement('video');
  let items=[];
  let installedPlayback=false;
  let touchStart=null;
  let openedAt=0;

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
      if(isSeries&&typeof registerSeriesForDetail==='function'&&typeof openSeriesDetail==='function'){
        return openSeriesDetail(registerSeriesForDetail(item));
      }
      if(!isSeries&&typeof registerMovieForDetail==='function'&&typeof openMovieDetail==='function'){
        return openMovieDetail(registerMovieForDetail(item));
      }
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
      event.preventDefault();
      event.stopPropagation();
      openNative(items[Number(card.dataset.svMobileDirectIndex)]);
    };
    track.onclick=function(event){
      const card=event.target.closest?.('.card[data-sv-mobile-direct-index]');
      if(!card)return;
      event.preventDefault();
      event.stopPropagation();
      openNative(items[Number(card.dataset.svMobileDirectIndex)]);
    };
  }

  function installBadgeStyle(){
    if(document.getElementById('svMobileDirectV4Style'))return;
    const style=document.createElement('style');
    style.id='svMobileDirectV4Style';
    style.textContent=`#mobileDirectRow .card{pointer-events:auto!important;cursor:pointer!important}#mobileDirectRow .card:after{content:'DIRECT';position:absolute;top:8px;left:8px;z-index:9;background:rgba(0,185,104,.94);color:#fff;border-radius:999px;padding:4px 7px;font-size:.54rem;font-weight:900;letter-spacing:.08em;pointer-events:none}`;
    document.head.appendChild(style);
  }

  function mount(){
    if(!items.length)return;
    const main=document.getElementById('mainSection');if(!main)return;
    installBadgeStyle();
    let row=document.getElementById('mobileDirectRow');
    if(!row){
      row=document.createElement('div');
      row.className='row';
      row.id='mobileDirectRow';
      row.innerHTML='<div class="row-header"><div><div class="row-title">📱 Plays Instantly on Mobile</div><div style="font-size:.7rem;opacity:.55;margin-top:3px">Device-compatible direct play · no transcoding</div></div></div><div class="cards-track" id="mobileDirectTrack"></div>';
      const first=main.querySelector('.row');
      if(first)main.insertBefore(row,first);else main.prepend(row);
    }
    row.style.display='';
    const track=row.querySelector('#mobileDirectTrack');
    const html=items.slice(0,60).map(nativeCard).filter(Boolean).join('');
    track.innerHTML=html;
    bindTrack(track);
  }

  async function load(){
    try{
      const device=/iPhone|iPad|iPod/i.test(navigator.userAgent||'')?'ios':/Android/i.test(navigator.userAgent||'')?'android':'generic';
      const response=await fetch(`/api/mobile-direct/catalog?limit=120&device=${device}`,{cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      items=(Array.isArray(data?.items)?data.items:[]).filter(supported);
      items.forEach(register);
      window.__SV_MOBILE_DIRECT_CATALOG=data;
      window.__SV_MOBILE_DIRECT_ITEMS=items;
      installPlaybackHooks();
      mount();
    }catch(error){window.__SV_MOBILE_DIRECT_ERROR=String(error?.message||error);}
  }

  function boot(){
    installPlaybackHooks();
    load();
    new MutationObserver(()=>{if(items.length&&!document.getElementById('mobileDirectRow'))mount();}).observe(document.documentElement,{childList:true,subtree:true});
    setInterval(load,5*60*1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
