(function(){
  const svOriginalClosePlayer = closePlayer;
  closePlayer = function(){
    svOriginalClosePlayer();
    if(vid){
      vid.removeAttribute('src');
      try{ vid.load(); }catch{}
    }
    if(currentTab !== 'discover')return;
    const idle = window.requestIdleCallback || (fn=>setTimeout(fn,120));
    idle(()=>{
      const continueRow = document.getElementById('continueRow');
      if(continueRow && continueRow.style.display !== 'none')svUpdateCarouselControls(continueRow);
    });
  };

  const svOriginalStartHeroTimer = startHeroTimer;
  startHeroTimer = function(){
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    svOriginalStartHeroTimer();
  };
})();
