(function(){
  async function forceRenderHome(){
    try{
      if(!window.API_BASE) window.API_BASE = "https://streamvault.fit";
      const main = document.getElementById("mainSection");
      if(!main) return;

      const data = await fetch(window.API_BASE + "/api/home-feed?limit=24", { cache:"no-store" }).then(r=>r.json());
      const rows = Array.isArray(data.rows) ? data.rows : [];

      rows.forEach(row=>{
        if(!row || !Array.isArray(row.items) || !row.items.length) return;

        const rowId = row.rowId || (row.sectionKey + "Row");
        const trackId = row.trackId || rowId.replace(/Row$/, "Track");

        let rowEl = document.getElementById(rowId);
        if(!rowEl){
          rowEl = document.createElement("div");
          rowEl.className = "row";
          rowEl.id = rowId;
          rowEl.innerHTML = '<div class="row-header"><div class="row-title">' + (row.title || row.sectionKey || "Movies") + '</div></div><div class="cards-track" id="' + trackId + '"></div>';
          main.appendChild(rowEl);
        }

        let track = document.getElementById(trackId);
        if(!track){
          track = document.createElement("div");
          track.className = "cards-track";
          track.id = trackId;
          rowEl.appendChild(track);
        }

        track.innerHTML = row.items.map(item=>{
          const isSeries = item.type === "tv" || item.type === "series" || item.isSummary || item.seasons;
          return isSeries && typeof sCardHTML === "function" ? sCardHTML(item) : cardHTML(item);
        }).join("");

        rowEl.style.display = "";
      });
    }catch(e){
      console.error("[Hostinger home force render failed]", e);
    }
  }

  window.addEventListener("load", ()=>setTimeout(forceRenderHome, 800));
})();
