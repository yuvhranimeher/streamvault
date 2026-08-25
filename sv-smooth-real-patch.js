const fs = require('fs');

function backup(f){
  fs.copyFileSync(f, f + ".bak-smooth-real-" + Date.now());
}
function patch(f, fn){
  if(!fs.existsSync(f)) return;
  let s = fs.readFileSync(f,'utf8').replace(/\r\n/g,"\n");
  backup(f);
  s = fn(s);
  fs.writeFileSync(f,s,'utf8');
  console.log("patched", f);
}

/* SERVER: smoother live + faster media startup */
patch("server.js", s => {
  s = s.replace(/const MOBILE_HLS_IDLE_MS = Number\(process\.env\.MOBILE_HLS_IDLE_MS \|\| [^)]+\);/,
    "const MOBILE_HLS_IDLE_MS = Number(process.env.MOBILE_HLS_IDLE_MS || 1200000);");

  s = s.replace(/const MOBILE_HLS_MAX_SESSIONS = Number\(process\.env\.MOBILE_HLS_MAX_SESSIONS \|\| [^)]+\);/,
    "const MOBILE_HLS_MAX_SESSIONS = Number(process.env.MOBILE_HLS_MAX_SESSIONS || 8);");

  s = s.replace(/const HEAVY_COMPAT_HLS_STARTUP_SEGMENTS = [^;]+;/,
    "const HEAVY_COMPAT_HLS_STARTUP_SEGMENTS = 1;");

  s = s.replace(/const HEAVY_COMPAT_HLS_SEGMENT_TIME = [^;]+;/,
    "const HEAVY_COMPAT_HLS_SEGMENT_TIME = 2;");

  s = s.replace(/const HEAVY_COMPAT_HLS_VIDEO_MAXRATE = String\(process\.env\.HEAVY_COMPAT_HLS_VIDEO_MAXRATE \|\| '[^']+'\);/,
    "const HEAVY_COMPAT_HLS_VIDEO_MAXRATE = String(process.env.HEAVY_COMPAT_HLS_VIDEO_MAXRATE || '2500k');");

  s = s.replace(/const HEAVY_COMPAT_HLS_VIDEO_BUFSIZE = String\(process\.env\.HEAVY_COMPAT_HLS_VIDEO_BUFSIZE \|\| '[^']+'\);/,
    "const HEAVY_COMPAT_HLS_VIDEO_BUFSIZE = String(process.env.HEAVY_COMPAT_HLS_VIDEO_BUFSIZE || '5000k');");

  s = s.replace(/const MEDIA_FFMPEG_STREAM_MAX = Number\(process\.env\.MEDIA_FFMPEG_STREAM_MAX \|\| [^)]+\);/,
    "const MEDIA_FFMPEG_STREAM_MAX = Number(process.env.MEDIA_FFMPEG_STREAM_MAX || 6);");

  /* remove realtime throttling from VOD HLS */
  s = s.replace(/\n  ffmpegArgs\.push\('-re'\);/g,
    "\n  // VOD HLS must not use -re; build buffer faster than realtime.");

  s = s.replace(/waitForHlsPlaylist\(playlistPath, 15000/g,
    "waitForHlsPlaylist(playlistPath, 9000");

  s = s.replace(/'-hls_time', '3'/g, "'-hls_time', '2'");
  s = s.replace(/'-preset', 'veryfast'/g, "'-preset', 'ultrafast'");

  /* live relay: lower bitrate 720p for smoother Cloudflare tunnel playback */
  s = s.replace(
`'-i', source,
    '-map', '0:v:0?', '-map', '0:a:0?', '-c', 'copy', '-max_muxing_queue_size', '2048',
    '-f', 'hls', '-hls_time', '4', '-hls_list_size', '8',`,
`'-i', source,
    '-map', '0:v:0?', '-map', '0:a:0?',
    '-vf', 'scale=-2:720,fps=25',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
    '-b:v', '1600k', '-maxrate', '1800k', '-bufsize', '3600k',
    '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '2',
    '-max_muxing_queue_size', '2048',
    '-f', 'hls', '-hls_time', '2', '-hls_list_size', '16',`
  );

  s = s.replace(/readySegments\.length >= 2/g, "readySegments.length >= 3");

  return s;
});

