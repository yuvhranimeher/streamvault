(function(){
  window.API_BASE = window.API_BASE || "https://streamvault.fit";

  function cleanTitle(v){
    return String(v || "")
      .toLowerCase()
      .replace(/\b(tv series|series|dual audio|multi audio|hindi|english|web[- ]?dl|webrip|bluray|x264|x265|hevc|aac|esub|msubs|1080p|720p|480p)\b/gi, " ")
      .replace(/\((?:19|20)\d{2}[^\)]*\)/g, " ")
      .replace(/\[(.*?)\]/g, " ")
      .replace(/[^\w]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasEpisodes(s){
    return s && s.seasons && Object.values(s.seasons).some(eps => Array.isArray(eps) && eps.length);
  }

  async function fetchSeriesCandidates(show){
    const q = cleanTitle(show.name || show.title || show.file || "");
    const urls = [
      window.API_BASE + "/api/series?q=" + encodeURIComponent(q) + "&limit=80",
      window.API_BASE + "/api/series"
    ];

    for(const url of urls){
      try{
        const r = await fetch(url, { cache:"no-store" });
        const d = await r.json();
        const list = Array.isArray(d) ? d : (Array.isArray(d.series) ? d.series : []);
        if(list.length) return list;
      }catch(e){}
    }
    return [];
  }

  function findExact(show, list){
    const sid = String(show.id || "");
    const stmdb = String(show.tmdbId || "");
    const sname = cleanTitle(show.name || show.title || show.file || "");

    return list.find(x => sid && String(x.id || "") === sid)
      || list.find(x => stmdb && String(x.tmdbId || "") === stmdb)
      || list.find(x => cleanTitle(x.name || x.title || x.file || "") === sname)
      || list.find(x => {
          const xn = cleanTitle(x.name || x.title || x.file || "");
          return sname && xn && (xn.includes(sname) || sname.includes(xn));
        });
  }

  const oldOpenSeriesDetail = typeof openSeriesDetail === "function" ? openSeriesDetail : null;

  openSeriesDetail = async function(key){
    try{
      const show = _seriesDetailRegistry && _seriesDetailRegistry.get(key);
      if(!show){
        if(oldOpenSeriesDetail) return oldOpenSeriesDetail(key);
        return;
      }

      if(hasEpisodes(show)){
        showSeriesDetail(show);
        return;
      }

      showToast("Loading episodes...");
      const list = await fetchSeriesCandidates(show);
      const full = findExact(show, list);

      if(full && cleanTitle(full.name || full.title || full.file) === cleanTitle(show.name || show.title || show.file)){
        _seriesDetailRegistry.set(key, full);
        showSeriesDetail(full);
        return;
      }

      showSeriesDetail(show);
    }catch(e){
      console.error("[series detail fix failed]", e);
      if(oldOpenSeriesDetail) return oldOpenSeriesDetail(key);
    }
  };
})();
