(function(){
  'use strict';

  // FIFA UI has been retired from the frontend.
  // Keep this already-referenced asset as a tiny synchronous cleanup shim so
  // old cached index.html files cannot resurrect the section or LIVE MATCH UI.
  const removeRetiredUi=()=>{
    document.getElementById('fifaLiveRoot')?.remove();
    document.querySelector('.sv-fifa-hero')?.remove();
    document.getElementById('bnLiveMatch')?.remove();
    document.querySelectorAll('.bn-live-match').forEach(el=>el.remove());

    // Preserve the normal Live TV control if any older FIFA code changed its label.
    const liveTv=document.getElementById('livetvNavBtn');
    if(liveTv && /live\s*match/i.test(liveTv.textContent || '')){
      liveTv.innerHTML='<span class="livetv-btn-dot"></span><span>Live TV</span>';
      liveTv.setAttribute('onclick',"switchTab('live')");
    }

    document.documentElement.classList.remove('sv-fifa-match-live');
  };

  removeRetiredUi();

  const observer=new MutationObserver(()=>removeRetiredUi());
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});

  // Stop observing once the page has finished constructing its static UI.
  window.addEventListener('load',()=>{
    removeRetiredUi();
    setTimeout(()=>observer.disconnect(),2000);
  },{once:true});

  try{
    localStorage.removeItem('streamvault:fifa-live:last-real:v1');
  }catch(_){ }

  window.__SV_FIFA_UI_REMOVED=true;
})();
