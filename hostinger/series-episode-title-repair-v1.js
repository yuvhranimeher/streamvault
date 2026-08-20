/* SV_SERIES_EPISODE_TITLE_REPAIR_V2 — V16 owns episode-title normalization */
(function(){
  'use strict';
  if(window.__SV_SERIES_EPISODE_TITLE_REPAIR_V2)return;
  window.__SV_SERIES_EPISODE_TITLE_REPAIR_V2=true;
  window.__SV_SERIES_EPISODE_TITLE_REPAIR_V1=true;

  // V16 normalizes titles before rendering and stores the clean value in
  // displayTitle/epTitle/title/name. The old repair pass decoded URLs in the
  // wrong order and could turn a good title into a percent-encoded path.
  function repair(){
    if(window.__svMediaEpisodesV16)return;
    const root=document.getElementById('modalEpisodes');
    if(!root||root.style.display==='none')return;
    let show=null;
    try{show=typeof currentShow!=='undefined'?currentShow:null;}catch(_){}
    if(!show)return;
    let season=Number(root.querySelector('select')?.value||1)||1;
    const episodes=show?.seasons?.[season]||show?.seasons?.[String(season)]||[];
    if(!Array.isArray(episodes))return;
    const cards=[...root.querySelectorAll('.media-modal-episode')];
    episodes.forEach((ep,index)=>{
      const title=String(ep?.displayTitle||ep?.epTitle||ep?.title||ep?.name||`Episode ${index+1}`).trim();
      const node=cards[index]?.querySelector('.media-modal-episode-title');
      if(node&&title&&!/%[0-9a-f]{2}/i.test(title))node.textContent=title;
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repair,{once:true});
  else repair();
})();
