/* StreamVault mobile direct-play v3 — use native StreamVault cards/click path */
(function(){
  'use strict';
  if(window.__SV_MOBILE_DIRECT_HOME_V3)return;
  window.__SV_MOBILE_DIRECT_HOME_V3=true;
  window.__SV_MOBILE_DIRECT_HOME_VERSION='20260819-mobile-direct-home-v3';

  const certified=new Map();
  const probe=document.createElement('video');
  let items=[];
  let installedPlayback=false;

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
  function itemProfiles(item){return Array.isArray(item?.mobileDirectProfiles)&&item.mobileDirectProfiles.length?item.mobileDirectProfiles:[item?.mobileDirectProfile].filter(Boolean);}
  function itemSupported(item){const profiles=itemProfiles(item);return item?.mobileDirect===true&&profiles.length>0&&profiles.every(supportsProfile);}
  function register(item){
    if(!itemSupported(item))return;
    if(item.streamUrl)certified.set(String(item.streamUrl),item.mobileDirectProfile||itemProfiles(item)[0]);
    for(const episodes of Object.values(item.seasons||{}))for(const ep of (Array.isArray(episodes)?episodes:[]))if(ep?.streamUrl)certified.set(String(ep.streamUrl),ep.mobileDirectProfile||itemProfiles(item)[0]);
  }
  function sourceCertified(url){const profile=certified.get(String(url||''));return profile&&supportsProfile(profile);}
  function directPlan(url){const src=proxy(url);return {ok:true,mode:'proxy',src,proxyUrl:src,directUrl:src,mobileDirect:true,transcoding:false,duration:0};}

  function installPlaybackHooks(){
    if(installedPlayback)return;installedPlayback=true;
    const prevFetch=window.fetchFtpPlaybackPlan;
    if(typeof prevFetch==='function')window.fetchFtpPlaybackPlan=async function(url,start=0,options={}){
      const explicitMap=!!(options?.forceAudio||options?.forceRemux||options?.mode==='audio'||options?.mode==='remux');
      if(mobile()&&sourceCertified(url)&&!explicitMap)return directPlan(url);
      return prevFetch.apply(this,arguments);
    };
    const prevLocal=window.localFtpPlaybackPlan;
    if(typeof prevLocal==='function')window.localFtpPlaybackPlan=function(url,options={}){
      const explicitMap=!!(options?.forceAudio||options?.forceRemux||options?.mode==='audio'||options?.mode==='remux');
      if(mobile()&&sourceCertified(url)&&!explicitMap)return directPlan(url);
      return prevLocal.apply(this,arguments);
    };
    const prevSeek=window.seekToTime;
    if(typeof prevSeek==='function')window.seekToTime=function(seconds){
      let source='';try{if(typeof _ftpStreamUrl!=='undefined')source=String(_ftpStreamUrl||'');}catch(_){}
      if(mobile()&&sourceCertified(source)){
        const video=document.getElementById('videoPlayer');
        if(video){try{video.currentTime=Math.max(0,Number(seconds)||0);if(video.paused&&video._svPlaybackShouldPlay!==false)video.play().catch(()=>{});return;}catch(_){}}
      }
      return prevSeek.apply(this,arguments);
    };
  }

  function nativeCardHtml(item){
    const normalized={...item,isFtp:true,hasStream:true,streamAvailable:true,mobileDirect:true};
    const series=normalized.type==='series'||normalized.type==='tv'||normalized.seasons;
    try{
      if(series&&typeof window.sCardHTML==='function')return window.sCardHTML(normalized);
      if(!series&&typeof window.cardHTML==='function')return window.cardHTML(normalized);
    }catch(_){}
    return '';
  }

  function installStyles(){
    if(document.getElementById('svMobileDirectV3Styles'))return;
    const s=document.createElement('style');s.id='svMobileDirectV3Styles';s.textContent=`
      #mobileDirectRow{display:block;margin:18px 0 28px}
      #mobileDirectRow .sv-md-head{display:flex;align-items:end;justify-content:space-between;padding:0 5.2vw 10px;gap:14px}
      #mobileDirectRow .sv-md-title{font-size:clamp(1.2rem,2vw,1.8rem);font-weight:900;color:#fff;letter-spacing:-.03em}
      #mobileDirectRow .sv-md-sub{font-size:.7rem;color:rgba(255,255,255,.55);margin-top:3px}
      #mobileDirectTrack{display:flex;gap:16px;overflow-x:auto;padding:2px 5.2vw 10px;scrollbar-width:none;overscroll-behavior-inline:contain}
      #mobileDirectTrack::-webkit-scrollbar{display:none}
      #mobileDirectTrack .card{position:relative;pointer-events:auto!important;touch-action:manipulation;cursor:pointer}
      #mobileDirectTrack .card:after{content:'DIRECT';position:absolute;top:8px;left:8px;z-index:9;background:rgba(0,185,104,.94);color:#fff;border-radius:999px;padding:4px 7px;font-size:.54rem;font-weight:900;letter-spacing:.08em;pointer-events:none}
      @media(max-width:760px){#mobileDirectRow .sv-md-head{padding-left:16px;padding-right:16px}#mobileDirectTrack{padding-left:16px;padding-right:16px;gap:10px}}
    `;document.head.appendChild(s);
  }

  function mount(){
    if(!items.length)return;
    const main=document.getElementById('mainSection');if(!main)return;
    installStyles();
    let row=document.getElementById('mobileDirectRow');
    if(!row){
      row=document.createElement('section');row.id='mobileDirectRow';
      row.innerHTML='<div class="sv-md-head"><div><div class="sv-md-title">📱 Plays Instantly on Mobile</div><div class="sv-md-sub">Device-compatible direct play · no transcoding</div></div></div><div id="mobileDirectTrack"></div>';
      const first=main.querySelector('.row');if(first)main.insertBefore(row,first);else main.prepend(row);
    }
    const track=row.querySelector('#mobileDirectTrack');
    const html=items.slice(0,60).map(nativeCardHtml).filter(Boolean).join('');
    if(html)track.innerHTML=html;
  }

  async function load(){
    try{
      const device=/iPhone|iPad|iPod/i.test(navigator.userAgent||'')?'ios':/Android/i.test(navigator.userAgent||'')?'android':'generic';
      const r=await fetch(`/api/mobile-direct/catalog?limit=120&device=${device}`,{cache:'no-store',headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const data=await r.json();
      items=(Array.isArray(data?.items)?data.items:[]).filter(itemSupported);
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
