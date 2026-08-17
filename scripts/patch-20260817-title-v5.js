'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),SERVER=path.join(ROOT,'server.js'),BACKUP=path.join(ROOT,'server.js.before-20260817-title-v5.bak'),CACHE=path.join(ROOT,'detail-cache.json');
const MARK='SV_20260817_TITLE_V5';
if(!fs.existsSync(SERVER))process.exit(2);
let s=fs.readFileSync(SERVER,'utf8');
if(s.includes(MARK)){console.log('[Title V5] Already applied.');process.exit(0);}
const a=s.indexOf('async function searchTmdbMedia('),b=s.indexOf('\nfunction mapTmdbMediaCard',a);
if(a<0||b<0){console.error('[Title V5] searchTmdbMedia not found');process.exit(3);}
if(!fs.existsSync(BACKUP))fs.copyFileSync(SERVER,BACKUP);
const r=`async function searchTmdbMedia(title, year, mediaType) {
  // ${MARK}
  const normalized = splitSearchTitleYear(title, year);
  const clean = normalized.title;
  const searchYear = normalized.year;
  if (!clean) return null;
  const variants=[];
  const add=v=>{v=String(v||'').replace(/\\s+/g,' ').trim();if(v&&!variants.includes(v))variants.push(v);};
  const m=clean.match(/^(.*?)(?:[,;:\\-]?\\s+)((?:19|20)\\d{2})$/);
  if(m&&m[2]!==String(searchYear||'')){
    const base=m[1].replace(/[\\s,;:\\-]+$/g,'').trim();
    if(base)add(base+', '+m[2]);
  }
  add(clean);
  const endpoint=mediaType==='tv'?'/search/tv':'/search/movie';
  for(const queryTitle of variants){
    const yearParam=searchYear?(mediaType==='tv'?'&first_air_date_year='+encodeURIComponent(searchYear):'&year='+encodeURIComponent(searchYear)):'';
    let data=await tmdbGet(endpoint+'?query='+encodeURIComponent(queryTitle)+yearParam+'&include_adult=false&language=en-US&page=1');
    let picked=pickTmdbResult(data?.results||[],queryTitle,searchYear,mediaType);
    if(picked)return picked;
    if(yearParam){
      data=await tmdbGet(endpoint+'?query='+encodeURIComponent(queryTitle)+'&include_adult=false&language=en-US&page=1');
      picked=pickTmdbResult(data?.results||[],queryTitle,searchYear,mediaType);
      if(picked)return picked;
    }
  }
  return null;
}`;
s=s.slice(0,a)+r+s.slice(b);
fs.writeFileSync(SERVER,s,'utf8');
try{if(fs.existsSync(CACHE)){const j=JSON.parse(fs.readFileSync(CACHE,'utf8'));let n=0;for(const k of Object.keys(j)){const t=JSON.stringify(j[k]||'').toLowerCase();if(k.toLowerCase().includes('madrid')||t.includes('coldplay: unstaged live from madrid')){delete j[k];n++;}}if(n)fs.writeFileSync(CACHE,JSON.stringify(j,null,2));console.log('[Title V5] Purged cache:',n);}}catch(e){}
console.log('[Title V5] Applied.');
console.log('[Title V5] Backup:',BACKUP);
