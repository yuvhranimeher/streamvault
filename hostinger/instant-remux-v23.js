(function () {
  const marker = 'SV_INSTANT_REMUX_V24_ANDROID_DIRECT';

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

    // Do not native-direct files that explicitly advertise codecs/audio
    // that are commonly incompatible with Android Chrome MP4 playback.
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
   * Android: for an HTTPS MP4/M4V that survived the normal startup
   * compatibility checks, let the browser request the source directly.
   * If native playback later fails, the existing StreamVault fallback chain
   * remains responsible for recovery.
   *
   * Desktop behaviour remains unchanged below.
   */
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

  /*
   * Never fall into full HLS/video transcoding on desktop.
   * Mobile keeps the existing recovery order.
   */
  fallbackOrderForRemote = function (url, plan = {}) {
    if (desktopClient() && needsContainerRemux(url)) {
      return ['audio', 'remux', 'proxy'];
    }

    return originalFallbackOrder(url, plan);
  };

  console.log('[SV] Android native direct MP4 + instant video-copy remux active');
})();