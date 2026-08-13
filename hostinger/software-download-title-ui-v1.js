(function(){
  const MARKER='SV_SOFTWARE_DOWNLOAD_TITLE_UI_V1';
  if(window[MARKER])return;
  window[MARKER]=true;

  const ROOT='/non-video';
  const VERSION='20260813-software-title-ui-v1';
  const BATCH=160;
  const state={
    active:false,
    loaded:false,
    loading:false,
    groups:[],
    filtered:[],
    map:new Map(),
    rendered:0,
    query:'',
    artwork:new Map(),
    artworkPending:new Map(),
    posterQueue:[],
    posterActive:0
  };

  function escText(value){
    return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function decode(value){try{return decodeURIComponent(String(value||''));}catch{return String(value||'');}}
  function safeUrl(value){const url=String(value||'').trim();return /^https?:\/\//i.test(url)?url:'';}
  function keyFor(value){
    let text=String(value||'');
    try{text=text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');}catch{}
    return text.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }
  function pathParts(item){
    try{return decode(new URL(String(item?.url||''),location.href).pathname).split('/').filter(Boolean);}
    catch{return decode(item?.url||'').split(/[\\/]/).filter(Boolean);}
  }
  function parentFolder(item){const p=pathParts(item);return p.length>1?p[p.length-2]:'';}
  function cleanTitle(item){
    const generic=/^(?:file|pc game backup|consoles? game|games?\s*-\s*pc(?:\s*\d+)?|pc, consoles games & mods)$/i;
    let raw=parentFolder(item);
    if(!raw||generic.test(raw))raw=String(item?.name||item?.filename||'Untitled');
    raw=decode(raw)
      .replace(/\.(?:rar|zip|7z|iso|exe|appx|appxbundle|nsp|nsz|xci|3ds|cso|pkg|dmg|ipa|xap)$/i,' ')
      .replace(/\.part\s*0*\d+$/i,' ')
      .replace(/\bpart\s*0*\d+\b/ig,' ')
      .replace(/\s*[\[(][^\])]*(?:backup|repack|portable|setup|steam|epic|gog|origin|official|dodi|fitgirl|ps[1-5]|xbox|switch|nintendo)[^\])]*[\])]/ig,' ')
      .replace(/\s*[\[(]\s*(?:19|20)\d{2}[^\])]*[\])]/g,' ')
      .replace(/\s+(?:steam|epic|gog|origin|official)\s+backup.*$/i,' ')
      .replace(/\s+/g,' ').replace(/^[\s._-]+|[\s._-]+$/g,'');
    return raw||String(item?.name||'Untitled');
  }
  function platform(item){
    const text=decode(`${item?.url||''} ${parentFolder(item)} ${item?.name||''}`).toLowerCase();
    if(/\bps5\b/.test(text))return 'PS5';
    if(/\bps4\b/.test(text))return 'PS4';
    if(/\bps3\b/.test(text))return 'PS3';
    if(/\bps2\b/.test(text))return 'PS2';
    if(/\bxbox\b/.test(text))return 'Xbox';
    if(/\bnintendo\b|\bswitch\b/.test(text))return 'Nintendo';
    if(/pc game|steam|epic|gog|origin|windows|\.exe\b|\.appx\b/.test(text))return 'PC';
    return 'Software';
  }
  function initials(title){const w=String(title||'').trim().split(/\s+/).filter(Boolean);return (w.slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'SV').slice(0,2);}

  function installStyles(){
    if(document.getElementById('svSoftwareTitleStyles'))return;
    const style=document.createElement('style');
    style.id='svSoftwareTitleStyles';
    style.textContent=`
      #svSoftwareTitleGrid{display:none;grid-template-columns:repeat(auto-fill,minmax(112px,142px));gap:16px;align-items:start;justify-content:start;margin-top:0}
      #svSoftwareTitleGrid.active{display:grid}
      .sv-sw-card{appearance:none;border:1px solid rgba(255,255,255,.12);background:#101012;color:#fff;border-radius:12px;overflow:hidden;padding:0;text-align:left;cursor:pointer;min-width:0;transition:transform .18s ease,border-color .18s ease,background .18s ease}
      .sv-sw-card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.3);background:#151518}
      .sv-sw-poster{position:relative;width:100%;aspect-ratio:2/3;background:linear-gradient(145deg,#1d2028,#090a0d);overflow:hidden}
      .sv-sw-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
      .sv-sw-fallback{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px;text-align:center;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.11),transparent 35%),linear-gradient(145deg,#1b1d23,#08090c)}
      .sv-sw-fallback b{font-size:29px;font-weight:900}.sv-sw-fallback small{font-size:9px;line-height:1.2;color:rgba(255,255,255,.62);max-height:34px;overflow:hidden}
      .sv-sw-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;font-weight:800;line-height:1.25;padding:10px 10px 0;min-height:40px}
      .sv-sw-meta{display:block;font-size:9px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:6px 10px 0}.sv-sw-count{display:block;font-size:9px;font-weight:800;padding:7px 10px 11px}
      .sv-sw-empty{grid-column:1/-1;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:48px 20px;text-align:center;color:rgba(255,255,255,.55);background:#101012}
      .sv-sw-modal{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.76);backdrop-filter:blur(8px)}.sv-sw-modal[aria-hidden="true"]{display:none}
      .sv-sw-panel{position:relative;width:min(760px,94vw);max-height:84vh;overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:#0d0d0f;box-shadow:0 30px 100px rgba(0,0,0,.65)}
      .sv-sw-close{position:absolute;right:14px;top:14px;z-index:2;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.72);color:#fff;font-size:24px;cursor:pointer}.sv-sw-body{display:grid;grid-template-columns:150px minmax(0,1fr);gap:18px;padding:22px;max-height:84vh;overflow:auto}.sv-sw-body .sv-sw-poster{border-radius:10px;border:1px solid rgba(255,255,255,.12)}
      .sv-sw-title{font-size:23px;font-weight:900;line-height:1.1;padding-right:40px;margin:2px 0 8px}.sv-sw-summary{font-size:12px;color:rgba(255,255,255,.58);line-height:1.55;margin-bottom:12px}.sv-sw-badges{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}.sv-sw-badge{border:1px solid rgba(255,255,255,.13);background:#151518;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:800;color:rgba(255,255,255,.78)}
      .sv-sw-file-heading{font-size:13px;font-weight:900;margin:0 0 8px}.sv-sw-files{display:flex;flex-direction:column;gap:7px;max-height:360px;overflow:auto;padding-right:4px}.sv-sw-file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 10px;background:#111114}.sv-sw-file-name{font-size:10px;font-weight:700;line-height:1.3;overflow-wrap:anywhere}.sv-sw-file-meta{font-size:8px;color:rgba(255,255,255,.45);margin-top:3px}.sv-sw-open{display:inline-flex;align-items:center;justify-content:center;min-width:70px;height:31px;border-radius:999px;background:#fff;color:#050505!important;text-decoration:none!important;font-size:9px;font-weight:900;padding:0 12px}
      @media(max-width:640px){#svSoftwareTitleGrid{grid-template-columns:repeat(auto-fill,minmax(102px,1fr));gap:11px}.sv-sw-modal{padding:10px}.sv-sw-body{grid-template-columns:92px minmax(0,1fr);gap:12px;padding:16px}.sv-sw-title{font-size:18px}.sv-sw-file{grid-template-columns:1fr}.sv-sw-open{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureGrid(){
    let grid=document.getElementById('svSoftwareTitleGrid');
    if(grid)return grid;
    const original=document.getElementById('downloadsGrid');
    if(!original)return null;
    grid=document.createElement('div');grid.id='svSoftwareTitleGrid';grid.setAttribute('aria-live','polite');
    original.insertAdjacentElement('afterend',grid);return grid;
  }
  function softwareButtonActive(){
    return [...document.querySelectorAll('#downloadsFilters .download-filter')].some(btn=>btn.classList.contains('active')&&/software\s*&\s*games/i.test(btn.textContent||''));
  }
  function setCount(){
    if(!state.active)return;
    const count=document.getElementById('downloadsCount');if(!count)return;
    const files=state.filtered.reduce((n,g)=>n+g.files.length,0);
    const text=state.loading?'Loading software titles…':`${state.filtered.length.toLocaleString()} title${state.filtered.length===1?'':'s'} · ${files.toLocaleString()} files`;
    if(count.textContent!==text)count.textContent=text;
  }
  function toggle(active){
    state.active=!!active;
    const original=document.getElementById('downloadsGrid');const grid=ensureGrid();
    if(!original||!grid)return;
    original.style.display=state.active?'none':'';grid.classList.toggle('active',state.active);
    const input=document.getElementById('downloadsSearchInput');if(input&&state.active)input.placeholder='Search software & game titles';
    if(state.active){load().then(()=>{applyFilter(input?.value||'');});setCount();}
    else{closeModal();if(input)input.placeholder='Search the selected file category';}
  }

  async function fetchJson(path){const r=await fetch(`${path}${path.includes('?')?'&':'?'}v=${encodeURIComponent(VERSION)}`,{cache:'no-cache',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
  async function load(){
    if(state.loaded||state.loading)return;
    state.loading=true;setCount();
    try{
      const manifest=await fetchJson(`${ROOT}/manifest.json`);const meta=manifest.categories?.find(x=>x.category==='software_games');if(!meta)throw new Error('software category missing');
      const items=[];const pages=Number(meta.pages||0);for(let start=1;start<=pages;start+=4){const batch=[];for(let p=start;p<Math.min(start+4,pages+1);p++)batch.push(fetchJson(`${ROOT}/${meta.slug}/page-${String(p).padStart(3,'0')}.json`));const payloads=await Promise.all(batch);payloads.forEach(x=>items.push(...(Array.isArray(x.items)?x.items:[])));}
      buildGroups(items);state.loaded=true;
    }catch(error){console.error('[Software titles]',error);state.groups=[];state.filtered=[];}
    finally{state.loading=false;applyFilter(document.getElementById('downloadsSearchInput')?.value||'');}
  }
  function buildGroups(items){
    const map=new Map();for(const item of items){const title=cleanTitle(item);const key=keyFor(title)||`item-${map.size}`;let g=map.get(key);if(!g){g={key,title,files:[],platforms:new Set(),hosts:new Set(),exts:new Set()};map.set(key,g);}g.files.push(item);g.platforms.add(platform(item));if(item.host)g.hosts.add(item.host);if(item.extension)g.exts.add(String(item.extension).replace(/^\./,'').toUpperCase());}
    state.groups=[...map.values()].map(g=>({key:g.key,title:g.title,files:g.files.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true})),platforms:[...g.platforms].sort(),hosts:[...g.hosts].sort(),exts:[...g.exts].sort()})).sort((a,b)=>a.title.localeCompare(b.title,undefined,{numeric:true,sensitivity:'base'}));state.map=new Map(state.groups.map(g=>[g.key,g]));
  }
  function groupText(g){return [g.title,...g.platforms,...g.hosts,...g.exts,...g.files.map(f=>f.name||'')].join(' ').toLowerCase();}
  function applyFilter(value){state.query=String(value||'');const terms=state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);state.filtered=!terms.length?state.groups.slice():state.groups.filter(g=>{const t=groupText(g);return terms.every(x=>t.includes(x));});state.rendered=0;render(true);setCount();}
  function posterMarkup(g){return `<div class="sv-sw-poster" data-poster-key="${escText(g.key)}"><div class="sv-sw-fallback"><b>${escText(initials(g.title))}</b><small>${escText(g.title)}</small></div><img alt="${escText(g.title)} poster" loading="lazy" decoding="async" referrerpolicy="no-referrer" hidden></div>`;}
  function card(g){return `<button type="button" class="sv-sw-card" data-title-key="${escText(g.key)}">${posterMarkup(g)}<span class="sv-sw-name">${escText(g.title)}</span><span class="sv-sw-meta">${escText(g.platforms.join(' · ')||'Software')}</span><span class="sv-sw-count">${g.files.length.toLocaleString()} file${g.files.length===1?'':'s'}</span></button>`;}
  function render(reset){const grid=ensureGrid();if(!grid||!state.active)return;if(reset)grid.innerHTML='';if(state.loading){grid.innerHTML='<div class="sv-sw-empty">Loading software titles…</div>';return;}if(!state.filtered.length){grid.innerHTML='<div class="sv-sw-empty">No titles found.</div>';return;}const to=Math.min(state.filtered.length,state.rendered+BATCH);if(state.rendered===0)grid.innerHTML='';grid.insertAdjacentHTML('beforeend',state.filtered.slice(state.rendered,to).map(card).join(''));state.rendered=to;hydrate(grid);}

  function loadArtworkCache(){if(state.artwork.size)return;try{Object.entries(JSON.parse(localStorage.getItem('sv_sw_art_v1')||'{}')).forEach(([k,v])=>state.artwork.set(k,v));}catch{}}
  function saveArtwork(){try{localStorage.setItem('sv_sw_art_v1',JSON.stringify(Object.fromEntries([...state.artwork.entries()].slice(-600))));}catch{}}
  function score(q,c){const a=keyFor(q).replace(/-/g,' '),b=keyFor(c).replace(/-/g,' ');if(!a||!b)return 0;if(a===b)return 1000;if(b.startsWith(a)||a.startsWith(b))return 850;if(b.includes(a)||a.includes(b))return 760;const as=new Set(a.split(/\s+/)),bs=new Set(b.split(/\s+/));let h=0;as.forEach(x=>{if(bs.has(x))h++;});return as.size?(h/as.size)*600:0;}
  async function artwork(g){loadArtworkCache();if(state.artwork.has(g.key))return state.artwork.get(g.key);if(state.artworkPending.has(g.key))return state.artworkPending.get(g.key);const p=(async()=>{try{const r=await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(g.title)}&l=english&cc=US`,{mode:'cors',credentials:'omit',cache:'force-cache'});if(!r.ok)return null;const d=await r.json();let best=null,s=0;(d.items||[]).slice(0,10).forEach(x=>{const n=score(g.title,x.name||'');if(n>s){s=n;best=x;}});const result=best&&s>=500?{id:String(best.id||''),tiny:String(best.tiny_image||'')}:null;state.artwork.set(g.key,result);saveArtwork();return result;}catch{return null;}finally{state.artworkPending.delete(g.key);}})();state.artworkPending.set(g.key,p);return p;}
  function queuePoster(node,g){if(!node||node.dataset.queued==='1')return;node.dataset.queued='1';state.posterQueue.push({node,g});pump();}
  function pump(){while(state.posterActive<4&&state.posterQueue.length){const t=state.posterQueue.shift();state.posterActive++;artwork(t.g).then(meta=>{if(!meta?.id||!t.node.isConnected)return;const img=t.node.querySelector('img');if(!img)return;img.dataset.id=meta.id;img.dataset.tiny=meta.tiny||'';img.dataset.stage='0';img.src=`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(meta.id)}/library_600x900_2x.jpg`;img.hidden=false;}).finally(()=>{state.posterActive--;pump();});}}
  function hydrate(root){root.querySelectorAll('[data-title-key]').forEach(card=>{const g=state.map.get(card.dataset.titleKey||'');const node=card.querySelector('[data-poster-key]');if(g&&node)queuePoster(node,g);});}

  function ensureModal(){let m=document.getElementById('svSoftwareTitleModal');if(m)return m;m=document.createElement('div');m.id='svSoftwareTitleModal';m.className='sv-sw-modal';m.setAttribute('aria-hidden','true');m.innerHTML='<div class="sv-sw-panel" role="dialog" aria-modal="true"><button type="button" class="sv-sw-close" aria-label="Close">×</button><div class="sv-sw-body"></div></div>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.closest('.sv-sw-close'))closeModal();});return m;}
  function closeModal(){document.getElementById('svSoftwareTitleModal')?.setAttribute('aria-hidden','true');}
  function fileRow(f,i){const href=safeUrl(f.url)||'#';const meta=[String(f.extension||'').replace(/^\./,'').toUpperCase(),f.host].filter(Boolean).join(' · ');return `<div class="sv-sw-file"><div><div class="sv-sw-file-name">${escText(f.name||`File ${i+1}`)}</div><div class="sv-sw-file-meta">${escText(meta)}</div></div><a class="sv-sw-open" href="${escText(href)}" target="_blank" rel="noopener noreferrer">Open</a></div>`;}
  function openModal(key){const g=state.map.get(key);if(!g)return;const m=ensureModal(),body=m.querySelector('.sv-sw-body');body.innerHTML=`<div>${posterMarkup(g)}</div><div><h2 class="sv-sw-title">${escText(g.title)}</h2><div class="sv-sw-summary">${g.files.length.toLocaleString()} downloadable file${g.files.length===1?'':'s'} · ${escText(g.platforms.join(', ')||'Software')}<br>Sources: ${escText(g.hosts.join(', ')||'External')}</div><div class="sv-sw-badges">${g.platforms.map(x=>`<span class="sv-sw-badge">${escText(x)}</span>`).join('')}${g.exts.map(x=>`<span class="sv-sw-badge">${escText(x)}</span>`).join('')}</div><div class="sv-sw-file-heading">Available files (${g.files.length.toLocaleString()})</div><div class="sv-sw-files">${g.files.map(fileRow).join('')}</div></div>`;m.setAttribute('aria-hidden','false');queuePoster(body.querySelector('[data-poster-key]'),g);}

  function observe(){
    const filters=document.getElementById('downloadsFilters');if(filters)new MutationObserver(()=>toggle(softwareButtonActive())).observe(filters,{subtree:true,attributes:true,childList:true,characterData:true});
    const count=document.getElementById('downloadsCount');if(count)new MutationObserver(()=>{if(state.active)setTimeout(setCount,0);}).observe(count,{childList:true,characterData:true,subtree:true});
    const input=document.getElementById('downloadsSearchInput');if(input)input.addEventListener('input',()=>{if(state.active)applyFilter(input.value);});
    document.addEventListener('click',e=>{const card=e.target.closest?.('.sv-sw-card[data-title-key]');if(card){e.preventDefault();openModal(card.dataset.titleKey);}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
    document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||!img.closest('.sv-sw-poster'))return;const stage=Number(img.dataset.stage||0),id=img.dataset.id||'';if(stage===0&&id){img.dataset.stage='1';img.src=`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(id)}/library_600x900.jpg`;return;}if(stage<=1&&img.dataset.tiny){img.dataset.stage='2';img.src=img.dataset.tiny;return;}img.hidden=true;},true);
    window.addEventListener('scroll',()=>{if(!state.active)return;if(innerHeight+scrollY>document.body.offsetHeight-700&&state.rendered<state.filtered.length)render(false);},{passive:true});
    toggle(softwareButtonActive());
  }

  installStyles();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
