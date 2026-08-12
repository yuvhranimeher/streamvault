/* SV_MOVIE_PLAY_BUTTON_V10 */
(function(){
  if(window.__svMoviePlayButtonV10)return;
  window.__svMoviePlayButtonV10=true;

  const MOBILE_SOURCE_INDEX_URL='/mobile-source-index.json?v=20260812-v1';
  let mobileSourceIndexPromise=null;

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

  function isAndroidClient(){
    return /Android/i.test(navigator.userAgent||'');
  }

  function loadMobileSourceIndex(){
    if(mobileSourceIndexPromise)return mobileSourceIndexPromise;
    mobileSourceIndexPromise=fetch(MOBILE_SOURCE_INDEX_URL,{
      cache:'no-cache',
      headers:{Accept:'application/json'}
    }).then(response=>{
      if(!response.ok)throw new Error(`mobile source index HTTP ${response.status}`);
      return response.json();
    }).catch(error=>{
      console.warn('[Mobile Source Selector] index unavailable:',error);
      return {movies:{}};
    });
    return mobileSourceIndexPromise;
  }

  function sourceScore(source){
    const url=String(source?.url||'');
    const decoded=(()=>{try{return decodeURIComponent(url);}catch{return url;}})().toLowerCase();
    let score=0;
    if(/^https:\/\//i.test(url))score+=1000;
    else score-=1000;
    if(/\.(?:mp4|m4v)(?:$|[?#])/i.test(url))score+=900;
    if(/\b(?:h264|x264|avc)\b/i.test(decoded)||String(source?.videoCodec||'').toLowerCase()==='h264')score+=250;
    if(/\baac\b/i.test(decoded)||String(source?.audioCodec||'').toLowerCase()==='aac')score+=150;
    if(source?.range206===true)score+=200;
    if(source?.androidChromeVerified===true)score+=500;
    if(/\.(?:mkv|webm|avi)(?:$|[?#])/i.test(url))score-=1200;
    if(/\b(?:x265|h265|hevc|10bit|10-bit)\b/i.test(decoded))score-=900;
    if(/\b(?:ac3|eac3|dts|truehd)\b/i.test(decoded))score-=300;
    return score;
  }

  async function applyAndroidDirectSource(movie){
    if(!isAndroidClient()||!movie)return movie;

    const index=await loadMobileSourceIndex();
    const key=clean(movie.name||movie.title||movie.file||'');
    const variants=Array.isArray(index?.movies?.[key])?index.movies[key]:[];
    if(!variants.length)return movie;

    const best=variants
      .filter(source=>source&&typeof source.url==='string')
      .slice()
      .sort((a,b)=>sourceScore(b)-sourceScore(a))[0];

    if(!best?.url||sourceScore(best)<1000)return movie;

    const previous=movie.streamUrl||'';
    movie._svOriginalStreamUrl=previous;
    movie.streamUrl=best.url;
    movie.isFtp=true;
    movie.hasStream=true;
    movie.streamAvailable=true;
    movie._svAndroidDirectSource=true;
    movie._svAndroidDirectSourceScore=sourceScore(best);

    console.info('[Mobile Source Selector] Android direct source selected',{
      title:movie.name||movie.title||'',
      previous,
      selected:best.url,
      score:movie._svAndroidDirectSourceScore
    });
    return movie;
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
      await applyAndroidDirectSource(movie);
      currentDetailMovie=movie;

      if(typeof svLaunchMediaModalMovie==="function"){
        await svLaunchMediaModalMovie(movie);
      }else{
        throw new Error("Modern modal playback launcher unavailable");
      }
    }catch(error){
      console.error("[Movie Play v10]",error);
      if(window.StreamVaultConfig?.backendStatus?.available === false){
        const message=await window.StreamVaultConfig.showOfflineMessage("playback");
        if(!message)showToast("Movie playback could not start");
      }else{
        showToast("Movie playback could not start");
      }
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