/* CLIENT: use live relay, stronger HLS buffer, force posters */
for(const file of ["public/app.js","app.js"]){
  patch(file, s => {
    s = s.replace(
      "const src=`/live/${encodeURIComponent(channelId)}/playlist.m3u8`;",
      "const src=`/live-relay/${encodeURIComponent(channelId)}/playlist.m3u8`;"
    );

    s = s.replace(/lowLatencyMode:false/g, "lowLatencyMode:false");
    s = s.replace(/maxBufferLength:isMobilePlaybackClient\(\)\?45:90/g,
      "maxBufferLength:isMobilePlaybackClient()?60:120");
    s = s.replace(/maxMaxBufferLength:isMobilePlaybackClient\(\)\?90:180/g,
      "maxMaxBufferLength:isMobilePlaybackClient()?120:240");
    s = s.replace(/fragLoadingTimeOut:\d+/g, "fragLoadingTimeOut:20000");
    s = s.replace(/manifestLoadingTimeOut:\d+/g, "manifestLoadingTimeOut:12000");

    if(!s.includes("SV_FORCE_ALL_POSTERS_PATCH")){
      s += `

/* SV_FORCE_ALL_POSTERS_PATCH */
(function(){
  if(window.__svForceAllPostersPatch)return;
  window.__svForceAllPostersPatch=true;

  function forceImgs(root=document){
    root.querySelectorAll?.('img[data-sv-src]').forEach(img=>{
      const src=img.dataset.svSrc;
      if(!src)return;
      img.loading='eager';
      img.decoding='async';
      img.fetchPriority='high';
      if(img.getAttribute('src')!==src) img.setAttribute('src',src);
      img.classList.add('poster-loaded','is-loaded');
      img.dataset.svLoaded='1';
    });
  }

  function forceRows(){
    document.querySelectorAll('.row[id]').forEach(row=>{
      try{
        if(typeof window.svMountHomeRow==='function') window.svMountHomeRow(row.id);
      }catch{}
    });

    document.querySelectorAll('.cards-track').forEach(track=>{
      if(!track._svItems || !track._svRenderItem)return;
      const cards=track.querySelectorAll('.card,.live-ch-card').length;
      const from=Math.max(track._svRendered||0,cards);
      const to=track._svItems.length;
      if(from>=to)return;
      const html=track._svItems.slice(from,to).map((item,i)=>{
        return track._svRenderItem({...item,_immediateImage:true,_priorityImage:true},from+i);
      }).join('');
      track.insertAdjacentHTML('beforeend',html);
      track._svRendered=to;
    });

    forceImgs(document);
  }

  const run=()=>{forceRows();forceImgs(document);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();

  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
  [300,800,1500,3000,6000,10000].forEach(t=>setTimeout(run,t));
})();
`;
    }
    return s;
  });
}

/* HOME: mount all rows immediately */
for(const file of ["public/home.js","home.js"]){
  patch(file, s => {
    if(!s.includes("SV_FORCE_HOME_ROWS_NOW")){
      s += `

/* SV_FORCE_HOME_ROWS_NOW */
setTimeout(function(){
  document.querySelectorAll('.row[id]').forEach(function(row){
    try{
      if(typeof window.svMountHomeRow==='function') window.svMountHomeRow(row.id);
    }catch(e){}
  });
}, 500);
`;
    }
    return s;
  });
}

/* cache bump */
for(const file of ["public/index.html","index.html"]){
  patch(file, s => s.replace(/\.js\?v=[^"']+/g, ".js?v=20260710-smooth-real2"));
}
