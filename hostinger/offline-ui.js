(function installOfflineGuards(global){
  'use strict';

  const config=global.STREAMVAULT_CONFIG || global.StreamVaultConfig;
  if(!config || global.__svOfflineGuardsInstalled)return;
  global.__svOfflineGuardsInstalled=true;

  function backendIsOffline(){
    return config.backendStatus?.available === false;
  }

  function guardFunction(name, kind){
    const original=global[name];
    if(typeof original !== 'function' || original.__svOfflineGuard)return;
    const guarded=function(){
      if(backendIsOffline()){
        const context=this;
        const args=arguments;
        return config.showOfflineMessage(kind).then(message=>{
          if(message)return;
          return original.apply(context,args);
        });
      }
      return original.apply(this,arguments);
    };
    guarded.__svOfflineGuard=true;
    guarded.__svOriginal=original;
    global[name]=guarded;
  }

  [
    'playMedia',
    'playFtpMedia',
    'playSeriesEpisode',
    'playMovieFromDetail',
    'playMediaModalPrimary'
  ].forEach(name=>guardFunction(name,'playback'));

  [
    'openLiveChannel',
    'openLiveMatchChannel'
  ].forEach(name=>guardFunction(name,'liveTv'));

  document.addEventListener('click',event=>{
    const link=event.target?.closest?.('a[href]');
    if(!link || !backendIsOffline())return;
    let url;
    try{url=new URL(link.href,location.href);}catch(_error){return;}
    if(url.origin !== config.backendOrigin)return;
    event.preventDefault();
    config.showOfflineMessage(url.pathname.startsWith('/download/') ? 'action' : 'playback')
      .then(message=>{
        if(!message)link.click();
      });
  },true);
})(window);
