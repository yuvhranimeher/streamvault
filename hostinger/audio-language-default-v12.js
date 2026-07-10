/* SV_LANGUAGE_AUDIO_DEFAULT_V12 */
(function(){
  if(window.__svLanguageAudioDefaultV12)return;
  window.__svLanguageAudioDefaultV12=true;

  if(typeof preferredAudioTrackIndex!=="function"){
    console.warn("[Audio v12] Original selector unavailable");
    return;
  }

  const originalPreferredAudioTrackIndex=preferredAudioTrackIndex;

  function decodeDeep(value){
    let text=String(value||"");

    for(let i=0;i<4;i++){
      try{
        const decoded=decodeURIComponent(text);
        if(decoded===text)break;
        text=decoded;
      }catch(_){
        break;
      }
    }

    return text.replace(/\\/g,"/");
  }

  function playbackContext(){
    const values=[];

    try{
      if(typeof _ftpStreamUrl!=="undefined"){
        values.push(_ftpStreamUrl);
      }
    }catch(_){}

    try{
      if(typeof svMediaPlayerState!=="undefined"){
        values.push(
          svMediaPlayerState.sourceKey,
          svMediaPlayerState.selectedSourceUrl,
          svMediaPlayerState.title
        );
      }
    }catch(_){}

    try{
      if(typeof currentDetailMovie!=="undefined"){
        values.push(
          currentDetailMovie?.streamUrl,
          currentDetailMovie?.language,
          currentDetailMovie?.name
        );
      }
    }catch(_){}

    try{
      if(typeof currentShow!=="undefined"){
        values.push(
          currentShow?.streamUrl,
          currentShow?.language,
          currentShow?.name
        );
      }
    }catch(_){}

    values.push(
      document.getElementById("playerTitle")?.textContent||""
    );

    return decodeDeep(values.filter(Boolean).join(" "));
  }

  function preferredLanguage(){
    const context=playbackContext();

    const segments=context
      .split("/")
      .map(segment=>segment.trim())
      .filter(Boolean);

    const englishFolder=segments.some(segment=>
      /^(?:english(?:[\s._-]*(?:movies?|films?|series|tv))?|hollywood)\b/i
        .test(segment)
    );

    const hindiFolder=segments.some(segment=>
      /^(?:hindi(?:[\s._-]*(?:movies?|films?|series|tv))?|bollywood)\b/i
        .test(segment)
    );

    // Folder classification has priority over dual-audio filename text.
    if(englishFolder&&!hindiFolder)return "eng";
    if(hindiFolder&&!englishFolder)return "hin";

    const lower=context.toLowerCase();
    const english=/\b(?:english|eng)\b/.test(lower);
    const hindi=/\b(?:hindi|hin)\b/.test(lower);

    if(english&&!hindi)return "eng";
    if(hindi&&!english)return "hin";

    return "";
  }

  function trackText(track){
    if(typeof audioTrackText==="function"){
      return audioTrackText(track);
    }

    return [
      track?.language,
      track?.lang,
      track?.title,
      track?.label
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function isAudible(track){
    if(typeof audioTrackIsAudible==="function"){
      return audioTrackIsAudible(track);
    }

    return track?.decodable!==false;
  }

  function scoreTrack(track,preferred){
    const text=trackText(track);
    const language=String(
      track?.language||track?.lang||""
    ).toLowerCase().replace(/[^a-z]/g,"");

    let score=0;

    if(preferred==="eng"){
      if(/^(?:en|eng|english)$/.test(language))score+=200;
      if(/\b(?:english|eng)\b/.test(text))score+=140;

      if(/^(?:hi|hin|hindi)$/.test(language))score-=220;
      if(/\b(?:hindi|hin)\b/.test(text))score-=180;
    }

    if(preferred==="hin"){
      if(/^(?:hi|hin|hindi)$/.test(language))score+=200;
      if(/\b(?:hindi|hin)\b/.test(text))score+=140;

      if(/^(?:en|eng|english)$/.test(language))score-=220;
      if(/\b(?:english|eng)\b/.test(text))score-=180;
    }

    if(track?.default)score+=2;

    if(
      /commentary|audio description|descriptive|director/i
        .test(text)
    ){
      score-=120;
    }

    return score;
  }

  preferredAudioTrackIndex=function(tracks=[]){
    const preferred=preferredLanguage();

    if(!preferred){
      return originalPreferredAudioTrackIndex(tracks);
    }

    const candidates=tracks
      .map((track,index)=>({
        track,
        index,
        score:scoreTrack(track,preferred)
      }))
      .filter(item=>isAudible(item.track))
      .sort((a,b)=>b.score-a.score);

    if(!candidates.length||candidates[0].score<=0){
      return originalPreferredAudioTrackIndex(tracks);
    }

    console.log("[Audio Default v12]",{
      preferred,
      selectedIndex:candidates[0].index,
      selectedTrack:trackText(candidates[0].track)
    });

    return candidates[0].index;
  };

  try{
    window.preferredAudioTrackIndex=preferredAudioTrackIndex;
  }catch(_){}
})();