(function () {
  const marker = 'SV_INSTANT_REMUX_V25_ANDROID_DIRECT_EARLY';

  if (window[marker]) return;
  window[marker] = true;

  if (
    typeof fetchFtpPlaybackPlan !== 'function' ||
    typeof fallbackOrderForRemote !== 'function'
  ) {
    console.error('[SV] Playback functions unavailable');
    return;
  }

  const originalFetchPlan = fetchFtpPlaybackPlan;
  const originalFallbackOrder = fallbackOrderForRemote;
  const originalPrepareFtpStartupAudio = typeof prepareFtpStartupAudio === 'function'
    ? prepareFtpStartupAudio
    : null;

  function desktopClient() {
    return typeof isMobilePlaybackClient !== 'function' ||
      !isMobilePlaybackClient();
  }

  function androidClient() {
    return /Android/i.test(String(navigator.userAgent || ''));
  }

  function needsContainerRemux(url) {
    return /\.mkv(?:$|[?#])/i.test(String(url || '')) ||
      /(x265|h265|hevc|10bit|10-bit)/i.test(String(url || ''));
  }

  function androidDirectCandidate(url) {
    let parsed;
    try {
      parsed = new URL(String(url || ''), window.location.href);
    } catch (_) {
      return false;
    }

    if (parsed.protocol !== 'https:') return false;
    if (!/\.(?:mp4|m4v)$/i.test(parsed.pathname)) return false;

    let hint = `${parsed.pathname} ${parsed.search}`;
    try { hint = decodeURIComponent(hint); } catch (_) {}

    if (/(?:x265|h\.?265|hevc|10bit|10-bit|av1|vp9|vp8|vc-?1|ac-?3|e-?ac-?3|ddp|dd\+|dts|truehd|flac)/i.test(hint)) {
      return false;
    }

    return true;
  }

  function hasForcedCompatibilityMode(options = {}) {
    return !!(
      options.forceProxy ||
      options.forceStream ||
      options.forceRemux ||
      options.forceAudio ||
      options.forceHls ||
      options.mode
    );
  }

  function androidDirectPlan(streamUrl, options = {}) {
    const src = String(streamUrl || '').trim();
    return {
      ok: true,
      mode: 'direct',
      transport: 'direct',
      directPlayable: true,
      androidDirect: true,
      src,
      playUrl: src,
      finalPlayUrl: src,
      decodedUrl: src,
      duration: 0,
      fallbackReason: options.fallbackReason || 'Android native direct MP4'
    };
  }

  /*
   * For Android HTTPS MP4/M4V candidates, do not block startup on the FTP
   * media-info/audio probe. Native playback already proved that the browser can
   * read these sources directly, and the metadata request is not needed before
   * attaching the source. The normal player still handles UI, progress, errors,
   * and recovery.
   */
  if (originalPrepareFtpStartupAudio) {
    prepareFtpStartupAudio = async function (streamUrl, scope = null) {
      if (androidClient() && androidDirectCandidate(streamUrl)) {
        try {
          if (typeof mediaFixLog === 'function') {
            mediaFixLog('Android direct startup metadata bypass', { url: streamUrl });
          }
        } catch (_) {}
        return {
          info: null,
          options: {},
          selected: null,
          reason: 'Android native direct MP4'
        };
      }

      return originalPrepareFtpStartupAudio(streamUrl, scope);
    };
  }

  fetchFtpPlaybackPlan = async function (streamUrl, start = 0, options = {}) {
    if (
      androidClient() &&
      Number(start || 0) <= 0 &&
      androidDirectCandidate(streamUrl) &&
      !hasForcedCompatibilityMode(options)
    ) {
      try {
        if (typeof mediaFixLog === 'function') {
          mediaFixLog('Android native direct source selected', { url: streamUrl });
        }
      } catch (_) {}
      return androidDirectPlan(streamUrl, options);
    }

    if (
      desktopClient() &&
      needsContainerRemux(streamUrl) &&
      !options.forceProxy &&
      !options.forceRemux &&
      !options.forceAudio &&
      !options.mode
    ) {
      return originalFetchPlan(streamUrl, start, {
        ...options,
        forceAudio: true
      });
    }

    return originalFetchPlan(streamUrl, start, options);
  };

  fallbackOrderForRemote = function (url, plan = {}) {
    if (desktopClient() && needsContainerRemux(url)) {
      return ['audio', 'remux', 'proxy'];
    }

    return originalFallbackOrder(url, plan);
  };

  console.log('[SV] Android early native direct MP4 + instant video-copy remux active');
})();