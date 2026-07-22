(function installOfflineGuards(global){
  'use strict';

  const config=global.STREAMVAULT_CONFIG || global.StreamVaultConfig;
  if(!config || global.__svOfflineGuardsInstalled)return;
  global.__svOfflineGuardsInstalled=true;

  function guardFunction(name, kind){
    const original=global[name];
    if(typeof original !== 'function' || original.__svOfflineGuard)return;
    const guarded=function(){
      // Readiness is advisory. A stale offline result must never suppress the
      // real playback/live request, because that request is the fastest and
      // most authoritative recovery signal.
      const result=original.apply(this,arguments);
      if(result && typeof result.then === 'function'){
        return result.catch(async error=>{
          if(config.backendStatus?.reachable === false)await config.showOfflineMessage(kind);
          throw error;
        });
      }
      return result;
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

  // Backend links are intentionally not intercepted. Their real network
  // result decides whether offline UI is appropriate.
})(window);
