from pathlib import Path

p = Path("hostinger/app-v3.js")
s = p.read_text(encoding="utf-8-sig")

helper_start = "/* SV_SERIES_DETAIL_HYDRATION_V1 */"
helper_start_v2 = "/* SV_SERIES_DETAIL_HYDRATION_V2 */"
anchor = "function openMediaModal(item, requestedType=''){"

helper = r'''/* SV_SERIES_DETAIL_HYDRATION_V2 */
const svSeriesHydrationCache=new Map();
const svSeriesHydrationPending=new Map();
let svSeriesFullCatalogCache=null;
let svSeriesFullCatalogPending=null;

function svSeriesEpisodeCount(item){
  return Object.values(item?.seasons || {}).reduce((n,eps)=>n+(Array.isArray(eps)?eps.length:0),0);
}

function svSeriesHasEpisodes(item){
  return svSeriesEpisodeCount(item)>0;
}

function svSeriesLookupTitle(value){
  return String(value || '')
    .replace(/\((?:tv\s*)?(?:series|mini\s*series)[^)]*\)/ig,' ')
    .replace(/\[(?:dual|multi)?\s*audio[^\]]*\]/ig,' ')
    .replace(/\[[^\]]*(?:480p|576p|720p|1080p|1440p|2160p|4k|uhd|hdr|web[- ]?dl|webrip|bluray|x264|x265|h264|h265|hevc)[^\]]*\]/ig,' ')
    .replace(/\b(?:tv\s*series|tv\s*mini\s*series|480p|576p|720p|1080p|1440p|2160p|4k|uhd|hdr|web[- ]?dl|webrip|bluray|brrip|x264|x265|h264|h265|hevc|avc|aac|ac3|eac3|ddp?|dts|10bit|8bit|dual\s*audio|multi\s*audio)\b/ig,' ')
    .replace(/[._]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function svSeriesMatchKey(value){
  let text=svSeriesLookupTitle(value);
  try{text=text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');}catch(_){}
  return text.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

function svSeriesHydrationScore(target,candidate){
  const a=svSeriesMatchKey(target?.name || target?.title);
  const b=svSeriesMatchKey(candidate?.name || candidate?.title);
  if(!a || !b || !svSeriesHasEpisodes(candidate))return -1;
  let score=a===b?5000:(a.includes(b)||b.includes(a)?2800:0);
  if(!score){
    const aa=new Set(a.split(' ').filter(Boolean)),bb=new Set(b.split(' ').filter(Boolean));
    let hit=0;
    aa.forEach(token=>{if(bb.has(token))hit++;});
    const ratio=hit/Math.max(aa.size,bb.size,1);
    if(ratio>=0.8)score=Math.round(ratio*1400);
  }
  if(!score)return -1;
  const ta=String(target?.tmdbId || '').trim();
  const tb=String(candidate?.tmdbId || '').trim();
  if(ta && tb)score += ta===tb ? 10000 : -1200;
  const ya=String(target?.year || target?.name || '').match(/\b(19|20)\d{2}\b/)?.[0] || '';
  const yb=String(candidate?.year || candidate?.name || '').match(/\b(19|20)\d{2}\b/)?.[0] || '';
  if(ya && yb)score += ya===yb ? 900 : -350;
  return score+Math.min(1200,svSeriesEpisodeCount(candidate));
}

function svBestSeriesHydrationCandidate(item,rows){
  let best=null,bestScore=-1;
  (rows || []).forEach(candidate=>{
    const score=svSeriesHydrationScore(item,candidate);
    if(score>bestScore){best=candidate;bestScore=score;}
  });
  return bestScore>=1000?best:null;
}

function svApplySeriesHydration(item,best){
  if(!item || !best || !svSeriesHasEpisodes(best))return null;
  const hydrated={
    seasons:best.seasons,
    seasonCount:Object.keys(best.seasons || {}).length,
    episodeCount:svSeriesEpisodeCount(best),
    isSummary:false,
    isFtp:!!best.isFtp,
    streamAvailable:true,
    hasStream:true
  };
  ['genre','language','runtime','overview','rating','year','tmdbId','imdbId','category'].forEach(field=>{
    if(!item[field] && best[field])hydrated[field]=best[field];
  });
  Object.assign(item,hydrated);
  return hydrated;
}

async function svLoadFullSeriesCatalog(){
  if(Array.isArray(svSeriesFullCatalogCache))return svSeriesFullCatalogCache;
  if(svSeriesFullCatalogPending)return svSeriesFullCatalogPending;

  svSeriesFullCatalogPending=(async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(`${API_BASE}/api/series`,{
        cache:'no-store',
        signal:controller.signal,
        headers:{Accept:'application/json'}
      });
      if(!response.ok)throw new Error(`series catalog ${response.status}`);
      const payload=await response.json();
      const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.series)?payload.series:[]);
      const full=rows.filter(svSeriesHasEpisodes);
      if(!full.length)throw new Error('full series catalog returned no episodes');
      svSeriesFullCatalogCache=full;
      return full;
    }finally{
      clearTimeout(timer);
      svSeriesFullCatalogPending=null;
    }
  })();
  return svSeriesFullCatalogPending;
}

async function svHydrateSeriesEpisodes(item){
  if(!item || svSeriesHasEpisodes(item))return item;
  const query=svSeriesLookupTitle(item.name || item.title);
  if(!query)return null;
  const key=svSeriesMatchKey(query)+'|'+String(item.year || '')+'|'+String(item.tmdbId || '');

  if(svSeriesHydrationCache.has(key)){
    const cached=svSeriesHydrationCache.get(key);
    if(cached)Object.assign(item,cached);
    return cached?item:null;
  }
  if(svSeriesHydrationPending.has(key))return svSeriesHydrationPending.get(key);

  const task=(async()=>{
    const immediate=svBestSeriesHydrationCandidate(item,[...(series || []),...(svSeriesFullCatalogCache || [])]);
    if(immediate){
      const hydrated=svApplySeriesHydration(item,immediate);
      svSeriesHydrationCache.set(key,hydrated);
      return item;
    }

    const rows=await svLoadFullSeriesCatalog();
    const best=svBestSeriesHydrationCandidate(item,rows);
    if(!best){
      svSeriesHydrationCache.set(key,null);
      return null;
    }
    const hydrated=svApplySeriesHydration(item,best);
    svSeriesHydrationCache.set(key,hydrated);
    return item;
  })().catch(error=>{
    if(error?.name!=='AbortError')console.warn('[Series Detail] full-catalog hydration failed:',error?.message || error);
    return null;
  }).finally(()=>{
    svSeriesHydrationPending.delete(key);
  });

  svSeriesHydrationPending.set(key,task);
  return task;
}

'''

