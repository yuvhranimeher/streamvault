/* SV_MOVIE_PLAY_BUTTON_V10 */
(function(){
  if(window.__svMoviePlayButtonV10)return;
  window.__svMoviePlayButtonV10=true;

  function clean(value){
    return String(value||"")
      .toLowerCase()
      .replace(/\[[^\]]*]/g," ")
      .replace(/\b(?:19|20)\d{2}\b/g," ")
      .replace(/\b(2160p|1080p|720p|480p|4k|dual audio|movie)\b/g," ")
      .replace(/[^a-z0-9]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function popupOpen(){
    const modal=document.getElementById("mediaModal");
    return modal &&
      !modal.classList.contains("hidden") &&
      modal.getAttribute("aria-hidden")!=="true";
  }

  function findMovie(){
    const title=document.getElementById("modalTitle")?.textContent||"";
    const target=clean(title);

    if(
      typeof currentDetailMovie!=="undefined" &&
      currentDetailMovie &&
      clean(currentDetailMovie.name||currentDetailMovie.title)===target
    ){
      return currentDetailMovie;
    }

    const candidates=[];

    if(
      typeof _movieDetailRegistry!=="undefined" &&
      _movieDetailRegistry instanceof Map
    ){
      candidates.push(..._movieDetailRegistry.values());
    }

    if(typeof movies!=="undefined" && Array.isArray(movies)){
      candidates.push(...movies);
    }

    return candidates.find(item=>
      clean(item?.name||item?.title)===target
    )||null;
  }

  async function startMovie(movie,button){
    if(!movie||button.disabled)return;

    button.disabled=true;
    button.innerHTML="Loading…";

    try{
      currentDetailMovie=movie;

      if(typeof hydrateMoviePlayback==="function"){
        await hydrateMoviePlayback(movie);
      }

      if(
        typeof isMovieUnavailable==="function" &&
        isMovieUnavailable(movie)
      ){
        showToast("This movie is not ready to play yet");
        return;
      }

      if(typeof recordWatchHistory==="function"){
        recordWatchHistory(
          typeof movieIdentity==="function"
            ? movieIdentity(movie)
            : movie.id,
          movie.name,
          movie.genre||"",
          "movie"
        );
      }

      if(typeof closeMediaModal==="function"){
        closeMediaModal();
      }

      if(movie.streamUrl){
        playFtpMedia(movie.streamUrl,movie.name,movie.year||"");
      }else if(movie.id!==undefined && movie.id!==null){
        playMedia(movie.id,movie.name,movie.year||"");
      }else{
        showToast("No playable movie source found");
      }
    }catch(error){
      console.error("[Movie Play v10]",error);
      showToast(window.StreamVaultConfig?.backendStatus?.available === false
        ? "Playback server is currently offline."
        : "Movie playback could not start");
    }finally{
      button.disabled=false;
      button.innerHTML=
        '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>Play';
    }
  }

  function update(){
    if(!popupOpen())return;

    const meta=document.getElementById("modalMeta")?.textContent||"";
    const buttons=document.getElementById("modalButtons");

    if(!buttons)return;

    if(/\bseries\b/i.test(meta)){
      buttons.replaceChildren();
      buttons.style.display="none";
      return;
    }

    if(!/\bmovie\b/i.test(meta))return;

    const movie=findMovie();
    if(!movie)return;

    buttons.style.display="flex";

    if(!document.getElementById("svMoviePlayV10")){
      buttons.innerHTML=`
        <button id="svMoviePlayV10"
          class="sv-movie-play-v10"
          type="button">
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"></path>
          </svg>
          Play
        </button>
      `;
    }

    document.getElementById("svMoviePlayV10").onclick=function(){
      startMovie(movie,this);
    };
  }

  const style=document.createElement("style");
  style.textContent=`
    .sv-movie-play-v10{
      display:inline-flex;
      align-items:center;
      gap:9px;
      padding:13px 24px;
      border:0;
      border-radius:7px;
      background:#fff;
      color:#080808;
      font:800 15px/1 system-ui,sans-serif;
      cursor:pointer;
    }
    .sv-movie-play-v10 svg{
      width:20px;
      height:20px;
      fill:currentColor;
    }
    .sv-movie-play-v10:disabled{
      opacity:.65;
      cursor:wait;
    }
  `;
  document.head.appendChild(style);

  setInterval(update,120);
})();
