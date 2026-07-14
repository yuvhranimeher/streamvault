/* SV_MEDIA_EPISODES_V7 */
(function(){
  if(window.__svMediaEpisodesV7)return;
  window.__svMediaEpisodesV7=true;

  let activeKey="";
  let loadedKey="";
  let loadedShow=null;
  let loading=false;
  let controller=null;

  function isOpen(){
    const modal=document.getElementById("mediaModal");
    return !!modal &&
      !modal.classList.contains("hidden") &&
      modal.getAttribute("aria-hidden")!=="true";
  }

  function clean(value){
    return String(value||"")
      .toLowerCase()
      .replace(/\[[^\]]*]/g," ")
      .replace(/\b(tv series|web series|series|2160p|1080p|720p|480p|4k|dual audio|multi audio)\b/g," ")
      .replace(/\b(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?\b/g," ")
      .replace(/[^a-z0-9]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function episodeCount(show){
    return Object.values(show?.seasons||{})
      .reduce((total,episodes)=>
        total+(Array.isArray(episodes)?episodes.length:0),0
      );
  }

  function episodeNumber(ep,index){
    const value=Number(
      ep?.episode ??
      ep?.episodeNumber ??
      ep?.episode_number ??
      ep?.number
    );

    return Number.isFinite(value)&&value>0 ? value : index+1;
  }

  function storeShow(show){
    currentShow=show;

    if(!Array.isArray(series))return;

    const id=String(show?.id||"");
    const title=clean(show?.name||show?.title);

    const index=series.findIndex(item=>
      (id&&String(item?.id||"")===id) ||
      clean(item?.name||item?.title)===title
    );

    if(index>=0)series[index]=show;
    else series.push(show);
  }

  function play(show,season,index){
    storeShow(show);
    currentSeason=season;

    if(typeof closeMediaModal==="function"){
      closeMediaModal();
    }

    setTimeout(()=>{
      playSeriesEpisode(show.name,season,index);
    },50);
  }

  function renderSeason(show,season){
    const grid=document.getElementById("svEpisodeGridV7");
    if(!grid)return;

    const episodes=show.seasons?.[season]||[];

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
      card.tabIndex=0;
      card.setAttribute("role","button");

      card.innerHTML=`
        <div class="ep-thumb">
          ${thumb?`<img class="ep-thumb-img" src="${thumb}" alt="" loading="lazy">`:""}
          <div class="ep-thumb-play">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M8 5v14l11-7z"></path>
            </svg>
          </div>
        </div>
        <div class="ep-info">
          <div class="ep-num-label">Episode ${number}</div>
          <div class="ep-title">${title}</div>
          ${overview?`<div class="ep-overview">${overview}</div>`:""}
        </div>
      `;

      card.onclick=()=>play(show,season,index);
      card.onkeydown=event=>{
        if(event.key==="Enter"||event.key===" "){
          event.preventDefault();
          play(show,season,index);
        }
      };

      grid.appendChild(card);
    });
  }

  function render(show){
    const root=document.getElementById("modalEpisodes");
    if(!root)return;

    const seasons=Object.keys(show.seasons||{})
      .map(Number)
      .filter(Number.isFinite)
      .sort((a,b)=>a-b);

    if(!seasons.length){
      root.innerHTML=
        '<h2 class="media-modal-heading">Episodes</h2>'+
        '<div class="no-data">No episodes available</div>';
      return;
    }

    root.innerHTML=`
      <div data-sv-episodes-v7="1">
        <h2 class="media-modal-heading">Episodes</h2>
        <select id="svSeasonSelectV7"
          style="margin-bottom:18px;background:#202124;color:#fff;border:1px solid #555;border-radius:7px;padding:12px 16px;font-weight:700">
          ${seasons.map(season=>
            `<option value="${season}">Season ${season}</option>`
          ).join("")}
        </select>
        <div class="ep-grid" id="svEpisodeGridV7"></div>
      </div>
    `;

    const select=document.getElementById("svSeasonSelectV7");

    select.onchange=()=>{
      renderSeason(show,Number(select.value));
    };

    renderSeason(show,seasons[0]);

    const buttons=document.getElementById("modalButtons");

    if(buttons){
      buttons.innerHTML=
        '<button id="svSeriesPlayV7" class="play-btn" type="button">Play</button>';

      document.getElementById("svSeriesPlayV7").onclick=()=>{
        play(show,seasons[0],0);
      };
    }
  }

  async function loadSeries(key,title,year){
    loading=true;
    activeKey=key;

    if(controller)controller.abort();
    controller=new AbortController();

    const timeout=setTimeout(()=>controller.abort(),20000);

    const root=document.getElementById("modalEpisodes");

    if(root){
      root.innerHTML=
        '<h2 class="media-modal-heading">Episodes</h2>'+
        '<div class="no-data">Loading episodes...</div>';
    }

    try{
      const params=new URLSearchParams({name:title});

      if(year)params.set("year",year);

      const response=await fetch(
        "/api/series/detail?"+params.toString(),
        {
          cache:"no-store",
          signal:controller.signal
        }
      );

      if(!response.ok)throw new Error("HTTP "+response.status);

      const payload=await response.json();
      const show=window.StreamVaultConfig?.normalizeBackendUrls?.(payload) ?? payload;

      if(activeKey!==key||!isOpen())return;
      if(!episodeCount(show))throw new Error("No episodes returned");

      loadedKey=key;
      loadedShow=show;
      loading=false;

      storeShow(show);
      render(show);
    }catch(error){
      if(activeKey!==key)return;

      loading=false;

      if(root){
        root.innerHTML=
          '<h2 class="media-modal-heading">Episodes</h2>'+
          '<div class="no-data">Could not load episodes</div>';
      }

      console.warn("[Episodes v7]",error);
    }finally{
      clearTimeout(timeout);
    }
  }

  function check(){
    if(!isOpen()){
      activeKey="";
      loading=false;
      return;
    }

    const title=document.getElementById("modalTitle")
      ?.textContent?.trim()||"";

    const context=[
      title,
      document.getElementById("modalMeta")?.textContent||"",
      document.getElementById("modalExtraInfo")?.textContent||""
    ].join(" ");

    if(!title||!/\b(series|season|tv series)\b/i.test(context))return;

    const year=context.match(/\b(?:19|20)\d{2}\b/)?.[0]||"";
    const key=title+"|"+year;

    if(loadedKey===key&&loadedShow){
      if(!document.querySelector("[data-sv-episodes-v7]")){
        render(loadedShow);
      }
      return;
    }

    if(!loading||activeKey!==key){
      loadSeries(key,title,year);
    }
  }

  setInterval(check,350);
})();
