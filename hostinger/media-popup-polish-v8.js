/* SV_MEDIA_POPUP_POLISH_V8 */
(function(){
  if(window.__svMediaPopupPolishV8)return;
  window.__svMediaPopupPolishV8=true;

  function seriesPopup(){
    const context=[
      document.getElementById("modalTitle")?.textContent||"",
      document.getElementById("modalMeta")?.textContent||"",
      document.getElementById("modalExtraInfo")?.textContent||""
    ].join(" ");

    return /\b(series|season|tv series)\b/i.test(context);
  }

  function applyPosterImmediately(src){
    if(!src)return;
    window.svCaptureModalArtworkPreview?.(src);
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

  `;

  document.head.appendChild(style);

  setInterval(fixPopupLayout,120);
})();