if helper_start_v2 in s:
    start=s.index(helper_start_v2)
    end=s.index(anchor,start)
    s=s[:start]+helper+s[end:]
elif helper_start in s:
    start=s.index(helper_start)
    end=s.index(anchor,start)
    s=s[:start]+helper+s[end:]
else:
    if anchor not in s:
        raise SystemExit("openMediaModal marker not found")
    s=s.replace(anchor,helper+anchor,1)

old = """  populateModal(item);\n  updateMediaModalWishlistButton();"""
new = """  populateModal(item);\n  if(currentMediaModalType === 'tv' && !svSeriesHasEpisodes(item)){\n    const episodesRoot=document.getElementById('modalEpisodes');\n    if(episodesRoot){\n      episodesRoot.className='media-modal-section';\n      episodesRoot.style.display='';\n      episodesRoot.innerHTML='<h2 class=\"media-modal-heading\">Episodes</h2><div class=\"no-data\">Loading full episode list…</div>';\n    }\n    svHydrateSeriesEpisodes(item).then(hydrated=>{\n      if(currentMediaModalItem !== item || document.getElementById('mediaModal')?.classList.contains('hidden'))return;\n      if(hydrated){\n        currentShow=item;\n        currentSeason=Object.keys(item.seasons || {}).map(Number).sort((a,b)=>a-b)[0] || 1;\n      }\n      populateModal(item);\n    });\n  }\n  updateMediaModalWishlistButton();"""
existing = """  populateModal(item);\n  if(currentMediaModalType === 'tv' && !svSeriesHasEpisodes(item)){\n    const episodesRoot=document.getElementById('modalEpisodes');\n    if(episodesRoot){\n      episodesRoot.className='media-modal-section';\n      episodesRoot.style.display='';\n      episodesRoot.innerHTML='<h2 class=\"media-modal-heading\">Episodes</h2><div class=\"no-data\">Loading episode list…</div>';\n    }\n    svHydrateSeriesEpisodes(item).then(hydrated=>{\n      if(currentMediaModalItem !== item || document.getElementById('mediaModal')?.classList.contains('hidden'))return;\n      if(hydrated){\n        currentShow=item;\n        currentSeason=Object.keys(item.seasons || {}).map(Number).sort((a,b)=>a-b)[0] || 1;\n      }\n      populateModal(item);\n    });\n  }\n  updateMediaModalWishlistButton();"""

if new not in s:
    if existing in s:
        s=s.replace(existing,new,1)
    elif old in s:
        s=s.replace(old,new,1)
    else:
        raise SystemExit("populateModal marker not found")

mobile_old = """function openSeriesDetail(key){\n  const show = _seriesDetailRegistry.get(key);\n  if(!show)return;\n  if(window.innerWidth > 768){\n    openMediaModal(show, 'tv');\n    return;\n  }"""
mobile_new = """function openSeriesDetail(key){\n  const show = _seriesDetailRegistry.get(key);\n  if(!show)return;\n  if(window.innerWidth > 768){\n    openMediaModal(show, 'tv');\n    return;\n  }\n  if(!svSeriesHasEpisodes(show)){\n    svHydrateSeriesEpisodes(show).then(hydrated=>{\n      if(hydrated)openSeriesDetail(key);\n      else showToast('Episode list is temporarily unavailable');\n    });\n    return;\n  }"""
if mobile_new not in s:
    if mobile_old in s:
        s=s.replace(mobile_old,mobile_new,1)
    else:
        print("mobile series detail marker not found; desktop/global modal fix still applied")

p.write_text(s, encoding="utf-8")
print("global full-catalog series hydration installed")
