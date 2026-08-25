const fs = require('fs');

function files(list){ return list.filter(f => fs.existsSync(f)); }
function backup(file){ fs.copyFileSync(file, file + ".bak-instant-smooth-" + Date.now()); }
function patchFile(file, fn){
  let s = fs.readFileSync(file,'utf8').replace(/\r\n/g,"\n");
  const before = s;
  backup(file);
  s = fn(s, file);
  fs.writeFileSync(file, s, 'utf8');
  console.log("patched", file, before.length, "->", s.length);
}

patchFile("server.js", s => {
  s = s.replace(/const MOBILE_HLS_IDLE_MS = Number\(process\.env\.MOBILE_HLS_IDLE_MS \|\| [^)]+\);/, "const MOBILE_HLS_IDLE_MS = Number(process.env.MOBILE_HLS_IDLE_MS || 900000);");
  s = s.replace(/const MOBILE_HLS_MAX_SESSIONS = Number\(process\.env\.MOBILE_HLS_MAX_SESSIONS \|\| [^)]+\);/, "const MOBILE_HLS_MAX_SESSIONS = Number(process.env.MOBILE_HLS_MAX_SESSIONS || 6);");
  s = s.replace(/const HEAVY_COMPAT_HLS_STARTUP_SEGMENTS = Math\.max\([^;]+;/, "const HEAVY_COMPAT_HLS_STARTUP_SEGMENTS = 1;");
  s = s.replace(/const HEAVY_COMPAT_HLS_SEGMENT_TIME = Math\.max\([^;]+;/, "const HEAVY_COMPAT_HLS_SEGMENT_TIME = 2;");
  s = s.replace(/const HEAVY_COMPAT_HLS_VIDEO_MAXRATE = String\(process\.env\.HEAVY_COMPAT_HLS_VIDEO_MAXRATE \|\| '[^']+'\);/, "const HEAVY_COMPAT_HLS_VIDEO_MAXRATE = String(process.env.HEAVY_COMPAT_HLS_VIDEO_MAXRATE || '2500k');");
  s = s.replace(/const HEAVY_COMPAT_HLS_VIDEO_BUFSIZE = String\(process\.env\.HEAVY_COMPAT_HLS_VIDEO_BUFSIZE \|\| '[^']+'\);/, "const HEAVY_COMPAT_HLS_VIDEO_BUFSIZE = String(process.env.HEAVY_COMPAT_HLS_VIDEO_BUFSIZE || '5000k');");
  s = s.replace(/const MEDIA_FFMPEG_STREAM_MAX = Number\(process\.env\.MEDIA_FFMPEG_STREAM_MAX \|\| [^)]+\);/, "const MEDIA_FFMPEG_STREAM_MAX = Number(process.env.MEDIA_FFMPEG_STREAM_MAX || 5);");

  s = s.replace(/readySegments\.length >= 2/g, "readySegments.length >= 1");
  s = s.replace(/'-hls_time', '4', '-hls_list_size', '8'/g, "'-hls_time', '2', '-hls_list_size', '12'");
  s = s.replace(/'-hls_time', '3'/g, "'-hls_time', '2'");
  s = s.replace(/waitForHlsPlaylist\(playlistPath, 15000/g, "waitForHlsPlaylist(playlistPath, 9000");

  if(!s.includes("SV_INSTANT_LIVE_PREWARM_PATCH")){
    s += `

/* SV_INSTANT_LIVE_PREWARM_PATCH */
setTimeout(() => {
  try {
    if (typeof svEnsureLiveRelay === 'function') {
      ['tsports','shomoy','jamuna','channel24'].forEach(id => {
        try { svEnsureLiveRelay(id); } catch {}
      });
    }
  } catch {}
}, 2500);
`;
  }
  return s;
});

for(const file of files(["public/app-v3.js","public/app.js","app.js"])){
  patchFile(file, s => {
    s = s.replace(/maxBufferLength:isMobilePlaybackClient\(\)\?20:45/g, "maxBufferLength:isMobilePlaybackClient()?45:90");
    s = s.replace(/maxMaxBufferLength:isMobilePlaybackClient\(\)\?40:90/g, "maxMaxBufferLength:isMobilePlaybackClient()?90:180");
    s = s.replace(/maxBufferSize:isMobilePlaybackClient\(\)\?20\*1000\*1000:60\*1000\*1000/g, "maxBufferSize:isMobilePlaybackClient()?60*1000*1000:120*1000*1000");
    s = s.replace(/manifestLoadingTimeOut:15000/g, "manifestLoadingTimeOut:8000");
    s = s.replace(/fragLoadingTimeOut:20000/g, "fragLoadingTimeOut:12000");
    s = s.replace(/setTimeout\(\(\)=>finish\(true\), 5000\)/g, "setTimeout(()=>finish(true), 1200)");

    const a = s.indexOf("function svInitialCardCount(rowId){");
    const b = s.indexOf("function svFallbackItemKey", a);
    if(a >= 0 && b > a){
      s = s.slice(0,a) + "function svInitialCardCount(rowId){ return 50; }\n" + s.slice(b);
    }

    s = s.replace(/svRenderSlice\(track,0,Math\.min\(list\.length,opts\.initial \|\| svInitialCardCount\(rowId\)\)\);/g,
                  "svRenderSlice(track,0,list.length);");
    s = s.replace(/svRenderSlice\(track, rendered, Math\.min\(track\._svItems\.length, rendered \+ \(opts\.initial \|\| svInitialCardCount\(rowId\)\)\)\);/g,
                  "svRenderSlice(track, rendered, track._svItems.length);");

    if(!s.includes("SV_INSTANT_POSTER_LOAD_PATCH")){
      s += `

/* SV_INSTANT_POSTER_LOAD_PATCH */
(function(){
  if(window.__svInstantPosterLoadPatch)return;
  window.__svInstantPosterLoadPatch = true;

  function loadImgs(root){
    const scope = root && root.querySelectorAll ? root : document;
    const imgs = [];
    if(scope.matches && scope.matches('img[data-sv-src]')) imgs.push(scope);
    scope.querySelectorAll && scope.querySelectorAll('img[data-sv-src]').forEach(i=>imgs.push(i));
    imgs.forEach(img=>{
      const src = img.dataset.svSrc;
      if(!src || img.dataset.svLoaded === '1')return;
      img.loading = 'eager';
      img.decoding = 'async';
      img.fetchPriority = 'high';
      if(img.getAttribute('src') !== src) img.setAttribute('src', src);
      img.onload = () => {
        img.dataset.svLoaded = '1';
        img.classList.add('poster-loaded','is-loaded');
      };
    });
  }

  function renderAllTracks(){
    document.querySelectorAll('.cards-track').forEach(track=>{
      if(!track._svItems || !track._svRenderItem)return;
      const cards = track.querySelectorAll('.card,.live-ch-card').length;
      const from = Math.max(track._svRendered || 0, cards);
      const to = track._svItems.length;
      if(from >= to)return;
      const html = track._svItems.slice(from,to).map((item,i)=>{
        const next = {...item, _immediateImage:true, _priorityImage:true};
        return track._svRenderItem(next, from+i);
      }).join('');
      track.insertAdjacentHTML('beforeend', html);
      track._svRendered = to;
    });
    loadImgs(document);
  }

  window.svQueuePosterImages = loadImgs;
  const mo = new MutationObserver(records=>{
    for(const r of records) r.addedNodes && r.addedNodes.forEach(n=>n.nodeType===1 && loadImgs(n));
    setTimeout(renderAllTracks, 80);
  });

  function start(){
    loadImgs(document);
    renderAllTracks();
    mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(renderAllTracks,500);
    setTimeout(renderAllTracks,1500);
    setTimeout(renderAllTracks,3000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
`;
    }
    return s;
  });
}

for(const file of files(["public/home.js","home.js"])){
  patchFile(file, s => {
    s = s.replace(/track\._svInitial = opts\.initial \|\| \(window\.innerWidth < 760 \? 7 : 10\);/g,
                  "track._svInitial = opts.initial || list.length;");
    s = s.replace(/initial:window\.innerWidth < 760 \? 8 : 12,/g,
                  "initial:50,");
    s = s.replace(/initial:window\.innerWidth < 760 \? 7 : 10,/g,
                  "initial:50,");
    return s;
  });
}

for(const file of files(["public/details.js","details.js"])){
  patchFile(file, s => {
    s = s.replace(/window\._svEagerImageBudget = Number\.isFinite\(window\._svEagerImageBudget\)[\s\S]*?: \(\(window\._svWeakDevice \|\| innerWidth < 760\) \? 5 : 8\);/,
                  "window._svEagerImageBudget = 9999;");
    s = s.replace(/const eager = priority \|\| immediate \|\| window\._svEagerImageBudget-- > 0;/g,
                  "const eager = true;");
    return s;
  });
}

for(const file of files(["public/index.html","index.html"])){
  patchFile(file, s => s.replace(/\.js\?v=[^"']+/g, ".js?v=20260710-instant-smooth1"));
}
