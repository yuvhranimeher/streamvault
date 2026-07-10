/* SV_ACTIVE_MEDIA_MODAL_EPISODES_V6 */
(function(){
  if(window.__svActiveMediaModalEpisodesV6)return;
  window.__svActiveMediaModalEpisodesV6=true;

  let timer=0;
  let requestId=0;
  let loadedKey="";
  let loadedShow=null;

  const escHtml=value=>String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");

  function modalIsOpen(){
    const modal=document.getElementById("mediaModal");
    if(!modal)return false;

    return !modal.classList.contains("hidden") &&
      modal.getAttribute("aria-hidden")!=="true";
  }

  function cleanTitle(value){
    return String(value||"")
      .toLowerCase()
      .replace(/\[[^\]]*]/g," ")
      .replace(/\b(tv series|web series|series|2160p|1080p|720p|480p|4k|dual audio|multi audio)\b/g," ")
      .replace(/\b(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?\b/g," ")
      .replace(/[^a-z0-9]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function episodeNumber(ep,index){
    const direct=Number(
      ep?.episode ??
      ep?.episodeNumber ??
      ep?.episode_number ??
      ep?.number
    );

    if(Number.isFinite(direct)&&direct>0)return direct;

    const text=String(ep?.filename||ep?.name||ep?.title||"");
    const match=text.match(/S\d{1,2}E(\d{1,3})/i) ||
      text.match(/\bE(\d{1,3})\b/i);

    return match?Number(match[1]):index+1;
  }

  function normalizeSeasons(show){
    const output={};
    const raw=show?.seasons||{};

    if(Array.isArray(raw)){
      raw.forEach((entry,index)=>{
        if(!entry)return;

        const seasonMatch=String(
          entry?.season ??
          entry?.seasonNumber ??
          entry?.season_number ??
          entry?.name ??
          index+1
        ).match(/\d+/);

        const season=seasonMatch?Number(seasonMatch[0]):index+1;
        const episodes=Array.isArray(entry)
          ? entry
          : Array.isArray(entry?.episodes)
            ? entry.episodes
            : [];

        if(episodes.length)output[season]=episodes;
      });
    }else{
      Object.entries(raw).forEach(([key,value],index)=>{
        const seasonMatch=String(
          value?.season ??
          value?.seasonNumber ??
          value?.season_number ??
          key
        ).match(/\d+/);

        const season=seasonMatch?Number(seasonMatch[0]):index+1;
        const episodes=Array.isArray(value)
          ? value
          : Array.isArray(value?.episodes)
            ? value.episodes
            : [];

        if(episodes.length)output[season]=episodes;
      });
    }

    return output;
  }

  function savePlayableShow(show){
    currentShow=show;

    if(!Array.isArray(series))return;

    const id=String(show.id||"");
    const title=cleanTitle(show.name||show.title);

    const index=series.findIndex(item=>
      (id&&String(item?.id||"")===id) ||
      cleanTitle(item?.name||item?.title)===title
    );

    if(index>=0)series[index]=show;
    else series.push(show);
  }

  function playEpisode(show,season,index){
    savePlayableShow(show);
    currentSeason=season;

    if(typeof closeMediaModal==="function"){
      closeMediaModal();
    }

    setTimeout(()=>{
      playSeriesEpisode(show.name,season,index);
    },30);
  }

  function renderSeason(show,season){
    const grid=document.getElementById("svFinalEpisodeGrid");
    if(!grid)return;

    const episodes=show.seasons?.[season]||[];

    if(!episodes.length){
      grid.innerHTML='<div class="no-data">No episodes available</div>';
      return;
    }

    grid.innerHTML="";

    episodes.forEach((ep,index)=>{
      const number=episodeNumber(ep,index);
      const title=
        ep?.epTitle ||
        ep?.title ||
        ep?.name ||
        `Episode ${number}`;

      const overview=
        ep?.overview ||
        ep?.description ||
        ep?.synopsis ||
        "";

      const thumb=
        ep?.thumb ||
        ep?.thumbnail ||
        ep?.poster ||
        show.backdrop ||
        show.poster ||
        "";

      const card=document.createElement("div");
      card.className="ep-card";
      card.setAttribute("role","button");
      card.tabIndex=0;

      card.innerHTML=`
        <div class="ep-thumb">
          ${thumb?`<img class="ep-thumb-img" src="${escHtml(thumb)}" alt="" loading="lazy">`:""}
          <div class="ep-thumb-play">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M8 5v14l11-7z"></path>
            </svg>
          </div>
        </div>
        <div class="ep-info">
          <div class="ep-num-label">Episode ${number}</div>
          <div class="ep-title">${escHtml(title)}</div>
          ${overview?`<div class="ep-overview">${escHtml(overview)}</div>`:""}
        </div>
      `;

      card.onclick=()=>playEpisode(show,season,index);
      card.onkeydown=event=>{
        if(event.key==="Enter"||event.key===" "){
          event.preventDefault();
          playEpisode(show,season,index);
        }
      };

      grid.appendChild(card);
    });
  }

  function renderEpisodes(show){
    const root=document.getElementById("modalEpisodes");
    if(!root)return;

    const seasons=Object.keys(show.seasons||{})
      .map(Number)
      .filter(Number.isFinite)
      .sort((a,b)=>a-b);

    if(!seasons.length){
      root.innerHTML='<h2 class="media-modal-heading">Episodes</h2><div class="no-data">No episodes available</div>';
      return;
    }

    root.dataset.svFinalEpisodes="1";

    root.innerHTML=`
      <h2 class="media-modal-heading">Episodes</h2>
      <div style="margin:0 0 18px">
        <select id="svFinalSeasonSelect"
          style="background:#202124;color:#fff;border:1px solid #555;border-radius:7px;padding:12px 16px;font-weight:700">
          ${seasons.map(season=>
            `<option value="${season}">Season ${season}</option>`
          ).join("")}
        </select>
      </div>
      <div class="ep-grid" id="svFinalEpisodeGrid"></div>
    `;

    const select=document.getElementById("svFinalSeasonSelect");

    select.onchange=()=>{
      renderSeason(show,Number(select.value));
    };

    renderSeason(show,seasons[0]);

    const buttons=document.getElementById("modalButtons");
    const firstSeason=seasons[0];
    const firstEpisode=show.seasons[firstSeason]?.[0];

    if(buttons&&firstEpisode){
      buttons.innerHTML=`
        <button id="svFinalSeriesPlay"
          style="border:0;border-radius:6px;padding:13px 22px;font-weight:800;cursor:pointer">
          Play
        </button>
      `;

      document.getElementById("svFinalSeriesPlay").onclick=()=>{
        playEpisode(show,firstSeason,0);
      };
    }
  }

  async function hydrate(){
    if(!modalIsOpen())return;

    const title=document.getElementById("modalTitle")
      ?.textContent?.trim()||"";

    if(!title)return;

    const context=[
      title,
      document.getElementById("modalMeta")?.textContent||"",
      document.getElementById("modalExtraInfo")?.textContent||""
    ].join(" ");

    if(!/\b(series|seasons?|tv series)\b/i.test(context))return;

    const year=context.match(/\b(?:19|20)\d{2}\b/)?.[0]||"";
    const key=`${title}|${year}`;

    if(loadedKey===key&&loadedShow){
      const root=document.getElementById("modalEpisodes");

      if(!root?.querySelector("#svFinalEpisodeGrid")){
        renderEpisodes(loadedShow);
      }

      return;
    }

    const current=++requestId;
    const root=document.getElementById("modalEpisodes");

    if(root){
      root.innerHTML='<h2 class="media-modal-heading">Episodes</h2><div class="no-data">Loading episodes...</div>';
    }

    try{
      const params=new URLSearchParams({name:title});
      if(year)params.set("year",year);

      const response=await fetch(
        `/api/series/detail?${params.toString()}`,
        {cache:"no-store"}
      );

      if(!response.ok)throw new Error(`HTTP ${response.status}`);

      const full=await response.json();
      full.seasons=normalizeSeasons(full);

      const count=Object.values(full.seasons)
        .reduce((total,episodes)=>total+episodes.length,0);

      if(current!==requestId||!modalIsOpen())return;
      if(!count)throw new Error("No playable episodes returned");

      loadedKey=key;
      loadedShow=full;

      savePlayableShow(full);
      renderEpisodes(full);
    }catch(error){
      console.warn("[Active modal episodes v6]",error);
      if(root){
        root.innerHTML='<h2 class="media-modal-heading">Episodes</h2><div class="no-data">No episodes available</div>';
      }
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(hydrate,80);
  }

  const modal=document.getElementById("mediaModal");

  if(modal){
    new MutationObserver(schedule).observe(modal,{
      attributes:true,
      subtree:true,
      childList:true,
      characterData:true
    });
  }

  document.addEventListener("click",schedule,true);
})();