(function(){
  function svLiveCardHTML(ch, i, compact=false){
    const initial = esc((ch.name || '?').charAt(0).toUpperCase());
    const color = typeof svChannelColor === 'function' ? svChannelColor(ch) : (ch.color || '#8f8f99');
    const imgEl = typeof svChannelLogoHTML === 'function'
      ? svChannelLogoHTML(ch, false)
      : (ch.logo ? `<img src="${esc(ch.logo)}" alt="${esc(ch.name || 'Channel')}" class="channel-logo" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '');
    const safeId = esc(ch.id || '');
    const safeName = esc(ch.name || '').replace(/'/g,"\\'");
    if(compact){
      return `<div class="live-ch-card" style="--ch-color:${color}" onclick="openLiveChannel('${safeId}','${safeName}')" aria-label="${esc(ch.name||'Channel')}">
        <div class="live-ch-inner">
          ${imgEl}
          <div class="live-ch-initial" style="${ch.logo?'display:none':''}">${initial}</div>
        </div>
      </div>`;
    }
    const hasUrl = !!ch.url;
    return `<div class="channel-card" style="--ch-color:${color};${!hasUrl?'opacity:.45;cursor:default':''}" onclick="${hasUrl?`openLiveChannel('${safeId}','${safeName}')`:''}" aria-label="${esc(ch.name||'Channel')}">
      <div class="channel-card-inner">
        ${imgEl}
        <div class="channel-initial" style="${ch.logo?'display:none':''}">${initial}</div>
      </div>
    </div>`;
  }

  buildLiveHomeRow = function(){
    if(!channels || !channels.length){ hide('liveHomeRow'); return; }
    const track = document.getElementById('liveHomeTrack');
    if(!track){ hide('liveHomeRow'); return; }
    svRenderVirtualTrackElement(track, channels, (ch,i)=>svLiveCardHTML(ch,i,true), {
      initial:window.innerWidth < 760 ? 6 : 10,
      buffer:4,
      rowId:'liveHomeRow'
    });
    show('liveHomeRow');
  };

  buildLiveTV = function(){
    const cats = ['All', ...new Set((channels || []).map(c=>c.category).filter(Boolean))];
    const catsEl = document.getElementById('liveCats');
    if(catsEl){
      catsEl.innerHTML = cats.map(c=>`<button class="live-cat${c===currentLiveCat?' active':''}" onclick="filterLiveCat('${esc(c).replace(/'/g,"\\'")}')">${esc(c)}</button>`).join('');
    }
    if(currentTab === 'live')renderLiveGrid();
  };

  filterLiveCat = function(cat){
    currentLiveCat = cat;
    document.querySelectorAll('.live-cat').forEach(el=>el.classList.toggle('active', el.textContent === cat));
    renderLiveGrid();
  };

  renderLiveGrid = function(){
    const grid = document.getElementById('liveGrid');
    if(!grid)return;
    const filtered = currentLiveCat === 'All' ? (channels || []) : (channels || []).filter(c=>c.category === currentLiveCat);
    if(!filtered.length){
      grid.innerHTML = `<div class="live-setup-note"><h3>No channels in this category</h3><p>Add channels to <code>channels.json</code> in your server folder.</p></div>`;
      return;
    }
    svRenderGridProgressive(grid, filtered, (ch,i)=>svLiveCardHTML(ch,i,false), 64);
  };

  document.addEventListener('scroll', ()=>{
    if(currentTab !== 'live')return;
    const grid = document.getElementById('liveGrid');
    if(!grid || !grid._svItems || grid._svRendered >= grid._svItems.length)return;
    if(window.innerHeight + window.scrollY > document.body.offsetHeight - 700)svAppendGridItems(grid);
  }, { passive:true });
})();
