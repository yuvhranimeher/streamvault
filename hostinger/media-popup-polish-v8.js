/* SV_MEDIA_POPUP_POLISH_V8 */
(function(){
  if(window.__svMediaPopupPolishV8)return;
  window.__svMediaPopupPolishV8=true;

  let pendingPoster="";
  let posterToken=0;

  function seriesPopup(){
    const context=[
      document.getElementById("modalTitle")?.textContent||"",
      document.getElementById("modalMeta")?.textContent||"",
      document.getElementById("modalExtraInfo")?.textContent||""
    ].join(" ");

    return /\b(series|season|tv series)\b/i.test(context);
  }

  function safeCssUrl(src){
    return 'url("' +
      String(src||"").replace(/["\\\r\n]/g,"\\$&") +
      '")';
  }

  function applyPosterImmediately(src){
    if(!src)return;

    pendingPoster=src;
    const token=++posterToken;

    const preview=document.getElementById("modalPreview");
    const hero=document.querySelector("#mediaModal .modal-hero");

    if(preview){
      preview.poster=src;
      preview.setAttribute("poster",src);
      preview.style.backgroundImage=safeCssUrl(src);
      preview.style.backgroundSize="cover";
      preview.style.backgroundPosition="center";
    }

    if(hero){
      hero.style.backgroundImage=safeCssUrl(src);
      hero.style.backgroundSize="cover";
      hero.style.backgroundPosition="center";
    }

    // Protect the clicked title poster briefly from an older async response.
    const protect=setInterval(()=>{
      if(token!==posterToken){
        clearInterval(protect);
        return;
      }

      if(preview && preview.getAttribute("poster")!==src){
        preview.poster=src;
      }
    },40);

    setTimeout(()=>clearInterval(protect),900);
  }

  function clickedPoster(target){
    const card=target.closest(
      '.card,.media-card,.search-card,' +
      '[onclick*="openSeriesDetail"],' +
      '[onclick*="openMovieDetail"]'
    );

    if(!card)return "";

    const image=card.querySelector("img");

    return (
      image?.currentSrc ||
      image?.getAttribute("src") ||
      image?.dataset?.svSrc ||
      ""
    );
  }

  // Runs before the existing onclick, using the already-loaded card image.
  document.addEventListener("pointerdown",event=>{
    const src=clickedPoster(event.target);
    if(src)applyPosterImmediately(src);
  },true);

  document.addEventListener("click",event=>{
    const src=clickedPoster(event.target);
    if(src)applyPosterImmediately(src);
  },true);

  function fixPopupLayout(){
    const modal=document.getElementById("mediaModal");
    if(!modal)return;

    if(
      modal.classList.contains("hidden") ||
      modal.getAttribute("aria-hidden")==="true"
    ){
      return;
    }

    const isSeries=seriesPopup();
    modal.classList.toggle("sv-series-popup-v8",isSeries);

    if(!isSeries)return;

    const info=modal.querySelector(".modal-info");
    const episodes=document.getElementById("modalEpisodes");
    const details=document.getElementById("modalExtraInfo");
    const buttons=document.getElementById("modalButtons");

    // About → Episodes → Details → More Like This
    if(info && episodes && details && episodes.nextElementSibling!==details){
      info.insertBefore(episodes,details);
    }

    // Remove the small Play button from the poster area.
    if(buttons){
      buttons.replaceChildren();
      buttons.style.display="none";
    }

    if(pendingPoster){
      const preview=document.getElementById("modalPreview");

      if(preview && !preview.getAttribute("poster")){
        preview.poster=pendingPoster;
      }
    }
  }

  const style=document.createElement("style");
  style.textContent=`
    #mediaModal.sv-series-popup-v8 #modalButtons{
      display:none!important;
    }

    #mediaModal.sv-series-popup-v8 #modalEpisodes{
      margin-top:0;
      padding-top:0;
    }

    #mediaModal.sv-series-popup-v8 #modalExtraInfo{
      margin-top:28px;
    }

    #mediaModal .modal-hero,
    #mediaModal #modalPreview{
      background-size:cover;
      background-position:center;
      background-repeat:no-repeat;
    }
  `;

  document.head.appendChild(style);

  setInterval(fixPopupLayout,120);
})();