/* SV_MODAL_SCROLL_PRESERVE_V1 — keep the page at the exact media-card position after closing details */
(function(){
  'use strict';
  if(window.__SV_MODAL_SCROLL_PRESERVE_V1)return;
  window.__SV_MODAL_SCROLL_PRESERVE_V1=true;

  let savedX=0;
  let savedY=0;
  let hasSavedPosition=false;
  let wrapped=false;
  let clearTimer=0;

  function mediaModalOpen(){
    const modal=document.getElementById('mediaModal');
    return !!modal && !modal.classList.contains('hidden') && modal.getAttribute('aria-hidden')!=='true';
  }

  function legacyDetailOpen(){
    const modal=document.getElementById('movieDetailModal');
    return !!modal && modal.classList.contains('open');
  }

  function anyDetailOpen(){
    return mediaModalOpen() || legacyDetailOpen();
  }

  function capturePagePosition(){
    // Never replace the original page position while switching content inside
    // an already-open details modal.
    if(anyDetailOpen() && hasSavedPosition)return;
    savedX=window.scrollX || window.pageXOffset || 0;
    savedY=window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    hasSavedPosition=true;
    if(clearTimer){clearTimeout(clearTimer);clearTimer=0;}
  }

  function restoreOnce(){
    if(!hasSavedPosition || anyDetailOpen())return false;
    try{window.scrollTo(savedX,savedY);}catch(_error){
      try{document.documentElement.scrollTop=savedY;document.body.scrollTop=savedY;}catch(_ignore){}
    }
    return true;
  }

  function restoreSequence(){
    if(!hasSavedPosition)return;
    // history.back(), body overflow restoration, layout reflow and browser
    // history scroll restoration can happen on different frames. Re-apply the
    // saved position across that short window so none of them can jump to top.
    const delays=[0,16,50,120,250,500];
    delays.forEach(delay=>setTimeout(restoreOnce,delay));
    if(clearTimer)clearTimeout(clearTimer);
    clearTimer=setTimeout(()=>{
      if(!anyDetailOpen())hasSavedPosition=false;
      clearTimer=0;
    },900);
  }

  function wrapFunctions(){
    if(wrapped)return true;
    if(typeof window.openMediaModal!=='function' || typeof window.closeMediaModal!=='function')return false;

    const originalOpenMediaModal=window.openMediaModal;
    const originalCloseMediaModal=window.closeMediaModal;

    window.openMediaModal=function(){
      if(!mediaModalOpen())capturePagePosition();
      return originalOpenMediaModal.apply(this,arguments);
    };

    window.closeMediaModal=function(){
      const result=originalCloseMediaModal.apply(this,arguments);
      restoreSequence();
      return result;
    };

    if(typeof window.openMovieDetail==='function'){
      const originalOpenMovieDetail=window.openMovieDetail;
      window.openMovieDetail=function(){
        if(!anyDetailOpen())capturePagePosition();
        return originalOpenMovieDetail.apply(this,arguments);
      };
    }

    if(typeof window.closeMovieDetail==='function'){
      const originalCloseMovieDetail=window.closeMovieDetail;
      window.closeMovieDetail=function(){
        const result=originalCloseMovieDetail.apply(this,arguments);
        restoreSequence();
        return result;
      };
    }

    wrapped=true;
    return true;
  }

  // Covers history.back() driven closing used by the desktop details modal.
  window.addEventListener('popstate',()=>setTimeout(restoreSequence,0));

  // Covers any other code path that hides/removes the modal without calling
  // the public close function.
  const observer=new MutationObserver(()=>{
    if(hasSavedPosition && !anyDetailOpen())restoreSequence();
  });

  function start(){
    wrapFunctions();
    const media=document.getElementById('mediaModal');
    const legacy=document.getElementById('movieDetailModal');
    if(media)observer.observe(media,{attributes:true,attributeFilter:['class','aria-hidden']});
    if(legacy)observer.observe(legacy,{attributes:true,attributeFilter:['class','aria-hidden']});

    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(wrapFunctions() || attempts>80)clearInterval(timer);
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
