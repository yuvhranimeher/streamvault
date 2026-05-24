(function(){
  var SV_PERF_HOME_LEGACY_MAIN = [
    { rowId:'netflixRow', trackId:'netflixTrack', sectionKey:'netflix', title:'Netflix Originals' },
    { rowId:'marvelRow', trackId:'marvelTrack', sectionKey:'marvel', title:'Marvel Studios' },
    { rowId:'dcRow', trackId:'dcTrack', sectionKey:'dc', title:'DC' },
    { rowId:'trendingRow', trackId:'trendingTrack', sectionKey:'trending', title:'🔥 Trending Now' },
    { rowId:'seriesRow', trackId:'seriesTrack', sectionKey:'series', title:'Series' },
    { rowId:'newRow', trackId:'newTrack', sectionKey:'new', title:'New to StreamVault' },
    { rowId:'universalRow', trackId:'universalTrack', sectionKey:'universal', title:'Universal Pictures' },
    { rowId:'disneyRow', trackId:'disneyTrack', sectionKey:'disney', title:'Disney' },
    { rowId:'warnerRow', trackId:'warnerTrack', sectionKey:'warner', title:'Warner Bros' },
    { rowId:'hboRow', trackId:'hboTrack', sectionKey:'hbo', title:'HBO' },
    { rowId:'appleTvRow', trackId:'appleTvTrack', sectionKey:'apple', title:'Apple TV+' },
    { rowId:'indianRow', trackId:'indianTrack', sectionKey:'indian', title:'Indian Movies & Drama' },
    { rowId:'dramaRow', trackId:'dramaTrack', sectionKey:'drama', title:'Drama & Emotion' },
    { rowId:'spanishRow', trackId:'spanishTrack', sectionKey:'spanish', title:'Spanish & Latino' },
    { rowId:'highRatedRow', trackId:'highRatedTrack', sectionKey:'topRated', title:'⭐ Top Rated (8+)' },
    { rowId:'allRow', trackId:'allTrack', sectionKey:'allMovies', title:'All Movies' }
  ];
  var SV_PERF_HOME_MAIN = [
    { rowId:'netflixRow', trackId:'netflixTrack', sectionKey:'netflix', title:'Netflix Originals' },
    { rowId:'marvelRow', trackId:'marvelTrack', sectionKey:'marvel', title:'Marvel Studios' },
    { rowId:'dcRow', trackId:'dcTrack', sectionKey:'dc', title:'DC' },
    { rowId:'trendingRow', trackId:'trendingTrack', sectionKey:'trending', title:'🔥 Trending Now' },
    { rowId:'seriesRow', trackId:'seriesTrack', sectionKey:'series', title:'Series' },
    { rowId:'newRow', trackId:'newTrack', sectionKey:'new', title:'New to StreamVault' },
    { rowId:'universalRow', trackId:'universalTrack', sectionKey:'universal', title:'Universal Pictures' },
    { rowId:'disneyRow', trackId:'disneyTrack', sectionKey:'disney', title:'Disney' },
    { rowId:'warnerRow', trackId:'warnerTrack', sectionKey:'warner', title:'Warner Bros' },
    { rowId:'hboRow', trackId:'hboTrack', sectionKey:'hbo', title:'HBO' },
    { rowId:'appleTvRow', trackId:'appleTvTrack', sectionKey:'apple', title:'Apple TV+' },
    { rowId:'indianRow', trackId:'indianTrack', sectionKey:'indian', title:'Indian Movies & Drama' },
    { rowId:'animeRow', trackId:'animeTrack', sectionKey:'anime', title:'Anime' },
    { rowId:'koreanRow', trackId:'koreanTrack', sectionKey:'koreanDrama', title:'Korean Drama' },
    { rowId:'horrorRow', trackId:'horrorTrack', sectionKey:'horrorNights', title:'Horror Nights' },
    { rowId:'scifiRow', trackId:'scifiTrack', sectionKey:'cyberpunkScifi', title:'Cyberpunk & Sci-Fi' },
    { rowId:'mindfuckRow', trackId:'mindfuckTrack', sectionKey:'mindfuck', title:'Mindfuck Movies' },
    { rowId:'cultClassicsRow', trackId:'cultClassicsTrack', sectionKey:'cultClassics', title:'Cult Classics' },
    { rowId:'a24Row', trackId:'a24Track', sectionKey:'a24', title:'A24 Collection' },
    { rowId:'nostalgia90sRow', trackId:'nostalgia90sTrack', sectionKey:'nostalgia90s', title:'90s Nostalgia' },
    { rowId:'midnightCinemaRow', trackId:'midnightCinemaTrack', sectionKey:'midnightCinema', title:'Midnight Cinema' },
    { rowId:'trueCrimeRow', trackId:'trueCrimeTrack', sectionKey:'trueCrime', title:'True Crime' },
    { rowId:'thrillerRow', trackId:'thrillerTrack', sectionKey:'psychThriller', title:'Psychological Thriller' },
    { rowId:'adultAnimationRow', trackId:'adultAnimationTrack', sectionKey:'adultAnimation', title:'Adult Animation' },
    { rowId:'postApocalypticRow', trackId:'postApocalypticTrack', sectionKey:'postApocalyptic', title:'Post-Apocalyptic' },
    { rowId:'feelGoodRow', trackId:'feelGoodTrack', sectionKey:'feelGood', title:'Feel Good Movies' },
    { rowId:'darkComedyRow', trackId:'darkComedyTrack', sectionKey:'darkComedy', title:'Dark Comedy' },
    { rowId:'timeTravelRow', trackId:'timeTravelTrack', sectionKey:'timeTravel', title:'Time Travel' },
    { rowId:'spaceAiRow', trackId:'spaceAiTrack', sectionKey:'spaceAi', title:'Space & AI' },
    { rowId:'crimeRow', trackId:'crimeTrack', sectionKey:'crimeSyndicates', title:'Crime Syndicates' },
    { rowId:'zombieRow', trackId:'zombieTrack', sectionKey:'zombie', title:'Zombie Universe' },
    { rowId:'indieGemsRow', trackId:'indieGemsTrack', sectionKey:'indieGems', title:'Indie Gems' },
    { rowId:'hiddenMasterpiecesRow', trackId:'hiddenMasterpiecesTrack', sectionKey:'hiddenMasterpieces', title:'Hidden Masterpieces' },
    { rowId:'liveConcertsRow', trackId:'liveConcertsTrack', sectionKey:'liveConcerts', title:'Live Concerts' },
    { rowId:'documentaryRow', trackId:'documentaryTrack', sectionKey:'documentaryVault', title:'Documentary Vault' },
    { rowId:'ghibliRow', trackId:'ghibliTrack', sectionKey:'ghibli', title:'Studio Ghibli' },
    { rowId:'romanticRow', trackId:'romanticTrack', sectionKey:'romanceMidnight', title:'Romance After Midnight' },
    { rowId:'comingSoonRow', trackId:'comingSoonTrack', sectionKey:'comingSoon', title:'Coming Soon' },
    { rowId:'dramaRow', trackId:'dramaTrack', sectionKey:'drama', title:'Drama & Emotion' },
    { rowId:'spanishRow', trackId:'spanishTrack', sectionKey:'spanish', title:'Spanish & Latino' },
    { rowId:'highRatedRow', trackId:'highRatedTrack', sectionKey:'topRated', title:'⭐ Top Rated (8+)' },
    { rowId:'allRow', trackId:'allTrack', sectionKey:'allMovies', title:'All Movies' },
    { rowId:'recentlyAddedRow', trackId:'recentlyAddedTrack', sectionKey:'recentlyAdded', title:'Recently Added' },
    { rowId:'mostWatchedTodayRow', trackId:'mostWatchedTodayTrack', sectionKey:'mostWatchedToday', title:'Most Watched Today' }
  ];
  var SV_PERF_HOME_BY_ID = Object.fromEntries(SV_PERF_HOME_MAIN.map(row=>[row.rowId,row]));
  var svHomePayload = null;
  var svHomePayloadPromise = null;
  var svHomeObserver = null;
  var svSectionState = { key:'', page:0, pages:0, items:[] };
  var svLegacyBuildRows = buildRows;
  var svHomeHeroClaims = new Set();
  var svHomeRowClaims = new Map();
  var svWeakDevice = ((navigator.deviceMemory || 4) <= 2) || ((navigator.hardwareConcurrency || 4) <= 2) || (innerWidth < 760 && ((navigator.deviceMemory || 4) <= 3));

  function svHomeRenderer(item, index){
    const isSeries = item?.type === 'tv' || item?.type === 'series' || item?.isSummary || item?.seasons;
    return isSeries ? sCardHTML(item) : cardHTML(item);
  }

  function svCleanHomeTitle(value){
    return String(value || '')
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,5}$/i,' ')
      .replace(/\b(2160p|1080p|720p|480p|4k|uhd|hdr|webrip|web[-\s]?dl|bluray|x264|x265|hevc|aac|dual audio|multi audio|hindi|english|bengali|bangla)\b.*$/ig,' ')
      .replace(/\b(tv series|web series|season \d+|s\d{1,2}e\d{1,3})\b/ig,' ')
      .replace(/\b(19|20)\d{2}\b/g,' ')
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function svPosterKey(url){
    const raw = String(url || '').trim();
    if(!raw)return '';
    try{
      const parsed = new URL(raw, location.origin);
      return parsed.pathname.toLowerCase().replace(/\/(w\d+|original)\//g,'/').replace(/\.[a-z0-9]{2,5}$/,'');
    }catch(_){
      return raw.toLowerCase().split('?')[0].replace(/\.[a-z0-9]{2,5}$/,'');
    }
  }

  function svHomeItemKeys(item){
    const keys = [];
    const poster = svPosterKey(item?.poster);
    const backdrop = svPosterKey(item?.backdrop);
    if(poster)keys.push(`poster:${poster}`);
    if(backdrop)keys.push(`poster:${backdrop}`);
    if(item?.tmdbId)keys.push(`tmdb:${item.tmdbId}`);
    return keys;
  }

  function svHomeTitleKey(item){
    const kind = item?.type === 'tv' || item?.type === 'series' || item?.isSummary || item?.seasons ? 'series' : 'movie';
    const title = svCleanHomeTitle(item?.name || item?.title || item?.file || '');
    return title ? `${kind}:${title}` : '';
  }

  function svResetHomeClaims(){
    svHomeHeroClaims = new Set();
    svHomeRowClaims = new Map();
    (heroMovies || []).forEach(item=>svHomeItemKeys(item).forEach(key=>svHomeHeroClaims.add(key)));
  }

  function svClaimHomeItems(rowId, items, limit){
    const activeClaims = new Set(svHomeHeroClaims);
    svHomeRowClaims.forEach((claims, owner)=>{
      if(owner !== rowId)claims.forEach(key=>activeClaims.add(key));
    });
    const owned = new Set();
    const ownedTitles = new Set();
    const out = [];
    const take = (item, allowPreviousClaims)=>{
      const keys = svHomeItemKeys(item);
      const title = svHomeTitleKey(item);
      if(!keys.length && !title)return false;
      if(title && ownedTitles.has(title))return false;
      if(keys.some(key=>owned.has(key)))return false;
      if(!allowPreviousClaims && keys.some(key=>activeClaims.has(key)))return false;
      keys.forEach(key=>owned.add(key));
      if(title)ownedTitles.add(title);
      out.push(item);
      return true;
    };
    for(const item of items || []){
      take(item, false);
      if(out.length >= limit)break;
    }
    const minFill = Math.min(limit, svWeakDevice ? 6 : 10, (items || []).length);
    if(out.length < minFill){
      for(const item of items || []){
        take(item, true);
        if(out.length >= limit || out.length >= minFill)break;
      }
    }
    svHomeRowClaims.set(rowId, owned);
    return out;
  }

  function svSkeletonTrack(track){
    if(!track)return;
    if(track.querySelector('.card,.live-ch-card'))return;
    if(track.children.length)return;
    const count = svWeakDevice ? (window.innerWidth < 760 ? 3 : 5) : (window.innerWidth < 760 ? 5 : 8);
    track.innerHTML = Array.from({length:count},()=>'<div class="sv-skeleton-card"></div>').join('');
  }

  svEnsureHomeRow = function(rowId){
    const main = document.getElementById('mainSection');
    const meta = SV_PERF_HOME_BY_ID[rowId];
    if(!main || !meta)return null;
    let row = document.getElementById(rowId);
    if(!row){
      row = document.createElement('div');
      row.className = 'row';
      row.id = rowId;
      row.style.display = 'none';
      row.innerHTML = `<div class="row-header"><div class="row-title"></div></div><div class="cards-track"></div>`;
    }
    row.dataset.sectionKey = meta.sectionKey;
    const header = row.querySelector('.row-header') || row.insertBefore(document.createElement('div'), row.firstChild);
    header.classList.add('row-header');
    let title = header.querySelector('.row-title');
    if(!title){
      title = document.createElement('div');
      title.className = 'row-title';
      header.prepend(title);
    }
    title.textContent = meta.title;
    title.setAttribute('role','button');
    title.tabIndex = 0;
    title.onclick = ()=>openHomeSection(rowId);
    title.onkeydown = e=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openHomeSection(rowId); } };
    let explore = header.querySelector('.row-explore[data-perf-section]');
    if(!explore){
      explore = document.createElement('div');
      explore.className = 'row-explore';
      explore.dataset.perfSection = '1';
      explore.textContent = 'View All →';
      explore.onclick = ()=>openHomeSection(rowId);
      header.appendChild(explore);
    }
    let track = document.getElementById(meta.trackId) || row.querySelector('.cards-track');
    if(!track){
      track = document.createElement('div');
      row.appendChild(track);
    }
    track.className = 'cards-track';
    track.id = meta.trackId;
    return row;
  };

  svApplyHomeOrder = function(){
    const main = document.getElementById('mainSection');
    if(!main)return;
    const liveRow = document.getElementById('liveHomeRow');
    if(liveRow)main.appendChild(liveRow);
    const continueRow = document.getElementById('continueRow');
    if(continueRow)main.appendChild(continueRow);
    SV_PERF_HOME_MAIN.forEach(meta=>{
      const row = svEnsureHomeRow(meta.rowId);
      if(row)main.appendChild(row);
    });
    ['becauseRow'].forEach(id=>{
      const row = document.getElementById(id);
      if(row)main.appendChild(row);
    });
    Array.from(main.children).forEach(el=>{
      if(el.classList?.contains('row') && !SV_PERF_HOME_BY_ID[el.id] && !['continueRow','liveHomeRow','becauseRow'].includes(el.id)){
        el.style.display = 'none';
      }
    });
    hide('becauseRow');
    svEnhanceCarouselControls();
  };

  function svFetchHomeFeed(limit){
    const requestedLimit = limit || (svWeakDevice ? 12 : 24);
    if(svHomePayload && (svHomePayload._limit || 0) >= requestedLimit)return Promise.resolve(svHomePayload);
    if(svHomePayloadPromise)return svHomePayloadPromise;
    svHomePayloadPromise = fetch(`/api/home-feed?limit=${requestedLimit}`)
      .then(r=>r.ok ? r.json() : Promise.reject(new Error('home feed failed')))
      .then(data=>{
        data._limit = requestedLimit;
        svHomePayload = data;
        return data;
      })
      .finally(()=>{ svHomePayloadPromise = null; });
    return svHomePayloadPromise;
  }
  const svHomeFeedPrime = svFetchHomeFeed(svWeakDevice ? 12 : 24).catch(()=>null);

  function svFetchHomeSection(meta){
    return fetch(`/api/section/${encodeURIComponent(meta.sectionKey)}?page=0&limit=${svWeakDevice ? 12 : 24}&summary=1`)
      .then(r=>r.ok ? r.json() : Promise.reject(new Error(`section ${meta.sectionKey} failed`)))
      .then(data=>({ rowId:meta.rowId, items:Array.isArray(data?.items) ? data.items : [] }))
      .catch(err=>{
        console.warn('[Homepage] section unavailable:', meta.sectionKey, err.message);
        return { rowId:meta.rowId, items:[] };
      });
  }

  function svLoadHomeSections(){
    const immediateCount = svWeakDevice ? 2 : 4;
    const immediate = SV_PERF_HOME_MAIN.slice(0, immediateCount);
    const delayed = SV_PERF_HOME_MAIN.slice(immediateCount);
    const renderRows = data=>{
      const feedRows = Array.isArray(data?.rows) ? data.rows : [];
      const rowMap = Object.fromEntries(feedRows.map(row=>[row.rowId,row]));
      svRenderHeroFromFeed(data);
      immediate.forEach((meta, idx)=>svPrepareHomeRow(meta.rowId, rowMap[meta.rowId], idx < (svWeakDevice ? 2 : 3)));
      svRenderPersonalRows();
      svApplyHomeOrder();
      if(typeof svPrefetchHomeFeedPosters === 'function')svPrefetchHomeFeedPosters(data);
      const idle = window.requestIdleCallback || (fn=>setTimeout(fn,120));
      delayed.forEach((meta, i)=>{
        idle(()=>Promise.resolve(rowMap[meta.rowId] || svFetchHomeSection(meta)).then(row=>{
          svPrepareHomeRow(row.rowId, row, false);
          svApplyHomeOrder();
        }), { timeout: (svWeakDevice ? 1800 : 1200) + i * (svWeakDevice ? 180 : 120) });
      });
    };
    const renderSectionFallback = ()=>{
      immediate.forEach((meta, idx)=>{
        svFetchHomeSection(meta).then(row=>svPrepareHomeRow(meta.rowId, row, idx < (svWeakDevice ? 2 : 3)));
      });
      svRenderPersonalRows();
      svApplyHomeOrder();
      const idle = window.requestIdleCallback || (fn=>setTimeout(fn,120));
      delayed.forEach((meta, i)=>{
        idle(()=>svFetchHomeSection(meta).then(row=>{
          svPrepareHomeRow(row.rowId, row, false);
          svApplyHomeOrder();
        }), { timeout:(svWeakDevice ? 1800 : 1200) + i * (svWeakDevice ? 180 : 120) });
      });
    };
    return svFetchHomeFeed(svWeakDevice ? 8 : 12)
      .then(renderRows)
      .catch(err=>{
        console.warn('[Homepage] home-feed unavailable, using section APIs:', err.message);
        renderSectionFallback();
      });
  }

  function svObserveRow(row){
    if(!row || row._svObserved || row._svLoaded)return;
    if(!svHomeObserver){
      svHomeObserver = new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting || entry.intersectionRatio > 0){
            svHomeObserver.unobserve(entry.target);
            svMountHomeRow(entry.target.id);
          }
        });
      }, { root:null, rootMargin:svWeakDevice ? '420px 0px 560px 0px' : '850px 0px 850px 0px', threshold:.01 });
    }
    row._svObserved = true;
    svHomeObserver.observe(row);
  }

  function svPrepareHomeRow(rowId, rowData, immediate){
    const meta = SV_PERF_HOME_BY_ID[rowId];
    const row = svEnsureHomeRow(rowId);
    if(!row || !meta)return;
    const items = Array.isArray(rowData?.items) ? rowData.items : [];
    const track = document.getElementById(meta.trackId);
    if(!items.length){
      if(track?.querySelector('.card,.live-ch-card')){
        show(rowId);
        return;
      }
      hide(rowId);
      return;
    }
    if(track?.querySelector('.card,.live-ch-card')){
      row._svItems = items;
      row._svLoaded = true;
      row.classList.remove('sv-row-pending');
      row.classList.add('sv-row-loaded');
      svRenderLazyTrack(meta.trackId, rowId, items, svHomeRenderer, {
        limit:svWeakDevice ? 36 : 50,
        initial:svInitialCardCount(rowId),
        buffer:svWeakDevice ? (window.innerWidth < 760 ? 1 : 2) : (window.innerWidth < 760 ? 3 : 4),
        virtual:true
      });
      show(rowId);
      return;
    }
    row._svItems = items;
    row._svLoaded = false;
    row._svObserved = false;
    row.classList.add('sv-row-pending');
    row.classList.remove('sv-row-loaded');
    svSkeletonTrack(document.getElementById(meta.trackId));
    show(rowId);
    if(immediate) svMountHomeRow(rowId);
    else svObserveRow(row);
  }

  function svRenderPersonalRows(){
    const cont = (movies || []).filter(m=>!m.isTrending && watchProgress[m.id]?.progress > 0.02 && watchProgress[m.id]?.progress < 0.95);
    if(cont.length){
      svRenderLazyTrack('continueTrack','continueRow',cont,m=>cardHTML(m,true),{limit:30,initial:svInitialCardCount('continueRow'),buffer:3});
    }else{
      hide('continueRow');
    }
    hide('becauseRow');
  }

  window.svMountHomeRow = function(rowId){
    const meta = SV_PERF_HOME_BY_ID[rowId];
    const row = document.getElementById(rowId);
    if(!meta || !row || row._svLoaded)return;
    const items = row._svItems || [];
    if(!items.length){ hide(rowId); return; }
    svRenderLazyTrack(meta.trackId, rowId, items, svHomeRenderer, {
      limit:svWeakDevice ? 36 : 50,
      initial:svInitialCardCount(rowId),
      buffer:svWeakDevice ? (window.innerWidth < 760 ? 1 : 2) : (window.innerWidth < 760 ? 3 : 4),
      virtual:true
    });
    row._svLoaded = true;
    row.classList.remove('sv-row-pending');
    row.classList.add('sv-row-loaded');
  };

  function svCardPitch(track, rowId){
    const cs = getComputedStyle(track);
    const gap = parseFloat(cs.columnGap || cs.gap || '16') || 16;
    const first = track.querySelector('.card,.live-ch-card');
    let width = first ? first.getBoundingClientRect().width : 0;
    if(!width){
      if(track.classList.contains('live-home-track')) width = window.innerWidth < 760 ? 72 : 92;
      else if(rowId === 'marvelRow' || rowId === 'dcRow') width = Math.min(Math.max(window.innerWidth * .76, 260), 430);
      else width = Math.min(Math.max(window.innerWidth * .30, 118), 162);
    }
    return Math.max(64, width + gap);
  }

  function svRowItemKey(item){
    const type = item?.type || (item?.seasons ? 'series' : 'movie');
    return [
      type,
      item?.tmdbId,
      item?.id,
      item?.streamUrl,
      item?.name || item?.title || item?.file,
      item?.poster,
      item?.backdrop
    ].filter(Boolean).join('|').toLowerCase();
  }

  function svRowItemKeys(items){
    return (items || []).map(svRowItemKey);
  }

  function svSameKeys(a=[], b=[]){
    if(a.length !== b.length)return false;
    return a.every((key, i)=>key === b[i]);
  }

  function svTrackCards(track){
    return Array.from(track?.querySelectorAll?.('.card,.live-ch-card') || []);
  }

  function svTrackRenderedKeys(track, rendered){
    const saved = track._svRenderedKeys || [];
    if(saved.length >= rendered)return saved.slice(0, rendered);
    const itemKeys = track._svItemKeys || svRowItemKeys(track._svItems || []);
    return itemKeys.slice(0, rendered);
  }

  function svClearTrackSkeletons(track){
    track.querySelectorAll('.sv-skeleton-card').forEach(el=>el.remove());
  }

  function svAppendOnlyUpdate(track, force=false){
    if(!track || !track._svItems || !track._svRenderItem)return;
    const total = track._svItems.length;
    if(!total)return;
    const rendered = Math.max(track._svRendered || 0, svTrackCards(track).length);
    if(rendered >= total)return;
    const nearEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - Math.max(320, track.clientWidth * .55);
    if(!force && !nearEnd)return;
    const batch = track._svBatch || (svWeakDevice ? 4 : 6);
    const target = Math.min(total, rendered + (force ? (track._svInitial || batch) : batch));
    if(target <= rendered)return;
    const rowId = track._svRowId || track.closest('.row')?.id || '';
    const priorityCount = window.innerWidth < 760 || svWeakDevice ? 5 : 8;
    const html = track._svItems.slice(rendered, target).map((item,i)=>{
      const index = rendered + i;
      const immediateImage = index < priorityCount;
      const highPriorityImage = (rowId === 'newRow' && index < 6) || (rowId === 'recentlyAddedRow' && index < 6);
      const priorityItem = (immediateImage || highPriorityImage) ? {...item, _immediateImage:immediateImage, _priorityImage:highPriorityImage} : item;
      return track._svRenderItem(priorityItem, index);
    }).join('');
    if(rendered === 0)svClearTrackSkeletons(track);
    track.insertAdjacentHTML('beforeend', html);
    track._svRendered = target;
    const keys = track._svItemKeys || svRowItemKeys(track._svItems);
    const cards = svTrackCards(track);
    for(let i=rendered;i<target && i<cards.length;i++){
      cards[i].dataset.svKey = keys[i] || '';
    }
    track._svRenderedKeys = keys.slice(0, target);
    if(typeof svQueuePosterImages === 'function')svQueuePosterImages(track);
    const row = track.closest('.row');
    if(row)setTimeout(()=>svUpdateCarouselControls(row),20);
  }

  window.svRenderVirtualTrackElement = function(track, items, renderItem, opts={}){
    if(!track)return;
    const list = (items || []).slice(0, opts.limit || items.length || 0);
    const rowId = opts.rowId || track.closest('.row')?.id || '';
    const nextKeys = svRowItemKeys(list);
    const existingCards = svTrackCards(track);
    const prevItems = track._svItems || [];
    const prevKeys = track._svItemKeys || svRowItemKeys(prevItems);
    track._svItems = list;
    track._svRenderItem = renderItem;
    track._svInitial = opts.initial || (window.innerWidth < 760 ? 7 : 10);
    track._svBuffer = opts.buffer ?? (svWeakDevice ? 1 : (window.innerWidth < 760 ? 3 : 4));
    track._svBatch = opts.batch || (svWeakDevice ? 4 : (window.innerWidth < 760 ? 5 : 6));
    track._svRowId = rowId;
    track._svItemKeys = nextKeys;
    track.dataset.lazyAppend = '1';
    if(!track.dataset.lazyAppendBound){
      track.dataset.lazyAppendBound = '1';
      track.addEventListener('scroll', ()=>{
        if(track._svRaf)return;
        track._svRaf = requestAnimationFrame(()=>{
          track._svRaf = 0;
          svAppendOnlyUpdate(track);
        });
      }, { passive:true });
      if(!window._svAppendOnlyResizeBound){
        window._svAppendOnlyResizeBound = true;
        window.addEventListener('resize', ()=>{
          document.querySelectorAll('[data-lazy-append="1"]').forEach(t=>svAppendOnlyUpdate(t));
        }, { passive:true });
      }
    }
    if(existingCards.length){
      const rendered = Math.max(track._svRendered || 0, existingCards.length);
      const savedRenderedKeys = track._svRenderedKeys || [];
      const renderedKeys = savedRenderedKeys.length >= rendered ? savedRenderedKeys.slice(0, rendered) : (prevKeys.length ? prevKeys.slice(0, rendered) : nextKeys.slice(0, rendered));
      const currentKeys = prevKeys;
      if(svSameKeys(currentKeys, nextKeys) || svSameKeys(renderedKeys, nextKeys.slice(0, renderedKeys.length))){
        track._svRendered = rendered;
        track._svRenderedKeys = renderedKeys;
        return;
      }
      const renderedSet = new Set(renderedKeys.filter(Boolean));
      const existingItems = prevItems.length >= rendered ? prevItems.slice(0, rendered) : list.slice(0, rendered);
      const appendItems = [];
      const appendKeys = [];
      list.forEach((item, i)=>{
        const key = nextKeys[i];
        if(key && renderedSet.has(key))return;
        appendItems.push(item);
        appendKeys.push(key);
        if(key)renderedSet.add(key);
      });
      if(!appendItems.length){
        track._svRendered = rendered;
        track._svRenderedKeys = renderedKeys;
        return;
      }
      track._svItems = existingItems.concat(appendItems);
      track._svItemKeys = renderedKeys.concat(appendKeys);
      track._svRendered = rendered;
      track._svRenderedKeys = renderedKeys;
      svAppendOnlyUpdate(track, true);
      return;
    }
    track._svRendered = 0;
    track._svRenderedKeys = [];
    svAppendOnlyUpdate(track, true);
  };

  window.svAppendLazyTrack = function(track, count){
    if(!track || !track._svItems)return;
    const oldBatch = track._svBatch;
    if(count)track._svBatch = count;
    svAppendOnlyUpdate(track, true);
    track._svBatch = oldBatch;
  };

  svRenderLazyTrack = function(trackId, rowId, items, renderItem, opts={}){
    const track = document.getElementById(trackId);
    if(!track){ hide(rowId); return; }
    const limit = opts.limit || 50;
    const shouldClaim = !!(rowId && (SV_PERF_HOME_BY_ID[rowId] || ['continueRow','becauseRow'].includes(rowId)));
    const list = shouldClaim ? svClaimHomeItems(rowId, items || [], limit) : (items || []).slice(0, limit);
    if(!list.length){
      if(track.querySelector('.card,.live-ch-card')){
        show(rowId);
        return;
      }
      hide(rowId);
      return;
    }
    const nextKeys = svRowItemKeys(list);
    if(track.querySelector('.card,.live-ch-card') && svSameKeys(track._svItemKeys || [], nextKeys)){
      show(rowId);
      return;
    }
    svRenderVirtualTrackElement(track, list, renderItem, {
      ...opts,
      rowId,
      initial:opts.initial || svInitialCardCount(rowId)
    });
    show(rowId);
  };

  const SV_EXCLUSIVE_HERO_LIMIT = 72;
  const SV_EXCLUSIVE_HERO_ROWS = [
    'trendingRow',
    'netflixRow',
    'marvelRow',
    'dcRow',
    'disneyRow',
    'warnerRow',
    'universalRow',
    'hboRow',
    'appleTvRow',
    'highRatedRow'
  ];
  const SV_EXCLUSIVE_HERO_TITLE_SEEDS = [
    'dune','dune part two','oppenheimer','barbie','avatar','avatar the way of water','interstellar','inception','tenet','the batman','joker','the dark knight','man of steel','justice league','superman','wonder woman','aquaman','peacemaker','avengers','endgame','infinity war','iron man','captain america','thor','black panther','doctor strange','guardians of the galaxy','spider man','spider-man','deadpool','wolverine','logan','x men','fantastic four','stranger things','wednesday','squid game','money heist','dark','the witcher','extraction','the crown','bridgerton','narcos','lucifer','enola holmes','red notice','the last of us','house of the dragon','game of thrones','succession','true detective','chernobyl','the sopranos','the wire','band of brothers','euphoria','westworld','severance','silo','foundation','ted lasso','for all mankind','slow horses','the morning show','greyhound','coda','tetris','napoleon','killer of the flower moon','jurassic','jurassic world','fast and furious','fast & furious','oppenheimer','minions','despicable me','m3gan','get out','nope','harry potter','lord of the rings','the hobbit','the matrix','matrix','conjuring','godzilla','king kong','mad max','inside out','frozen','moana','zootopia','coco','toy story','the incredibles','pirates of the caribbean','star wars','the mandalorian','andor'
  ];

  function svExclusiveHeroClean(value){
    return String(value || '')
      .toLowerCase()
      .replace(/&/g,' and ')
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\b(the|a|an)\b/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function svExclusiveHeroSourceBoost(rowId){
    const idx = SV_EXCLUSIVE_HERO_ROWS.indexOf(rowId);
    return idx < 0 ? 0 : (SV_EXCLUSIVE_HERO_ROWS.length - idx) * 1200;
  }

  function svExclusiveHeroScore(item){
    const title = svExclusiveHeroClean(item?.name || item?.title || item?.file || '');
    const text = svExclusiveHeroClean([
      item?.name,
      item?.title,
      item?.overview,
      item?.genre,
      item?.language,
      item?.category,
      item?.productionCompanies,
      item?._heroSourceRow
    ].flat().filter(Boolean).join(' '));
    let score = svExclusiveHeroSourceBoost(item?._heroSourceRow) - (item?._heroSourceIndex || 0);
    SV_EXCLUSIVE_HERO_TITLE_SEEDS.forEach((seed, idx)=>{
      const cleanSeed = svExclusiveHeroClean(seed);
      if(!cleanSeed)return;
      if(title === cleanSeed)score += 90000 - idx * 50;
      else if(title.includes(cleanSeed) || text.includes(cleanSeed))score += 48000 - idx * 25;
    });
    const rating = parseFloat(item?.rating || item?.vote_average || 0) || 0;
    if(rating >= 8)score += 2600;
    else if(rating >= 7)score += 1200;
    const year = parseInt(String(item?.year || '').match(/(?:19|20)\d{2}/)?.[0] || '0', 10) || 0;
    if(year >= 2024)score += 1800;
    else if(year >= 2020)score += 900;
    if(item?.poster)score += 450;
    if(item?.backdrop)score += 250;
    return score;
  }

  function svExclusiveHeroTitle(item){
    return svExclusiveHeroClean(item?.name || item?.title || item?.file || '');
  }

  function svExclusiveHeroTitleNoYear(item){
    return svExclusiveHeroTitle(item).replace(/\b(19|20)\d{2}\b/g,' ').replace(/\s+/g,' ').trim();
  }

  function svExclusiveHeroBlocked(item){
    const rawTitle = String(item?.name || item?.title || item?.file || '').trim();
    const cleanTitle = svExclusiveHeroTitle(item);
    return /^mary\s*\(?2024\)?$/i.test(rawTitle) || cleanTitle === 'mary 2024';
  }

  function svExclusiveHeroGroupKeys(item){
    const keys = [];
    const poster = svPosterKey(item?.poster);
    const backdrop = svPosterKey(item?.backdrop);
    const title = svExclusiveHeroTitleNoYear(item);
    if(poster)keys.push(`art:${poster}`);
    if(backdrop)keys.push(`art:${backdrop}`);
    if(item?.tmdbId)keys.push(`tmdb:${item?.type || (item?.seasons ? 'series' : 'movie')}:${item.tmdbId}`);
    if(title)keys.push(`title:${title}`);
    return keys;
  }

  function svExclusiveHeroDedup(items){
    const seen = new Set();
    return (items || [])
      .filter(item=>item && !svExclusiveHeroBlocked(item) && (item.poster || item.backdrop) && (item.name || item.title))
      .sort((a,b)=>svExclusiveHeroScore(b) - svExclusiveHeroScore(a))
      .filter(item=>{
        const keys = svExclusiveHeroGroupKeys(item);
        if(!keys.length)return false;
        if(keys.some(key=>seen.has(key)))return false;
        keys.forEach(key=>seen.add(key));
        return true;
      });
  }

  function svExclusiveHeroItemsFromFeed(data){
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const byRow = Object.fromEntries(rows.map(row=>[row.rowId,row]));
    const candidates = [];
    SV_EXCLUSIVE_HERO_ROWS.forEach(rowId=>{
      const rowItems = byRow[rowId]?.items || [];
      rowItems.forEach((item, index)=>{
        candidates.push({ ...item, _heroSourceRow:rowId, _heroSourceIndex:index });
      });
    });
    return svExclusiveHeroDedup(candidates).slice(0, SV_EXCLUSIVE_HERO_LIMIT);
  }

  function svHeroItemsFromFeed(data){
    const exclusive = svExclusiveHeroItemsFromFeed(data);
    if(exclusive.length >= 50)return exclusive;
    const fallbackRows = Array.isArray(data?.rows) ? data.rows : [];
    const fallback = fallbackRows.flatMap(row=>(row.items || []).map((item,index)=>({ ...item, _heroSourceRow:row.rowId, _heroSourceIndex:index })));
    return svExclusiveHeroDedup([...exclusive, ...fallback]).slice(0, SV_EXCLUSIVE_HERO_LIMIT);
  }

  function svFallbackHeroItems(){
    const movieItems = (movies || [])
      .filter(m => m && (m.poster || m.backdrop))
      .map(m => ({...m, _isSeries:false, _heroSourceRow:'fallback'}));
    const seriesItems = (series || [])
      .filter(s => s && (s.poster || s.backdrop))
      .map((s,i) => ({...s, _isSeries:true, _heroSourceRow:'fallback', _heroSourceIndex:i}));
    return svExclusiveHeroDedup([...movieItems, ...seriesItems]).slice(0, SV_EXCLUSIVE_HERO_LIMIT);
  }

  function svRenderHeroCards(items){
    const cardsEl = document.getElementById('heroCards');
    if(!cardsEl)return false;
    heroMovies = svExclusiveHeroDedup(items).slice(0, SV_EXCLUSIVE_HERO_LIMIT);
    if(heroMovies.length < 50){
      heroMovies = svExclusiveHeroDedup([...heroMovies, ...svFallbackHeroItems()]).slice(0, SV_EXCLUSIVE_HERO_LIMIT);
    }
    if(!heroMovies.length)return false;
    cardsEl.innerHTML = '';
    cardsEl.classList.add('sv-exclusive-hero-track');
    const renderFeatured = (item,i)=>{
      const next = {...item, _priorityImage:i < 10, _immediateImage:i < 12};
      const isSeries = next._isSeries || next.type === 'tv' || next.type === 'series' || next.isSummary || next.seasons;
      const html = isSeries ? sCardHTML(next) : cardHTML(next);
      return html.replace('class="card"', 'class="card featured-card"');
    };
    if(typeof svRenderVirtualTrackElement === 'function'){
      svRenderVirtualTrackElement(cardsEl, heroMovies, renderFeatured, {
        rowId:'hero',
        limit:SV_EXCLUSIVE_HERO_LIMIT,
        initial:window.innerWidth < 760 ? 8 : 12,
        batch:window.innerWidth < 760 ? 6 : 8,
        buffer:window.innerWidth < 760 ? 3 : 5
      });
    }else{
      cardsEl.insertAdjacentHTML('beforeend', heroMovies.map(renderFeatured).join(''));
    }
    if(typeof svQueuePosterImages === 'function')svQueuePosterImages(cardsEl);
    if(typeof svPrefetchPosterUrls === 'function')svPrefetchPosterUrls(heroMovies.slice(0,12).map(item=>item.poster || item.backdrop));
    return true;
  }

  function svRenderHeroFromFeed(data){
    return svRenderHeroCards(svHeroItemsFromFeed(data));
  }

  buildHero = function(){
    svFetchHomeFeed(SV_EXCLUSIVE_HERO_LIMIT)
      .then(data=>{
        if(data && svRenderHeroFromFeed(data))return;
        svRenderHeroCards(svFallbackHeroItems());
      })
      .catch(()=>svRenderHeroCards(svFallbackHeroItems()));
  };

  buildRows = function(){
    svApplyHomeOrder();
    const hasRenderedRows = SV_PERF_HOME_MAIN.some(meta=>document.getElementById(meta.trackId)?.querySelector('.card,.live-ch-card'));
    svResetHomeClaims();
    if(hasRenderedRows){
      svRenderPersonalRows();
      svLoadHomeSections().catch(err=>{
        console.warn('[Homepage] section API unavailable, keeping rendered rows:', err.message);
      });
      return;
    }
    _rowSeen = new Map();
    SV_PERF_HOME_MAIN.forEach(meta=>hide(meta.rowId));
    SV_PERF_HOME_MAIN.slice(0, svWeakDevice ? 2 : 4).forEach((meta, idx)=>{
      const row = svEnsureHomeRow(meta.rowId);
      if(row){
        svSkeletonTrack(document.getElementById(meta.trackId));
        row.classList.add('sv-row-pending');
        show(meta.rowId);
      }
    });
    svLoadHomeSections().catch(err=>{
      console.warn('[Homepage] section API unavailable, using legacy rows:', err.message);
      svLegacyBuildRows?.();
    });
  };

  svRenderOnlineSections = function(rows){
    if(!rows || typeof rows !== 'object')return;
    svOnlineRowsCache = {...(svOnlineRowsCache || {}), ...rows};
    Object.entries(rows).forEach(([rowId, list])=>{
      const meta = SV_PERF_HOME_BY_ID[rowId];
      const row = document.getElementById(rowId);
      if(!meta || !row || !Array.isArray(list) || !list.length)return;
      const normalized = svDedupItems(list.map(svNormalizeOnlineItem).filter(Boolean)).slice(0,50);
      if(!normalized.length)return;
      const track = document.getElementById(meta.trackId);
      if(row._svLoaded && track?.querySelector('.card,.live-ch-card')){
        svRenderLazyTrack(meta.trackId,rowId,normalized,item=>item._isSeries?sCardHTML(item):cardHTML(item),{limit:50});
        row._svItems = track._svItems || row._svItems || normalized;
        row.classList.remove('sv-row-pending');
        row.classList.add('sv-row-loaded');
        return;
      }
      row._svItems = normalized;
      svRenderLazyTrack(meta.trackId,rowId,normalized,item=>item._isSeries?sCardHTML(item):cardHTML(item),{limit:50});
      row._svLoaded = !!track?.querySelector('.card,.live-ch-card');
      row.classList.remove('sv-row-pending');
      row.classList.add('sv-row-loaded');
    });
  };

  function svEnsureSectionPage(){
    let page = document.getElementById('sectionSection');
    if(page)return page;
    page = document.createElement('div');
    page.id = 'sectionSection';
    page.className = 'section-page';
    page.innerHTML = `
      <div class="section-page-header">
        <button class="perf-back-btn" type="button" onclick="goHome()">Back</button>
        <div class="section-page-title" id="sectionTitle"></div>
      </div>
      <div class="section-grid" id="sectionGrid"></div>
      <div class="section-load-more" id="sectionLoadWrap" style="display:none">
        <button class="perf-load-btn" type="button" onclick="svLoadMoreSection()">Load More</button>
      </div>
    `;
    document.body.insertBefore(page, document.getElementById('movieDetailModal'));
    return page;
  }

  window.svRenderGridProgressive = function(grid, items, renderer, pageSize=48){
    if(!grid)return;
    grid._svItems = items || [];
    grid._svRenderer = renderer;
    grid._svPageSize = pageSize;
    grid._svRendered = 0;
    grid.innerHTML = '';
    svAppendGridItems(grid);
  };

  window.svAppendGridItems = function(grid){
    if(!grid || !grid._svItems)return;
    const from = grid._svRendered || 0;
    const to = Math.min(grid._svItems.length, from + (grid._svPageSize || 48));
    if(from === 0)grid.innerHTML = '';
    grid.insertAdjacentHTML('beforeend', grid._svItems.slice(from,to).map(grid._svRenderer).join(''));
    grid._svRendered = to;
    if(typeof svQueuePosterImages === 'function')svQueuePosterImages(grid);
  };

  window.openHomeSection = function(rowId){
    const meta = SV_PERF_HOME_BY_ID[rowId];
    if(!meta)return;
    closeSearchOverlay(true);
    const page = svEnsureSectionPage();
    ['mainSection','hero','discoverIntro','moviesSection','seriesSection','liveSection','searchSection','librarySection','downloadsSection','mobileMp4Section'].forEach(id=>{
      const el = document.getElementById(id);
      if(el)el.style.display = 'none';
    });
    page.classList.add('open');
    document.getElementById('sectionTitle').textContent = meta.title;
    const grid = document.getElementById('sectionGrid');
    grid.innerHTML = '<div class="sv-skeleton-card"></div><div class="sv-skeleton-card"></div><div class="sv-skeleton-card"></div>';
    svSectionState = { key:meta.sectionKey, page:0, pages:1, items:[], rowId };
    fetch(`/api/section/${encodeURIComponent(meta.sectionKey)}?page=0&limit=60&summary=1`)
      .then(r=>r.json())
      .then(data=>{
        svSectionState.page = data.page || 0;
        svSectionState.pages = data.pages || 1;
        svSectionState.items = data.items || [];
        svRenderGridProgressive(grid, svSectionState.items, svHomeRenderer, 60);
        document.getElementById('sectionLoadWrap').style.display = svSectionState.page + 1 < svSectionState.pages ? 'flex' : 'none';
      })
      .catch(()=>{ grid.innerHTML = '<div class="empty"><h2>Could not load this section</h2></div>'; });
    window.scrollTo({top:0,behavior:'smooth'});
  };

  window.svLoadMoreSection = function(){
    const nextPage = (svSectionState.page || 0) + 1;
    if(nextPage >= svSectionState.pages)return;
    fetch(`/api/section/${encodeURIComponent(svSectionState.key)}?page=${nextPage}&limit=60&summary=1`)
      .then(r=>r.json())
      .then(data=>{
        svSectionState.page = data.page || nextPage;
        const grid = document.getElementById('sectionGrid');
        const items = data.items || [];
        grid.insertAdjacentHTML('beforeend', items.map(svHomeRenderer).join(''));
        if(typeof svQueuePosterImages === 'function')svQueuePosterImages(grid);
        document.getElementById('sectionLoadWrap').style.display = svSectionState.page + 1 < (data.pages || svSectionState.pages) ? 'flex' : 'none';
      });
  };

  if(!window._svSwitchWrapped){
    window._svSwitchWrapped = true;
    const svOriginalSwitchTab = switchTab;
    switchTab = function(tab){
      const section = document.getElementById('sectionSection');
      if(section)section.classList.remove('open');
      svOriginalSwitchTab(tab);
      svTrimInactivePages(tab);
    };
  }

  function svTrimInactivePages(tab){
    const idle = window.requestIdleCallback || (fn=>setTimeout(fn,160));
    idle(()=>{
      if(tab !== 'search'){
        const s = document.getElementById('searchGrid');
        const ms = document.getElementById('mobileSearchGrid');
        if(s)s.innerHTML = '';
        if(ms && !document.getElementById('searchOverlay')?.classList.contains('open'))ms.innerHTML = '';
      }
      if(tab !== 'live')document.getElementById('liveGrid')?.replaceChildren();
      if(tab !== 'movies-browse')document.getElementById('moviesGrid')?.replaceChildren();
      if(tab !== 'series')document.getElementById('seriesGrid')?.replaceChildren();
      if(tab !== 'library')document.getElementById('libraryGroups')?.replaceChildren();
      if(tab !== 'downloads')document.getElementById('downloadsGrid')?.replaceChildren();
      if(tab !== 'mobile-mp4')document.getElementById('mobileMp4Grid')?.replaceChildren();
    });
  }
})();
