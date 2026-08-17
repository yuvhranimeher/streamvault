(function(){
  'use strict';

  function removeRetiredUi(){
    try{
      document.getElementById('fifaLiveRoot')?.remove();
      document.querySelectorAll('.sv-fifa-hero,.fifa-live-section,#bnLiveMatch,.bn-live-match').forEach(el=>el.remove());
      document.querySelectorAll('button,a').forEach(el=>{
        const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
        if(text==='LIVE MATCH')el.remove();
      });
      const liveTv=document.getElementById('livetvNavBtn');
      if(liveTv && /live\s*match/i.test(liveTv.textContent || '')){
        liveTv.innerHTML='<span class="livetv-btn-dot"></span><span>Live TV</span>';
        liveTv.setAttribute('onclick',"switchTab('live')");
      }
      document.documentElement.classList.remove('sv-fifa-match-live');
    }catch(_){ }
  }

  removeRetiredUi();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeRetiredUi,{once:true});
  window.addEventListener('load',removeRetiredUi,{once:true});
  const observer=new MutationObserver(removeRetiredUi);
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setTimeout(()=>{try{observer.disconnect();}catch(_){ }},30000);
  try{localStorage.removeItem('streamvault:fifa-live:last-real:v1');}catch(_){ }
  window.__SV_FIFA_UI_REMOVED=true;
})();
