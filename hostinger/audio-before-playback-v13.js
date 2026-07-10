/* SV_AUDIO_BEFORE_PLAYBACK_V13 */
(function(){
  if(window.__svAudioBeforePlaybackV13)return;
  window.__svAudioBeforePlaybackV13=true;

  if(
    typeof fetchFtpPlaybackPlan!=="function" ||
    typeof loadFtpTrackOptions!=="function"
  ){
    console.warn("[Audio v13] Playback functions unavailable");
    return;
  }

  const originalFetchFtpPlaybackPlan=fetchFtpPlaybackPlan;
  const prepared=new Set();

  function decodeDeep(value){
    let text=String(value||"");

    for(let i=0;i<5;i++){
      try{
        const next=decodeURIComponent(text);
        if(next===text)break;
        text=next;
      }catch(_){
        break;
      }
    }

    return text.replace(/\\/g,"/");
  }

  function preferredLanguage(streamUrl){
    const decoded=decodeDeep(streamUrl)
      .split(/[?#]/)[0];

    const segments=decoded
      .split("/")
      .map(value=>value.trim())
      .filter(Boolean);

    // Ignore the filename. Folder classification is authoritative.
    const directories=segments.slice(0,-1);

    for(let i=directories.length-1;i>=0;i--){
      const segment=directories[i].toLowerCase();

      const english=
        /\benglish\b/.test(segment) ||
        /\bhollywood\b/.test(segment);

      const hindi=
        /\bhindi\b/.test(segment) ||
        /\bbollywood\b/.test(segment);

      if(english&&!hindi)return "eng";
      if(hindi&&!english)return "hin";
    }

    return "";
  }

  function trackText(track){
    return [
      track?.language,
      track?.lang,
      track?.title,
      track?.label,
      track?.codec
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function scoreTrack(track,preferred){
    const text=trackText(track);

    const language=String(
      track?.language ||
      track?.lang ||
      ""
    )
      .toLowerCase()
      .replace(/[^a-z]/g,"");

    let score=0;

    if(preferred==="eng"){
      if(/^(?:en|eng|english)$/.test(language))score+=300;
      if(/\benglish\b|\beng\b/.test(text))score+=220;

      if(/^(?:hi|hin|hindi)$/.test(language))score-=350;
      if(/\bhindi\b|\bhin\b/.test(text))score-=300;
    }

    if(preferred==="hin"){
      if(/^(?:hi|hin|hindi)$/.test(language))score+=300;
      if(/\bhindi\b|\bhin\b/.test(text))score+=220;

      if(/^(?:en|eng|english)$/.test(language))score-=350;
      if(/\benglish\b|\beng\b/.test(text))score-=300;
    }

    if(
      /commentary|director|descriptive|audio description/
        .test(text)
    ){
      score-=200;
    }

    return score;
  }

  function chooseTrack(preferred){
    if(!preferred||!Array.isArray(availableAudio)){
      return -1;
    }

    const ranked=availableAudio
      .map((track,index)=>({
        track,
        index,
        score:scoreTrack(track,preferred)
      }))
      .sort((a,b)=>b.score-a.score);

    if(ranked[0]?.score>0){
      return ranked[0].index;
    }

    // Safe fallback when one track is clearly the opposite language.
    const opposite=preferred==="eng"
      ? /\bhindi\b|\bhin\b/i
      : /\benglish\b|\beng\b/i;

    const candidates=ranked.filter(item=>
      !opposite.test(trackText(item.track)) &&
      !/commentary|director|descriptive/i
        .test(trackText(item.track))
    );

    return candidates.length===1
      ? candidates[0].index
      : -1;
  }

  fetchFtpPlaybackPlan=async function(
    streamUrl,
    start=0,
    options={}
  ){
    const preferred=preferredLanguage(streamUrl);

    const token=[
      typeof vid!=="undefined"
        ? vid._durationToken||0
        : 0,
      String(streamUrl||"")
    ].join("|");

    const initialRequest=
      Number(start||0)<=0 &&
      !options.forceHls &&
      !options.forceProxy &&
      !options.forceStream &&
      !options.forceRemux &&
      !options.forceAudio;

    if(
      preferred &&
      initialRequest &&
      !prepared.has(token)
    ){
      prepared.add(token);

      try{
        const loading=loadFtpTrackOptions(streamUrl);

        // Prevent the later delayed loader from resetting the selection.
        if(typeof _ftpTrackLoadPromise!=="undefined"){
          _ftpTrackLoadPromise=loading;
        }

        await loading;

        const selectedIndex=chooseTrack(preferred);

        if(selectedIndex>=0){
          currentAudioIdx=selectedIndex;

          if(typeof renderAudioTracks==="function"){
            renderAudioTracks();
          }

          console.log("[Audio v13]",{
            preferred,
            selectedIndex,
            selectedTrack:
              availableAudio[selectedIndex]?.title ||
              trackText(availableAudio[selectedIndex])
          });
        }
      }catch(error){
        console.warn(
          "[Audio v13] Metadata selection failed:",
          error?.message||error
        );
      }
    }

    return originalFetchFtpPlaybackPlan.apply(
      this,
      arguments
    );
  };

  try{
    window.fetchFtpPlaybackPlan=fetchFtpPlaybackPlan;
  }catch(_){}
})();