(function configureStreamVault(global){
  'use strict';

  const BUILD_VERSION='20260722-instant-recovery-v1';
  const BACKEND_ORIGIN='https://backend.streamvault.fit';
  const HOME_CACHE_KEY='streamvault:latest-home-snapshot:v2';
  const BACKEND_PATHS=['/api','/download','/live','/live-relay','/proxy','/stream','/subtitles','/subtitle','/audio','/hls','/playback'];
  const LEGACY_FRONTEND_ORIGINS=new Set(['https://streamvault.fit','https://www.streamvault.fit']);
  const MESSAGES=Object.freeze({backend:'StreamVault backend is temporarily offline.',playback:'Playback server is currently offline.',liveTv:'Live TV server is currently offline.',action:'This backend feature is currently offline.'});

  function isBackendPath(pathname){return BACKEND_PATHS.some(prefix=>pathname===prefix||pathname.startsWith(prefix+'/'));}
  function backendUrl(input){
    if(input==null)return input;
    let url;
    try{url=new URL(String(input),global.location.href);}catch{return input;}
    const shouldRoute=isBackendPath(url.pathname)&&(url.origin===global.location.origin||LEGACY_FRONTEND_ORIGINS.has(url.origin));
    if(!shouldRoute)return input instanceof URL?url.toString():input;
    return BACKEND_ORIGIN+url.pathname+url.search+url.hash;
  }
  function normalizeBackendUrls(value){
    if(value instanceof URL)return value.toString();
    if(typeof value==='string')return (/^[a-z][a-z\d+.-]*:/i.test(value)||value.startsWith('//'))?value:backendUrl(value);
    if(Array.isArray(value))return value.map(normalizeBackendUrls);
    if(!value||typeof value!=='object')return value;
    return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,normalizeBackendUrls(child)]));
  }

  function validSnapshot(value){return !!value?.snapshotId&&Array.isArray(value.rows)&&value.rows.length>0;}
  function snapshotTime(value){return Number(value?.capturedAt||value?.generatedAt||value?.source?.capturedAt||0)||0;}
  function readPersistentSnapshot(){
    try{const parsed=JSON.parse(localStorage.getItem(HOME_CACHE_KEY)||'null');return validSnapshot(parsed)?parsed:null;}catch{return null;}
  }
  function writePersistentSnapshot(snapshot){
    if(!validSnapshot(snapshot))return false;
    try{localStorage.setItem(HOME_CACHE_KEY,JSON.stringify(snapshot));return true;}catch{return false;}
  }

  const bundledSnapshot=global.STREAMVAULT_HOME_SNAPSHOT;
  if(!validSnapshot(bundledSnapshot))throw new Error('Bundled production homepage snapshot is missing or invalid');
  const persistedSnapshot=readPersistentSnapshot();
  const initialSnapshot=persistedSnapshot&&snapshotTime(persistedSnapshot)>=snapshotTime(bundledSnapshot)?persistedSnapshot:bundledSnapshot;

  const backendStatus={checked:false,available:null,checkedAt:0,version:null,commit:null};
  let statusObservation=0,publishedObservation=0,pollTimer=null,homeRefreshPromise=null,lastHomeRefresh=0;
  const nativeFetch=global.fetch.bind(global);

  function publishBackendStatus(available,version,commit,observation=++statusObservation){
    if(observation<publishedObservation)return backendStatus;
    publishedObservation=observation;
    const changed=backendStatus.available!==available||(version!==undefined&&backendStatus.version!==(version||null))||(commit!==undefined&&backendStatus.commit!==(commit||null));
    backendStatus.checked=true;backendStatus.available=available;backendStatus.checkedAt=Date.now();
    if(!available){backendStatus.version=null;backendStatus.commit=null;}
    else{if(version!==undefined)backendStatus.version=version||null;if(commit!==undefined)backendStatus.commit=commit||null;}
    document.documentElement.dataset.backend=available?'online':'offline';
    scheduleBackendPoll();
    if(changed){
      global.dispatchEvent(new CustomEvent('streamvault:backend-status',{detail:{...backendStatus}}));
      if(available)void refreshPersistentHomeSnapshot();
    }
    return backendStatus;
  }

  function fetchWithTimeout(url,options={},timeoutMs=3500){
    const controller=new AbortController();
    const parentSignal=options.signal;
    const abortFromParent=()=>controller.abort(parentSignal?.reason);
    if(parentSignal?.aborted)abortFromParent();else parentSignal?.addEventListener?.('abort',abortFromParent,{once:true});
    const timer=global.setTimeout(()=>controller.abort(),timeoutMs);
    return nativeFetch(backendUrl(url),{...options,signal:controller.signal}).finally(()=>{global.clearTimeout(timer);parentSignal?.removeEventListener?.('abort',abortFromParent);});
  }

  function checkBackendAvailability(timeoutMs=1200){
    const observation=++statusObservation;
    return fetchWithTimeout(BACKEND_ORIGIN+'/api/version',{cache:'no-store',headers:{Accept:'application/json'}},timeoutMs)
      .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json().catch(()=>({}));})
      .then(payload=>publishBackendStatus(true,payload.version||payload.build||null,payload.commit||null,observation))
      .catch(()=>publishBackendStatus(false,null,null,observation));
  }

  function scheduleBackendPoll(){
    global.clearTimeout(pollTimer);
    const delay=backendStatus.available===true?10000:1000;
    pollTimer=global.setTimeout(()=>{checkBackendAvailability(900).finally(scheduleBackendPoll);},delay);
  }

  async function refreshPersistentHomeSnapshot(force=false){
    if(backendStatus.available!==true)return null;
    if(homeRefreshPromise)return homeRefreshPromise;
    if(!force&&Date.now()-lastHomeRefresh<300000)return null;
    homeRefreshPromise=fetchWithTimeout(BACKEND_ORIGIN+'/api/home-feed?limit=24',{cache:'no-store',headers:{Accept:'application/json'}},5000)
      .then(response=>{if(!response.ok)throw new Error(`home feed HTTP ${response.status}`);return response.json();})
      .then(payload=>{
        const normalized=normalizeBackendUrls(payload);
        if(!Array.isArray(normalized?.rows)||!normalized.rows.length)return null;
        if(!normalized.snapshotId)normalized.snapshotId=`live-${backendStatus.commit||'backend'}-${Date.now()}`;
        normalized.capturedAt=Date.now();
        normalized.source={...(normalized.source||{}),backendCommit:backendStatus.commit||normalized.source?.backendCommit||'',capturedAt:normalized.capturedAt};
        writePersistentSnapshot(normalized);lastHomeRefresh=Date.now();
        global.dispatchEvent(new CustomEvent('streamvault:home-snapshot-updated',{detail:{snapshotId:normalized.snapshotId,capturedAt:normalized.capturedAt}}));
        return normalized;
      }).catch(error=>{console.warn('[StreamVault] latest homepage snapshot refresh failed:',error.message);return null;})
      .finally(()=>{homeRefreshPromise=null;});
    return homeRefreshPromise;
  }

  global.fetch=function streamVaultFetch(input,init){
    let backendRequest=false;
    try{
      if(typeof input==='string'||input instanceof URL){const routed=backendUrl(input);input=routed;const u=new URL(String(routed),global.location.href);backendRequest=u.origin===BACKEND_ORIGIN&&isBackendPath(u.pathname);}
      else if(input&&input.url){const routed=backendUrl(input.url);const u=new URL(String(routed),global.location.href);backendRequest=u.origin===BACKEND_ORIGIN&&isBackendPath(u.pathname);if(routed!==input.url)input=new Request(routed,input);}
    }catch{}
    const request=nativeFetch(input,init);
    if(!backendRequest)return request;
    return request.then(response=>{publishBackendStatus(true);return response;},error=>{if(error?.name!=='AbortError')void checkBackendAvailability(900);throw error;});
  };

  if(global.XMLHttpRequest){
    const nativeOpen=global.XMLHttpRequest.prototype.open;
    global.XMLHttpRequest.prototype.open=function(method,url,...rest){
      const routed=backendUrl(url);
      try{const u=new URL(String(routed),global.location.href);if(u.origin===BACKEND_ORIGIN&&isBackendPath(u.pathname)){this.addEventListener?.('load',()=>publishBackendStatus(true),{once:true});this.addEventListener?.('error',()=>void checkBackendAvailability(900),{once:true});this.addEventListener?.('timeout',()=>void checkBackendAvailability(900),{once:true});}}catch{}
      return nativeOpen.call(this,method,routed,...rest);
    };
  }

  function loadStaticJson(path){return fetchWithTimeout(path,{cache:'no-cache',headers:{Accept:'application/json'}},5000).then(response=>{if(!response.ok)throw new Error(`${path} HTTP ${response.status}`);return response.json().then(normalizeBackendUrls);});}
  function registerServiceWorker(){
    if(!('serviceWorker'in navigator)||!/^https?:$/.test(global.location.protocol))return Promise.resolve(null);
    return navigator.serviceWorker.register('/sw-20260722-v6.js',{scope:'/',updateViaCache:'none'}).then(reg=>reg.update().then(()=>reg).catch(()=>reg));
  }
  async function showOfflineMessage(kind='action'){const status=await checkBackendAvailability(900);if(status.available)return null;const message=MESSAGES[kind]||MESSAGES.action;if(typeof global.showToast==='function')global.showToast(message);else console.warn(`[StreamVault] ${message}`);return message;}

  const staticData=Object.freeze({homeSnapshot:Promise.resolve(normalizeBackendUrls(initialSnapshot)),channels:loadStaticJson('/channels.json')});
  const config=Object.freeze({apiOrigin:BACKEND_ORIGIN,backendOrigin:BACKEND_ORIGIN,backendUrl,apiUrl:backendUrl,backendStatus,buildVersion:BUILD_VERSION,checkBackendAvailability,fetchWithTimeout,isBackendPath,messages:MESSAGES,normalizeBackendUrls,offlineMessage:MESSAGES.backend,homeSnapshotId:initialSnapshot.snapshotId,persistentHomeSnapshotKey:HOME_CACHE_KEY,readPersistentSnapshot,refreshPersistentHomeSnapshot,registerServiceWorker,showOfflineMessage,staticData,writePersistentSnapshot});

  global.API_BASE=BACKEND_ORIGIN;
  global.STREAMVAULT_BACKEND_OFFLINE_MESSAGE=MESSAGES.backend;
  global.__svBackendStatus=backendStatus;
  global.STREAMVAULT_CONFIG=config;
  global.StreamVaultConfig=config;
  global.__svBackendCheckPromise=checkBackendAvailability();
  scheduleBackendPoll();
  global.addEventListener('online',()=>void checkBackendAvailability(700));
  global.addEventListener('focus',()=>void checkBackendAvailability(700));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkBackendAvailability(700);});
  global.addEventListener('load',()=>{registerServiceWorker().catch(error=>console.warn('[StreamVault] service worker registration failed:',error.message));},{once:true});
})(window);
