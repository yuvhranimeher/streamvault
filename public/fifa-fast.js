(function(){
  'use strict';

  const CACHE_KEY = 'streamvault:fifa-live:last-real:v1';
  const FAST_PAST_MATCH_LIMIT = 6;
  const FAST_FORWARD_MATCH_LIMIT = 12;
  const HALFTIME_COLOR = '#ef4444';

  function clean(value){
    const text = String(value == null ? '' : value).trim();
    return text && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined' ? text : '';
  }

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function hasRealData(payload){
    return !!payload && ['liveMatches','upcomingMatches','recentResults','standings','headlines'].some(name=>Array.isArray(payload[name]) && payload[name].length);
  }

  function cachedPayload(){
    try{
      const payload = window.__svFifaCachedPayload || JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if(!hasRealData(payload))return null;
      if(payloadHasActiveMatch(payload))return null;
      return {
        ...payload,
        stale:true,
        source:payload.source || 'cache',
        message:payload.message || 'Showing cached football data while the live feed refreshes'
      };
    }catch(_err){
      return null;
    }
  }

  function writeCache(payload){
    try{
      if(hasRealData(payload))localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    }catch(_err){}
  }

  function provider(match){
    const raw = clean(match && match.provider || window.__svFifaFastPayload && window.__svFifaFastPayload.source).toLowerCase();
    if(raw === 'api-football' || raw.indexOf('api') !== -1)return 'api-football';
    return 'espn';
  }

  function matchKey(match){
    if(!match || !match.id)return '';
    return [provider(match), match.id, match.leagueSlug || ''].filter(Boolean).join(':');
  }

  function normalizeStatusToken(value){
    const raw = clean(value).toUpperCase().replace(/[\s.-]+/g,'_');
    const compact = raw.replace(/_/g,'');
    if(!raw)return '';
    if(['HT','BT','HALFTIME','HALFTIMEBREAK','HALF_TIME','HALF_TIME_BREAK','BREAK_TIME'].includes(raw) || compact === 'HALFTIME')return 'HALFTIME';
    if(['1H','FIRST_HALF','FIRSTHALF','STATUS_FIRST_HALF'].includes(raw) || compact === 'FIRSTHALF')return 'FIRST_HALF';
    if(['2H','SECOND_HALF','SECONDHALF','STATUS_SECOND_HALF'].includes(raw) || compact === 'SECONDHALF')return 'SECOND_HALF';
    if(['ET','EXTRA_TIME','EXTRATIME','P'].includes(raw) || compact === 'EXTRATIME')return 'EXTRA_TIME';
    if(['LIVE','IN','IN_PROGRESS','INPROGRESS','STATUS_IN_PROGRESS','ONGOING','PLAYING'].includes(raw) || compact === 'INPROGRESS')return 'LIVE';
    if(['FT','FINAL','STATUS_FINAL','FULL_TIME','FULLTIME','FINISHED','COMPLETE','COMPLETED','AET','PEN','PENALTY_SHOOTOUT','PENALTYSHOOTOUT'].includes(raw) || compact === 'FULLTIME')return 'FULL_TIME';
    if(['POSTPONED','PPD','PST','CANCELED','CANCELLED','CANC','SUSP','SUSPENDED','ABD','ABANDONED'].includes(raw))return 'POSTPONED';
    if(['NS','TBD','UPCOMING','SCHEDULED','PRE','PRE_GAME','PREGAME','NOT_STARTED'].includes(raw) || compact === 'NOTSTARTED')return 'UPCOMING';
    return raw;
  }

  function status(match){
    const tokens = [
      match && match.status,
      match && match.state,
      match && match.statusType,
      match && match.phase,
      match && match.period,
      match && match.statusText
    ];
    const clock = clean(match && (match.minute || match.clock || match.displayClock || match.time));
    if(/\b(?:HT|HALF\s*TIME|HALFTIME)\b/i.test(clock))tokens.unshift('HALFTIME');
    let code = '';
    for(const token of tokens){
      code = normalizeStatusToken(token);
      if(code)break;
    }
    if(!code && match && match.live)code = 'LIVE';
    if(!code)code = 'UPCOMING';
    const running = code === 'LIVE' || code === 'FIRST_HALF' || code === 'SECOND_HALF' || code === 'EXTRA_TIME';
    const halftime = code === 'HALFTIME';
    const finished = code === 'FULL_TIME' || code === 'FINISHED';
    const upcoming = code === 'UPCOMING';
    const postponed = code === 'POSTPONED';
    return {
      code,
      running,
      halftime,
      finished,
      upcoming,
      postponed,
      active:running || halftime,
      label:halftime ? 'Half Time' : (finished ? 'FINAL' : (postponed ? 'POSTPONED' : (upcoming ? 'UPCOMING' : 'LIVE'))),
      className:halftime ? 'is-halftime' : (finished ? 'is-result' : (postponed || upcoming ? 'is-upcoming' : 'is-live')),
      extraClass:halftime ? 'is-halftime' : (finished ? 'is-final' : '')
    };
  }

  function payloadHasActiveMatch(payload){
    return ['liveMatches','upcomingMatches','recentResults'].some(name=>Array.isArray(payload && payload[name]) && payload[name].some(match=>status(match).active));
  }

  function updateLiveShortcut(payload){
    const live = Array.isArray(payload && payload.liveMatches) && payload.liveMatches.some(match=>status(match).active);
    document.documentElement.classList.toggle('sv-fifa-match-live', !!live);
    const btn = document.getElementById('bnLiveMatch');
    if(btn){
      btn.classList.toggle('is-live', !!live);
      btn.dataset.fifaLive = live ? '1' : '0';
    }
  }

  function score(value){
    return value === 0 || value ? String(value) : '-';
  }

  function timeLabel(value){
    const text = clean(value);
    if(!text)return '';
    const date = new Date(text);
    if(Number.isNaN(date.getTime()))return text;
    return date.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }

  function clockBaseSeconds(match){
    const raw = clean(match && (match.minute || match.clock || match.displayClock || match.time));
    if(!raw || /\b(?:HT|HALF\s*TIME|HALFTIME)\b/i.test(raw))return null;
    const added = raw.match(/(\d+)\s*\+\s*(\d+)/);
    if(added)return (Number(added[1]) + Number(added[2])) * 60;
    const colon = raw.match(/(\d{1,3})\s*:\s*(\d{1,2})/);
    if(colon)return Number(colon[1]) * 60 + Math.min(59, Number(colon[2]) || 0);
    const number = raw.match(/\d{1,3}/);
    return number ? Number(number[0]) * 60 : null;
  }

  function formatClock(seconds){
    if(!Number.isFinite(seconds))return '';
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2,'0')}`;
  }

  function matchTime(match){
    const state = status(match);
    if(state.running)return formatClock(clockBaseSeconds(match)) || 'Live';
    if(state.halftime)return 'Half Time';
    if(state.finished)return 'FT';
    if(state.postponed)return 'Postponed';
    return timeLabel(match && (match.startTime || match.kickoff));
  }

  function matchMeta(match){
    return [
      clean(match && (match.competition || match.league || match.stage || match.group)),
      clean(match && match.venue),
      matchTime(match)
    ].filter(Boolean).join(' / ');
  }

  function countdownText(match){
    if(!match)return '';
    const state = status(match);
    if(state.halftime)return 'Half Time';
    if(state.finished)return 'FT';
    if(state.postponed)return 'Postponed';
    if(state.running){
      const base = window.__svFifaFastCountdownBaseSeconds;
      const startedAt = window.__svFifaFastCountdownStartedAt || Date.now();
      const seconds = Number.isFinite(base) ? base + Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : clockBaseSeconds(match);
      return formatClock(seconds) || '--:--';
    }
    return timeLabel(match && (match.startTime || match.kickoff));
  }

  function startCountdown(match){
    if(window.__svFifaFastCountdownTimer){
      clearInterval(window.__svFifaFastCountdownTimer);
      window.__svFifaFastCountdownTimer = null;
    }
    const el = document.querySelector('[data-fifa-feature-timer]');
    if(!el)return;
    if(!match){
      el.textContent = '';
      el.hidden = true;
      el.classList.remove('is-live','is-halftime','is-final','is-upcoming');
      el.style.removeProperty('color');
      el.style.removeProperty('border-color');
      el.style.removeProperty('background');
      return;
    }
    const state = status(match);
    window.__svFifaFastCountdownBaseSeconds = state.running ? clockBaseSeconds(match) : null;
    window.__svFifaFastCountdownStartedAt = Date.now();
    const update = ()=>{
      el.textContent = countdownText(match);
      el.hidden = !el.textContent;
      el.classList.toggle('is-live', state.running);
      el.classList.toggle('is-halftime', state.halftime);
      el.classList.toggle('is-final', state.finished);
      el.classList.toggle('is-upcoming', state.upcoming || state.postponed);
      if(state.halftime){
        el.style.setProperty('color', HALFTIME_COLOR);
        el.style.setProperty('border-color', 'rgba(239,68,68,.55)');
        el.style.setProperty('background', 'rgba(239,68,68,.12)');
      }else{
        el.style.removeProperty('color');
        el.style.removeProperty('border-color');
        el.style.removeProperty('background');
      }
    };
    update();
    if(state.running){
      window.__svFifaFastCountdownTimer = setInterval(update, 1000);
    }
  }

  function uniqueMatches(list, limit, seen){
    const out = [];
    const used = seen || new Set();
    (Array.isArray(list) ? list : []).some(match=>{
      const key = matchKey(match) || [teamName(match, 'home', ''), teamName(match, 'away', ''), match && (match.startTime || match.kickoff)].join(':');
      if(!key || used.has(key))return false;
      used.add(key);
      out.push(match);
      return limit && out.length >= limit;
    });
    return out;
  }

  function carouselMatches(payload){
    const seen = new Set();
    const live = Array.isArray(payload && payload.liveMatches) ? payload.liveMatches : [];
    const upcoming = Array.isArray(payload && payload.upcomingMatches) ? payload.upcomingMatches : [];
    const recent = Array.isArray(payload && payload.recentResults) ? payload.recentResults : [];
    const forward = uniqueMatches(live.concat(upcoming), FAST_FORWARD_MATCH_LIMIT, seen);
    const past = uniqueMatches(recent, FAST_PAST_MATCH_LIMIT, seen).reverse();
    if(forward.length){
      return { matches:past.concat(forward), startIndex:past.length, pastCount:past.length, forwardCount:forward.length };
    }
    const fallback = uniqueMatches(recent, FAST_PAST_MATCH_LIMIT, new Set());
    return { matches:fallback, startIndex:0, pastCount:fallback.length, forwardCount:0 };
  }

  function teamName(match, side, fallback){
    return clean(match && (match[side + 'Team'] || match[side] && (match[side].name || match[side].team))) || fallback || 'Team';
  }

  const COUNTRY_CODES = {
    algeria:'DZ',argentina:'AR',australia:'AU',austria:'AT',belgium:'BE','bosnia herzegovina':'BA',bosnia:'BA',brazil:'BR',canada:'CA',colombia:'CO',croatia:'HR',curacao:'CW','curaçao':'CW',
    czechia:'CZ','czech republic':'CZ',denmark:'DK',ecuador:'EC',england:'GB-ENG',france:'FR',germany:'DE',ghana:'GH',haiti:'HT',iraq:'IQ',
    egypt:'EG',iran:'IR',italy:'IT','ivory coast':'CI','cote d ivoire':'CI',japan:'JP',jordan:'JO',mexico:'MX',morocco:'MA',netherlands:'NL','new zealand':'NZ',norway:'NO',panama:'PA',paraguay:'PY',
    portugal:'PT',qatar:'QA','saudi arabia':'SA',scotland:'GB-SCT',senegal:'SN','south africa':'ZA','south korea':'KR',spain:'ES',sweden:'SE',switzerland:'CH',tunisia:'TN',
    turkiye:'TR',turkey:'TR','united states':'US',usa:'US',uruguay:'UY','cape verde':'CV',wales:'GB-WLS',uzbekistan:'UZ'
  };
  const THREE_LETTER_CODES = {ARG:'AR',AUS:'AU',BEL:'BE',BRA:'BR',CAN:'CA',COL:'CO',CIV:'CI',CUW:'CW',CZE:'CZ',DEN:'DK',ECU:'EC',ENG:'GB-ENG',FRA:'FR',GER:'DE',GHA:'GH',HAI:'HT',ITA:'IT',JPN:'JP',KOR:'KR',MAR:'MA',MEX:'MX',NED:'NL',NOR:'NO',PAR:'PY',POR:'PT',QAT:'QA',RSA:'ZA',SCO:'GB-SCT',SEN:'SN',ESP:'ES',SWE:'SE',SUI:'CH',TUR:'TR',USA:'US',UZB:'UZ',WAL:'GB-WLS'};
  const SUBDIVISION_FLAGS = {
    'GB-ENG':String.fromCodePoint(0x1f3f4,0xe0067,0xe0062,0xe0065,0xe006e,0xe0067,0xe007f),
    'GB-SCT':String.fromCodePoint(0x1f3f4,0xe0067,0xe0062,0xe0073,0xe0063,0xe0074,0xe007f),
    'GB-WLS':String.fromCodePoint(0x1f3f4,0xe0067,0xe0062,0xe0077,0xe006c,0xe0073,0xe007f)
  };

  function flagFromCode(code){
    const raw = clean(code).toUpperCase();
    const value = THREE_LETTER_CODES[raw] || raw;
    if(SUBDIVISION_FLAGS[value])return SUBDIVISION_FLAGS[value];
    if(!/^[A-Z]{2}$/.test(value))return '';
    return value.split('').map(ch=>String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)).join('');
  }

  function isFlagEmoji(value){
    const chars = Array.from(clean(value));
    if(chars.includes(String.fromCodePoint(0x1f3f4)))return true;
    return chars.length >= 2 && chars.slice(0,2).every(ch=>ch.codePointAt(0) >= 0x1f1e6 && ch.codePointAt(0) <= 0x1f1ff);
  }

  function teamFlag(match, side){
    const raw = clean(match && (match[side + 'Flag'] || match[side] && match[side].flag));
    if(raw && !/^https?:\/\//i.test(raw)){
      if(isFlagEmoji(raw))return raw;
      const fromRaw = flagFromCode(raw);
      if(fromRaw)return fromRaw;
    }
    const code = clean(match && (match[side + 'CountryCode'] || match[side] && (match[side].countryCode || match[side].code)));
    return flagFromCode(code) || flagFromCode(COUNTRY_CODES[teamName(match, side, '').toLowerCase()]);
  }

  function teamHtml(match, side, fallback){
    const flag = teamFlag(match, side);
    const flagHtml = flag
      ? `<span class="fifa-team-flag emoji" data-fifa-flag="1" aria-hidden="true">${esc(flag)}</span>`
      : '<span class="fifa-team-flag fifa-team-flag-blank" data-fifa-flag="0" aria-hidden="true"></span>';
    return `<span class="fifa-team-name">${flagHtml}<span>${esc(teamName(match, side, fallback))}</span></span>`;
  }

  function statusStyle(state){
    return state && state.halftime ? ` style="color:${HALFTIME_COLOR};font-weight:950"` : '';
  }

  function statusLabelHtml(match, state){
    const current = state || status(match);
    const time = matchTime(match);
    const dot = current.running ? '<span class="fifa-live-dot" aria-hidden="true"></span>' : '';
    const label = `<span data-fifa-status-text${statusStyle(current)}>${esc(current.label)}</span>`;
    const clock = time && time !== current.label ? `<span data-fifa-clock${statusStyle(current)}>${esc(time)}</span>` : '';
    return `${dot}${label}${clock}`;
  }

  function renderFeatured(match, key){
    const state = status(match);
    return `
      <article class="fifa-featured-card-inner ${state.className} ${state.extraClass || ''} is-clickable" role="button" tabindex="0" data-fifa-match-key="${esc(key)}" data-fifa-status-code="${esc(state.code)}" aria-label="View details for ${esc(teamName(match,'home','home'))} versus ${esc(teamName(match,'away','away'))}">
        <div class="fifa-feature-scoreboard">
          <div class="fifa-feature-team fifa-feature-team-home">${teamHtml(match, 'home', 'Home')}</div>
          <div class="fifa-feature-score" aria-label="Featured match score">
            <span data-fifa-score-side="home">${esc(score(match && match.homeScore))}</span>
            <b>-</b>
            <span data-fifa-score-side="away">${esc(score(match && match.awayScore))}</span>
          </div>
          <div class="fifa-feature-team fifa-feature-team-away">${teamHtml(match, 'away', 'Away')}</div>
        </div>
        <div class="fifa-match-meta fifa-feature-meta">${esc(matchMeta(match) || state.label)}</div>
      </article>
    `;
  }

  function renderCard(match, key, options){
    const state = status(match);
    const kind = options && options.kind ? options.kind : (state.className === 'is-result' ? 'past' : 'forward');
    const startAttr = options && options.start ? ' data-fifa-carousel-start="1"' : '';
    return `
      <article class="fifa-match-card ${state.className} ${state.extraClass || ''} is-clickable" role="button" tabindex="0" data-fifa-match-key="${esc(key)}" data-fifa-status-code="${esc(state.code)}" data-fifa-card-kind="${esc(kind)}"${startAttr} aria-label="View details for ${esc(teamName(match,'home','home'))} versus ${esc(teamName(match,'away','away'))}">
        <div class="fifa-card-label ${state.className} ${state.extraClass || ''}" data-fifa-status-code="${esc(state.code)}">
          ${statusLabelHtml(match, state)}
        </div>
        <div class="fifa-scoreboard">
          <div class="fifa-team-line"><span>${teamHtml(match, 'home', 'Home')}</span><strong data-fifa-score-side="home">${esc(score(match && match.homeScore))}</strong></div>
          <div class="fifa-team-line"><span>${teamHtml(match, 'away', 'Away')}</span><strong data-fifa-score-side="away">${esc(score(match && match.awayScore))}</strong></div>
        </div>
        <div class="fifa-match-meta">${esc(matchMeta(match))}</div>
        <div class="fifa-detail-cta">View details</div>
      </article>
    `;
  }

  function renderStandings(rows){
    const list = Array.isArray(rows) ? rows.slice(0, 6) : [];
    if(!list.length)return '';
    const groupName = clean(list[0] && list[0].group) || 'Group';
    return `
      <div class="fifa-table-title">${esc(groupName)}</div>
      <div class="fifa-table-head"><span>Team</span><span>MP</span><span>GD</span><span>PTS</span></div>
      ${list.map(row=>`
        <div class="fifa-table-row">
          <span><b>${esc(row.rank || '')}</b>${teamHtml(row, '', clean(row.team) || 'Team')}</span>
          <span>${esc(row.played == null ? 0 : row.played)}</span>
          <span>${esc(row.goalDifference == null ? 0 : row.goalDifference)}</span>
          <strong>${esc(row.points == null ? 0 : row.points)}</strong>
        </div>
      `).join('')}
    `;
  }

  function signature(payload){
    const carousel = carouselMatches(payload || {});
    const matches = carousel.matches.map(match=>[
      match && match.id,
      match && match.homeScore,
      match && match.awayScore,
      status(match).code,
      match && (match.minute || match.clock || match.displayClock || match.time || ''),
      match && match.startTime
    ].join(':'));
    return [payload.source || '', !!payload.stale, matches.join('|')].join('::');
  }

  function pickFeatured(live, upcoming, recent){
    const running = live.find(match=>status(match).running);
    if(running)return running;
    const halftime = live.find(match=>status(match).halftime);
    if(halftime)return halftime;
    return live[0] || upcoming[0] || recent[0] || null;
  }

  function positionStrip(stripEl, startIndex){
    if(!stripEl)return;
    stripEl.dataset.svFifaCarouselStartIndex = String(startIndex || 0);
    if(!startIndex)return;
    requestAnimationFrame(()=>{
      const target = stripEl.querySelector('[data-fifa-carousel-start="1"]');
      if(!target)return;
      stripEl.scrollLeft = Math.max(0, target.offsetLeft - stripEl.offsetLeft - 8);
    });
  }

  function render(payload, source){
    if(!hasRealData(payload))return false;
    const root = document.getElementById('fifaLiveRoot');
    if(!root)return false;
    const live = Array.isArray(payload.liveMatches) ? payload.liveMatches : [];
    const upcoming = Array.isArray(payload.upcomingMatches) ? payload.upcomingMatches : [];
    const recent = Array.isArray(payload.recentResults) ? payload.recentResults : [];
    const standings = Array.isArray(payload.standings) ? payload.standings : [];
    const carousel = carouselMatches(payload);
    const matches = carousel.matches;
    const featured = pickFeatured(live, upcoming, recent);
    const sig = signature(payload);
    updateLiveShortcut(payload);
    if(root.dataset.svFifaFastSignature === sig)return true;

    root.classList.remove('is-loading');
    root.classList.toggle('is-stale', !!payload.stale);
    root.classList.toggle('is-error', !payload.ok && !matches.length && !standings.length);
    root.classList.toggle('is-empty', !matches.length && !standings.length);
    root.classList.toggle('has-standings', standings.length > 0);
    root.dataset.svFifaFastRendered = '1';
    root.dataset.svFifaFastSource = source || (payload.stale ? 'local-cache' : 'early-api');
    root.dataset.svFifaFastSignature = sig;
    root.dataset.svFifaPastCount = String(carousel.pastCount || 0);
    root.dataset.svFifaForwardCount = String(carousel.forwardCount || 0);

    const featuredEl = document.getElementById('fifaFeaturedMatch');
    if(featuredEl){
      const featuredState = featured ? status(featured) : null;
      featuredEl.classList.toggle('is-live-featured', !!featuredState && featuredState.active);
      featuredEl.classList.toggle('is-live', !!featuredState && featuredState.running);
      featuredEl.classList.toggle('is-halftime', !!featuredState && featuredState.halftime);
      featuredEl.classList.toggle('is-final', !!featuredState && featuredState.finished);
      featuredEl.innerHTML = featured
        ? renderFeatured(featured, matchKey(featured))
        : '<div class="fifa-featured-empty"><div class="fifa-card-label">Real data</div><div class="fifa-empty-title">No live matches right now</div><div class="fifa-match-meta">Waiting for the next real fixture update</div></div>';
    }

    const standingsEl = document.getElementById('fifaStandingsCard');
    if(standingsEl){
      standingsEl.innerHTML = renderStandings(standings);
      standingsEl.hidden = !standings.length;
    }

    const stripEl = document.getElementById('fifaMatchStrip');
    if(stripEl){
      stripEl.innerHTML = matches.map((match, index)=>renderCard(match, matchKey(match), {
        kind:index < carousel.startIndex ? 'past' : 'forward',
        start:index === carousel.startIndex
      })).join('');
      stripEl.hidden = !matches.length;
      positionStrip(stripEl, carousel.startIndex);
    }
    const stripWrapEl = document.getElementById('fifaMatchStripWrap');
    if(stripWrapEl)stripWrapEl.hidden = !matches.length;

    const headlinesEl = document.getElementById('fifaHeadlineStrip');
    if(headlinesEl)headlinesEl.hidden = true;

    window.__svFifaFastPayload = payload;
    window.__svFifaFastRenderAt = (window.performance && performance.now) ? performance.now() : Date.now();
    startCountdown(featured);
    return true;
  }

  const cached = cachedPayload();
  if(cached)render(cached, 'local-cache');

  const earlyPromise = window.__svFifaLiveEarlyPromise || fetch('/api/fifa-live?priority=1', {
    cache:'no-store',
    headers:{ Accept:'application/json' }
  }).then(response=>response.ok ? response.json() : null).catch(()=>null);

  window.__svFifaFastReady = Promise.resolve(earlyPromise).then(payload=>{
    if(!hasRealData(payload))return null;
    writeCache(payload);
    render(payload, 'early-api');
    return payload;
  });
})();
