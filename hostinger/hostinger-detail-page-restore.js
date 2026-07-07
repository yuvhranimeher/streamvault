(function(){
  window.API_BASE = window.API_BASE || "https://streamvault.fit";

  function cleanName(v){
    return String(v || "")
      .toLowerCase()
      .replace(/\b(tv series|series|dual audio|multi audio|hindi|english|web[- ]?dl|webrip|bluray|x264|x265|hevc|aac|esub|msubs|1080p|720p|480p)\b/g," ")
      .replace(/\((?:19|20)\d{2}[^\)]*\)/g," ")
      .replace(/\[[^\]]*\]/g," ")
      .replace(/[^\w]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function hasEpisodes(s){
    return !!(s && s.seasons && Object.values(s.seasons).some(eps=>Array.isArray(eps) && eps.length));
  }

  async function getFullSeries(show){
    if(hasEpisodes(show)) return show;

    const target = cleanName(show.name || show.title || show.file || "");
    if(!target) return show;

    const urls = [
      window.API_BASE + "/api/series?q=" + encodeURIComponent(target) + "&limit=100&massive=1",
      window.API_BASE + "/api/series"
    ];

    for(const url of urls){
      try{
        const data = await fetch(url,{cache:"no-store"}).then(r=>r.json());
        const list = Array.isArray(data) ? data : (data.series || []);
        const exact = list.find(x => cleanName(x.name || x.title || x.file || "") === target && hasEpisodes(x));
        if(exact) return exact;
      }catch(e){}
    }

    return show;
  }

  const css = document.createElement("style");
  css.textContent = `
    .series-modal.open,
    .detail-modal.open{
      position:fixed!important;
      inset:0!important;
      width:100vw!important;
      height:100vh!important;
      max-width:none!important;
      max-height:none!important;
      margin:0!important;
      border-radius:0!important;
      background:#000!important;
      z-index:99999!important;
      overflow-y:auto!important;
    }
    .series-modal.open .series-modal-inner,
    .detail-modal.open .detail-body{
      max-width:1180px!important;
      margin:0 auto!important;
    }
    body.sv-detail-page-open{overflow:hidden!important;}
  `;
  document.head.appendChild(css);

  const oldShowSeriesDetail = showSeriesDetail;
  showSeriesDetail = function(show){
    oldShowSeriesDetail(show);
    document.body.classList.add("sv-detail-page-open");
    window.scrollTo(0,0);
  };

  const oldOpenSeriesDetail = openSeriesDetail;
  openSeriesDetail = async function(key){
    try{
      const show = _seriesDetailRegistry && _seriesDetailRegistry.get(key);
      if(!show) return oldOpenSeriesDetail(key);

      showToast("Loading details...");
      const full = await getFullSeries(show);
      _seriesDetailRegistry.set(key, full);
      showSeriesDetail(full);
    }catch(e){
      console.error("[detail restore failed]", e);
      oldOpenSeriesDetail(key);
    }
  };

  const oldOpenMovieDetail = openMovieDetail;
  openMovieDetail = function(key){
    oldOpenMovieDetail(key);
    document.body.classList.add("sv-detail-page-open");
    window.scrollTo(0,0);
  };

  const oldCloseSeriesModal = closeSeriesModal;
  closeSeriesModal = function(){
    oldCloseSeriesModal();
    document.body.classList.remove("sv-detail-page-open");
  };

  const oldCloseMovieDetail = closeMovieDetail;
  closeMovieDetail = function(){
    oldCloseMovieDetail();
    document.body.classList.remove("sv-detail-page-open");
  };
})();
