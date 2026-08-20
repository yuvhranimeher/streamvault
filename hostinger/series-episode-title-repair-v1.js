/* SV_SERIES_EPISODE_TITLE_REPAIR_V1 — restore per-episode names from catalog fields/filenames */
(function(){
  'use strict';
  if(window.__SV_SERIES_EPISODE_TITLE_REPAIR_V1)return;
  window.__SV_SERIES_EPISODE_TITLE_REPAIR_V1=true;

  function genericTitle(value, number){
    const text=String(value||'').trim();
    if(!text)return true;
    return new RegExp('^(?:episode|ep)\\s*0*'+Number(number)+'(?:\\s*[-:])?$','i').test(text)
      || /^episode\s*\d+$/i.test(text)
      || /^ep\s*\d+$/i.test(text)
      || /^s\d{1,2}e\d{1,3}$/i.test(text);
  }

  function decodeSource(value){
    let text=String(value||'').trim();
    if(!text)return '';
    try{text=decodeURIComponent(text);}catch(_){}
    try{
      const u=new URL(text,location.href);
      text=u.pathname.split('/').filter(Boolean).pop()||text;
    }catch(_){
      text=text.split(/[?#]/)[0].split('/').pop()||text;
    }
    return text;
  }

  function pretty(value){
    let text=String(value||'')
      .replace(/\.[a-z0-9]{2,5}$/i,'')
      .replace(/[._]+/g,' ')
      .replace(/\s+-\s+/g,' ')
      .replace(/\s+/g,' ')
      .trim();

    const marker=text.match(/(?:^|\s)(?:s\d{1,2}\s*e\d{1,3}|\d{1,2}\s*x\s*\d{1,3}|episode\s*\d{1,3}|ep\s*\d{1,3})(?:\s|$)/i);
    if(marker)text=text.slice((marker.index||0)+marker[0].length).trim();

    text=text
      .replace(/^[-–—: ]+/,'')
      .replace(/\[[^\]]*]/g,' ')
      .replace(/\([^)]*(?:1080|720|2160|web|bluray|x26|hevc|aac|ddp|h\.?26)[^)]*\)/gi,' ')
      .replace(/\b(?:19|20)\d{2}\b/g,' ')
      .replace(/\b(?:2160p|1080p|720p|480p|4k|uhd|hdr10?|dv|dolby\s*vision|web[- ]?dl|webrip|web|bluray|brrip|bdrip|hdrip|hdtv|remux|x264|x265|h\.?264|h\.?265|hevc|avc|aac(?:2\.0)?|ac3|eac3|ddp(?:5\.1)?|dts(?:-hd)?|10bit|8bit|multi[- ]?audio|dual[- ]?audio|nf|netflix|amzn|amazon|dsnp|proper|repack|extended|uncut|rarbg|yify|yts|psa|pahe|galaxytv)\b.*$/i,' ')
      .replace(/\b(?:2160p|1080p|720p|480p|4k|uhd|hdr10?|web[- ]?dl|webrip|bluray|brrip|bdrip|x264|x265|hevc|aac|ac3|eac3|ddp|dts|10bit|8bit)\b/gi,' ')
      .replace(/[()[\]{}]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();

    if(!text||/^\d+$/.test(text))return '';
    if(text===text.toUpperCase()||text===text.toLowerCase()){
      text=text.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())
        .replace(/\b(Of|The|A|An|And|Or|To|In|On|At|For|From|With)\b/g,(m,_,offset)=>offset===0?m:m.toLowerCase());
    }
    return text;
  }

  function episodeTitle(ep,index){
    const number=Number(ep?.episode||ep?.number||index+1)||index+1;
    for(const field of [ep?.epTitle,ep?.title,ep?.name]){
      const text=String(field||'').trim();
      if(text&&!genericTitle(text,number)){
        if(/[._]|s\d{1,2}e\d{1,3}/i.test(text)){
          const parsed=pretty(text);if(parsed&&!genericTitle(parsed,number))return parsed;
        }
        return text;
      }
    }
    const sources=[ep?.fileName,ep?.filename,ep?.file,ep?.path,ep?.streamUrl,ep?.url,ep?.src,ep?.link];
    for(const source of sources){
      const parsed=pretty(decodeSource(source));
      if(parsed&&!genericTitle(parsed,number))return parsed;
    }
    return `Episode ${number}`;
  }

  function runtimeShow(){
    try{if(typeof currentShow!=='undefined'&&currentShow)return currentShow;}catch(_){}
    try{if(typeof currentMediaModalItem!=='undefined'&&currentMediaModalItem)return currentMediaModalItem;}catch(_){}
    return null;
  }

  function seasonEpisodes(show,season){
    const seasons=show?.seasons||{};
    const raw=seasons[season]??seasons[String(season)];
    if(Array.isArray(raw))return raw;
    if(Array.isArray(raw?.episodes))return raw.episodes;
    return [];
  }

  function repair(){
    const root=document.getElementById('modalEpisodes');
    if(!root||root.style.display==='none')return;
    const show=runtimeShow();if(!show)return;
    const select=root.querySelector('select');
    let season=Number(select?.value||0);
    try{if(!season&&typeof currentSeason!=='undefined')season=Number(currentSeason)||1;}catch(_){if(!season)season=1;}
    if(!season)season=1;
    const episodes=seasonEpisodes(show,season);if(!episodes.length)return;
    const cards=[...root.querySelectorAll('.media-modal-episode')];
    episodes.forEach((ep,index)=>{
      const title=episodeTitle(ep,index);
      const number=Number(ep?.episode||ep?.number||index+1)||index+1;
      if(title&&!genericTitle(title,number)){
        if(genericTitle(ep?.name,number)||!ep?.name)ep.name=title;
        if(genericTitle(ep?.title,number)||!ep?.title)ep.title=title;
        if(genericTitle(ep?.epTitle,number)||!ep?.epTitle)ep.epTitle=title;
      }
      const node=cards[index]?.querySelector('.media-modal-episode-title');
      if(node&&node.textContent!==title)node.textContent=title;
    });
  }

  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(repair,25);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  setInterval(repair,500);
  try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});}catch(_){}
})();
