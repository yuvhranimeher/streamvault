from pathlib import Path

p = Path("hostinger/app-v3.js")
s = p.read_text(encoding="utf-8-sig")
marker = "SV_SERIES_DETAIL_HYDRATION_V1"

if marker not in s:
    anchor = "function openMediaModal(item, requestedType=''){"
    if anchor not in s:
        raise SystemExit("openMediaModal marker not found")

    helper = r'''
/* SV_SERIES_DETAIL_HYDRATION_V1 */
const svSeriesHydrationCache=new Map();
const svSeriesHydrationPending=new Map();

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
    .replace(/\b(?:tv\s*series|tv\s*mini\s*series|480p|576p|720p|1080p|1440p|2160p|4k|uhd|hdr|web[- ]?dl|webrip|bluray|x264|x265|h264|h265|hevc|aac|ac3|eac3|ddp?|dts|10bit|8bit|dual\s*audio|multi\s*audio)\b/ig,' ')
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
  let score=a===b?2000:(a.includes(b)||b.includes(a)?1200:0);
  if(!score){
    const aa=new Set(a.split(' ')),bb=new Set(b.split(' '));
    let hit=0;
    aa.forEach(token=>{if(bb.has(token))hit++;});
    score=Math.round((hit/Math.max(aa.size,1))*800);
  }
  const ya=String(target?.year || target?.name || '').match(/\b(19|20)\d{2}\b/)?.[0] || '';
  const yb=String(candidate?.year || candidate?.name || '').match(/\b(19|20)\d{2}\b/)?.[0] || '';
  if(ya && yb && ya===yb)score+=250;
  return score+Math.min(500,svSeriesEpisodeCount(candidate));
}

async function svHydrateSeriesEpisodes(item){
  if(!item || svSeriesHasEpisodes(item))return item;
  const query=svSeriesLookupTitle(item.name || item.title);
  if(!query)return null;
  const key=svSeriesMatchKey(query)+'|'+String(item.year || '');

  if(svSeriesHydrationCache.has(key)){
    const cached=svSeriesHydrationCache.get(key);
    if(cached)Object.assign(item,cached);
    return cached?item:null;
  }
  if(svSeriesHydrationPending.has(key))return svSeriesHydrationPending.get(key);

  const task=(async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),9000);
    try{
      const response=await fetch(`${API_BASE}/api/series?q=${encodeURIComponent(query)}&limit=60&massive=0`,{
        cache:'no-store',
        signal:controller.signal,
        headers:{Accept:'application/json'}
      });
      if(!response.ok)throw new Error(`series ${response.status}`);
      const payload=await response.json();
      const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.series)?payload.series:[]);
      let best=null,bestScore=-1;
      rows.forEach(candidate=>{
        const score=svSeriesHydrationScore(item,candidate);
        if(score>bestScore){best=candidate;bestScore=score;}
      });
      if(!best || bestScore<600 || !svSeriesHasEpisodes(best)){
        svSeriesHydrationCache.set(key,null);
        return null;
      }

      const hydrated={
        seasons:best.seasons,
        seasonCount:Object.keys(best.seasons || {}).length,
        episodeCount:svSeriesEpisodeCount(best),
        isSummary:false,
        streamAvailable:true,
        hasStream:true
      };
      ['genre','language','runtime','overview','rating','year','tmdbId','imdbId'].forEach(field=>{
        if(!item[field] && best[field])hydrated[field]=best[field];
      });
      svSeriesHydrationCache.set(key,hydrated);
      Object.assign(item,hydrated);
      return item;
    }finally{
      clearTimeout(timer);
      svSeriesHydrationPending.delete(key);
    }
  })().catch(error=>{
    if(error?.name!=='AbortError')console.warn('[Series Detail] episode hydration failed:',error?.message || error);
    return null;
  });

  svSeriesHydrationPending.set(key,task);
  return task;
}

'''
    s = s.replace(anchor, helper + anchor, 1)

old = """  populateModal(item);\n  updateMediaModalWishlistButton();"""
new = """  populateModal(item);\n  if(currentMediaModalType === 'tv' && !svSeriesHasEpisodes(item)){\n    const episodesRoot=document.getElementById('modalEpisodes');\n    if(episodesRoot){\n      episodesRoot.className='media-modal-section';\n      episodesRoot.style.display='';\n      episodesRoot.innerHTML='<h2 class=\"media-modal-heading\">Episodes</h2><div class=\"no-data\">Loading episode list…</div>';\n    }\n    svHydrateSeriesEpisodes(item).then(hydrated=>{\n      if(currentMediaModalItem !== item || document.getElementById('mediaModal')?.classList.contains('hidden'))return;\n      if(hydrated){\n        currentShow=item;\n        currentSeason=Object.keys(item.seasons || {}).map(Number).sort((a,b)=>a-b)[0] || 1;\n      }\n      populateModal(item);\n    });\n  }\n  updateMediaModalWishlistButton();"""

if new not in s:
    if old not in s:
        raise SystemExit("populateModal marker not found")
    s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")
print("series detail hydration installed")
