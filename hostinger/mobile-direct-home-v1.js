/* StreamVault mobile direct-play v2 — device-capability filtered, no transcoding */
(function(){
  'use strict';
  if(window.__SV_MOBILE_DIRECT_HOME_V2)return;
  window.__SV_MOBILE_DIRECT_HOME_V2=true;
  window.__SV_MOBILE_DIRECT_HOME_VERSION='20260819-mobile-direct-home-v2';

  const certified=new Map();
  const probe=document.createElement('video');
  let firstPage=[];
  let total=0;
  let installed=false;
  let overlay=null;
  let overlayPage=1;
  let overlayLoading=false;
  let overlayDone=false;
  let preloadVideo=null;

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
  function itemSupported(item){
    const profiles=Array.isArray(item?.mobileDirectProfiles)&&item.mobileDirectProfiles.length?item.mobileDirectProfiles:[item?.mobileDirectProfile].filter(Boolean);
    return item?.mobileDirect===true&&profiles.length>0&&profiles.every(supportsProfile);
  }

  function register(item){
    if(!itemSupported(item))return;
    if(item.streamUrl)certified.set(String(item.streamUrl),item.mobileDirectProfile||item.mobileDirectProfiles?.[0]||'universal-h264');
    for(const episodes of Object.values(item.seasons||{}))for(const ep of (Array.isArray(episodes)?episodes:[]))if(ep?.streamUrl)certified.set(String(ep.streamUrl),ep.mobileDirectProfile||item.mobileDirectProfiles?.[0]||'universal-h264');
  }
  function sourceCertified(url){const profile=certified.get(String(url||''));return profile&&supportsProfile(profile);}
  function directPlan(url){const src=proxy(url);return {ok:true,mode:'proxy',src,proxyUrl:src,directUrl:src,mobileDirect:true,transcoding:false,duration:0};}

  function installPlayback(){
    if(installed)return;installed=true;
    const prevFetch=window.fetchFtpPlaybackPlan;
    if(typeof prevFetch==='function')window.fetchFtpPlaybackPlan=async function(url,start=0,options={}){
      const manualMap=!!(options?.forceAudio||options?.forceRemux||options?.mode==='audio'||options?.mode==='remux');
      if(mobile()&&sourceCertified(url)&&!manualMap)return directPlan(url);
      return prevFetch.apply(this,arguments);
    };
    const prevLocal=window.localFtpPlaybackPlan;
    if(typeof prevLocal==='function')window.localFtpPlaybackPlan=function(url,options={}){
      const manualMap=!!(options?.forceAudio||options?.forceRemux||options?.mode==='audio'||options?.mode==='remux');
      if(mobile()&&sourceCertified(url)&&!manualMap)return directPlan(url);
      return prevLocal.apply(this,arguments);
    };
    const prevSeek=window.seekToTime;
    if(typeof prevSeek==='function')window.seekToTime=function(seconds){
      let source='';try{if(typeof _ftpStreamUrl!=='undefined')source=String(_ftpStreamUrl||'');}catch(_){}
      if(mobile()&&sourceCertified(source)){
        const video=document.getElementById('videoPlayer');
        if(video){const target=Math.max(0,Number(seconds)||0);try{video.currentTime=target;if(video.paused&&video._svPlaybackShouldPlay!==false)video.play().catch(()=>{});return;}catch(_){}}
      }
      return prevSeek.apply(this,arguments);
    };
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function title(item){return item?.name||item?.title||item?.file||'Untitled';}
  function poster(item){return item?.poster||item?.backdrop||'';}
  function card(item,index,scope='row'){
    const art=poster(item);const type=item?.seasons||item?.type==='series'||item?.type==='tv'?'Series':'Movie';
    return `<button class="sv-md-card" type="button" data-sv-md-scope="${scope}" data-sv-md-index="${index}"><span class="sv-md-art">${art?`<img src="${esc(art)}" alt="" loading="lazy" decoding="async">`:'<span class="sv-md-ph"></span>'}<span class="sv-md-badge">DIRECT</span></span><span class="sv-md-copy"><strong>${esc(title(item))}</strong><small>${type}${item?.year?` · ${esc(item.year)}`:''}</small></span></button>`;
  }

  function styles(){
    if(document.getElementById('svMdStyles'))return;
    const s=document.createElement('style');s.id='svMdStyles';s.textContent=`
      #mobileDirectRow{display:block;margin:16px 0 28px}.sv-md-head{display:flex;align-items:end;justify-content:space-between;padding:0 5.2vw;margin-bottom:11px}.sv-md-title{font-size:clamp(1.15rem,2vw,1.75rem);font-weight:900;color:#fff}.sv-md-sub{font-size:.7rem;color:rgba(255,255,255,.52);margin-top:3px}.sv-md-all{border:0;background:transparent;color:#55d69e;font-weight:800;cursor:pointer}.sv-md-track{display:flex;gap:14px;overflow-x:auto;padding:2px 5.2vw 10px;scrollbar-width:none}.sv-md-track::-webkit-scrollbar{display:none}.sv-md-card{border:0;background:transparent;color:#fff;text-align:left;padding:0;flex:0 0 var(--card-w,176px);width:var(--card-w,176px);cursor:pointer}.sv-md-art{display:block;position:relative;aspect-ratio:2/3;border-radius:13px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.1)}.sv-md-art img,.sv-md-ph{width:100%;height:100%;object-fit:cover;display:block;background:#111}.sv-md-badge{position:absolute;top:7px;left:7px;border-radius:999px;padding:4px 7px;background:rgba(0,185,104,.92);font-size:.53rem;font-weight:900;letter-spacing:.08em}.sv-md-copy{display:block;padding:7px 2px}.sv-md-copy strong,.sv-md-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sv-md-copy strong{font-size:.8rem}.sv-md-copy small{font-size:.63rem;color:rgba(255,255,255,.5);margin-top:3px}
      .sv-md-overlay{position:fixed;inset:0;z-index:999999;background:#090909;color:#fff;overflow:auto;padding:22px 4vw 60px}.sv-md-overlay-head{position:sticky;top:0;z-index:2;background:rgba(9,9,9,.94);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:space-between;padding:10px 0 18px}.sv-md-overlay-head h2{margin:0}.sv-md-close{border:0;border-radius:999px;background:#222;color:#fff;width:38px;height:38px;font-size:1.25rem}.sv-md-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:20px 14px}.sv-md-grid .sv-md-card{width:100%;max-width:none;flex:none}.sv-md-more{display:block;margin:28px auto;border:0;border-radius:999px;padding:11px 22px;background:#fff;color:#111;font-weight:800}
      @media(max-width:760px){.sv-md-head{padding:0 16px}.sv-md-track{padding-left:16px;padding-right:16px;gap:10px}.sv-md-card{width:132px;flex-basis:132px}.sv-md-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 8px}.sv-md-grid .sv-md-card{width:100%}.sv-md-overlay{padding:14px 12px 50px}}
    `;document.head.appendChild(s);
  }

  function bind(scope,items){
    document.querySelectorAll(`[data-sv-md-scope="${scope}"]`).forEach(btn=>{
      const item=items[Number(btn.dataset.svMdIndex)];
      btn.onclick=()=>openItem(item);btn.onpointerenter=()=>prime(item);btn.onpointerdown=()=>prime(item);
    });
  }
  function openItem(item){if(!item)return;prime(item);const type=item?.seasons||item?.type==='series'||item?.type==='tv'?'tv':'movie';if(typeof openMediaModal==='function')return openMediaModal(item,type);}
  function firstSource(item){if(item?.streamUrl)return item.streamUrl;for(const s of Object.keys(item?.seasons||{}).map(Number).sort((a,b)=>a-b)){const ep=(item.seasons[s]||[])[0];if(ep?.streamUrl)return ep.streamUrl;}return '';}
  function prime(item){if(!mobile())return;const src0=firstSource(item);if(!sourceCertified(src0))return;if(preloadVideo){try{preloadVideo.remove();}catch(_){}}const v=document.createElement('video');v.preload='auto';v.muted=true;v.playsInline=true;v.style.cssText='position:fixed;left:-5px;top:-5px;width:1px;height:1px;opacity:.001';v.src=proxy(src0);document.body.appendChild(v);try{v.load();}catch(_){}preloadVideo=v;setTimeout(()=>{if(preloadVideo===v){try{v.remove();}catch(_){}preloadVideo=null;}},15000);}

  function mount(){
    const items=firstPage.filter(itemSupported);if(!items.length)return;
    const main=document.getElementById('mainSection');if(!main)return;styles();
    let row=document.getElementById('mobileDirectRow');if(!row){row=document.createElement('section');row.id='mobileDirectRow';const first=main.querySelector('.row');first?main.insertBefore(row,first):main.prepend(row);}
    row.innerHTML=`<div class="sv-md-head"><div><div class="sv-md-title">📱 Direct Play on Mobile</div><div class="sv-md-sub">${total.toLocaleString()} verified titles · original files · no transcoding</div></div><button class="sv-md-all" type="button">View All →</button></div><div class="sv-md-track">${items.slice(0,60).map((x,i)=>card(x,i,'row')).join('')}</div>`;
    row.querySelector('.sv-md-all').onclick=openAll;bind('row',items.slice(0,60));
  }

  async function fetchPage(page,limit=500){
    const r=await fetch(`/api/mobile-direct/catalog?page=${page}&limit=${limit}`,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();
  }
  async function load(){
    try{const p=await fetchPage(1,120);total=Number(p.total)||0;firstPage=(p.items||[]);firstPage.forEach(register);installPlayback();mount();window.__SV_MOBILE_DIRECT_CATALOG=p;}catch(e){window.__SV_MOBILE_DIRECT_ERROR=e.message;}
  }

  async function openAll(){
    styles();overlayPage=1;overlayDone=false;overlay=document.createElement('div');overlay.className='sv-md-overlay';overlay.innerHTML='<div class="sv-md-overlay-head"><div><h2>📱 Direct Play on Mobile</h2><small id="svMdCount"></small></div><button class="sv-md-close" type="button">×</button></div><div class="sv-md-grid" id="svMdGrid"></div><button class="sv-md-more" id="svMdMore" type="button">Load more</button>';document.body.appendChild(overlay);document.body.style.overflow='hidden';overlay.querySelector('.sv-md-close').onclick=closeAll;overlay.querySelector('#svMdMore').onclick=loadMore;await loadMore();
  }
  function closeAll(){if(overlay){overlay.remove();overlay=null;}document.body.style.overflow='';}
  async function loadMore(){
    if(!overlay||overlayLoading||overlayDone)return;overlayLoading=true;const btn=overlay.querySelector('#svMdMore');btn.textContent='Loading…';
    try{const p=await fetchPage(overlayPage,500);total=Number(p.total)||total;const items=(p.items||[]).filter(itemSupported);items.forEach(register);const grid=overlay.querySelector('#svMdGrid');const start=grid.children.length;grid.insertAdjacentHTML('beforeend',items.map((x,i)=>card(x,start+i,'overlay')).join(''));const all=[...grid.querySelectorAll('.sv-md-card')];all.slice(start).forEach((el,i)=>{const item=items[i];el.onclick=()=>openItem(item);el.onpointerenter=()=>prime(item);});overlay.querySelector('#svMdCount').textContent=`${total.toLocaleString()} verified catalog titles`;overlayPage+=1;overlayDone=overlayPage>Number(p.pages||1);btn.style.display=overlayDone?'none':'';btn.textContent='Load more';}catch(e){btn.textContent='Retry';}finally{overlayLoading=false;}
  }

  function boot(){installPlayback();load();setInterval(load,120000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
