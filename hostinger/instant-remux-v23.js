(function () {
  const marker = 'SV_INSTANT_REMUX_V23';

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

  function needsContainerRemux(url) {
    return /\.mkv(?:$|[?#])/i.test(String(url || '')) ||
      /(x265|h265|hevc|10bit|10-bit)/i.test(String(url || ''));
  }

  /*
   * Hostinger playback fix:
   * mode=audio means FFmpeg copies video unchanged (-c:v copy)
   * and converts only unsupported audio to AAC.
   */
  fetchFtpPlaybackPlan = async function (streamUrl, start = 0, options = {}) {
    if (
      desktopClient() &&
      needsContainerRemux(streamUrl) &&
      !options.forceProxy &&
      !options.forceRemux &&
      !options.forceAudio &&
      !options.mode
    ) {
      return originalFetchPlan(streamUrl, start, {
        forceAudio: true
      });
    }

    return originalFetchPlan(streamUrl, start, options);
  };

  /*
   * Never fall into full HLS/video transcoding on desktop.
   */
  fallbackOrderForRemote = function (url, plan = {}) {
    if (desktopClient() && needsContainerRemux(url)) {
      return ['audio', 'remux', 'proxy'];
    }

    return originalFallbackOrder(url, plan);
  };

  console.log('[SV] Instant video-copy remux active');
})();