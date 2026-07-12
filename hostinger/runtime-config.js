(function configureStreamVault(global) {
  'use strict';

  const API_ORIGIN = 'https://backend.streamvault.fit';
  const BACKEND_PATHS = ['/api/', '/live/', '/live-relay/', '/stream/', '/subtitles/'];
  const LEGACY_FRONTEND_ORIGINS = new Set([
    'https://streamvault.fit',
    'https://www.streamvault.fit'
  ]);
  const OFFLINE_MESSAGE = 'StreamVault backend is temporarily offline.';

  function isBackendPath(pathname) {
    return pathname === '/api'
      || pathname === '/live-relay'
      || pathname === '/live'
      || pathname === '/stream'
      || pathname === '/subtitles'
      || BACKEND_PATHS.some(prefix => pathname.startsWith(prefix));
  }

  function apiUrl(input) {
    if (input == null) return input;
    let url;
    try {
      url = new URL(String(input), global.location.href);
    } catch (_error) {
      return input;
    }

    const shouldRoute = isBackendPath(url.pathname)
      && (url.origin === global.location.origin || LEGACY_FRONTEND_ORIGINS.has(url.origin));
    if (!shouldRoute) return input instanceof URL ? url.toString() : input;
    return API_ORIGIN + url.pathname + url.search + url.hash;
  }

  const backendStatus = {
    checked: false,
    available: null,
    checkedAt: 0,
    version: null
  };

  function publishBackendStatus(available, version) {
    backendStatus.checked = true;
    backendStatus.available = available;
    backendStatus.checkedAt = Date.now();
    backendStatus.version = version || null;
    document.documentElement.dataset.backend = available ? 'online' : 'offline';
    global.dispatchEvent(new CustomEvent('streamvault:backend-status', {
      detail: { ...backendStatus }
    }));
    return backendStatus;
  }

  const nativeFetch = global.fetch.bind(global);

  global.fetch = function streamVaultFetch(input, init) {
    try {
      if (typeof input === 'string' || input instanceof URL) {
        input = apiUrl(input);
      } else if (input && input.url) {
        const routed = apiUrl(input.url);
        if (routed !== input.url) input = new Request(routed, input);
      }
    } catch (_error) {
      // Preserve the native request if a nonstandard Request object cannot be cloned.
    }
    return nativeFetch(input, init);
  };

  if (global.XMLHttpRequest) {
    const nativeOpen = global.XMLHttpRequest.prototype.open;
    global.XMLHttpRequest.prototype.open = function streamVaultOpen(method, url, ...rest) {
      return nativeOpen.call(this, method, apiUrl(url), ...rest);
    };
  }

  function checkBackendAvailability(timeoutMs = 3500) {
    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), timeoutMs);
    return nativeFetch(API_ORIGIN + '/api/version', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok) throw new Error(`backend HTTP ${response.status}`);
        return response.json().catch(() => ({}));
      })
      .then(payload => publishBackendStatus(true, payload.version || payload.commit || null))
      .catch(() => publishBackendStatus(false, null))
      .finally(() => global.clearTimeout(timer));
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(global.location.protocol)) {
      return Promise.resolve(null);
    }
    return navigator.serviceWorker.register('/sw.js?v=20260712-hostinger-static-v2', { scope: '/' });
  }

  global.API_BASE = API_ORIGIN;
  global.STREAMVAULT_BACKEND_OFFLINE_MESSAGE = OFFLINE_MESSAGE;
  global.__svBackendStatus = backendStatus;
  global.StreamVaultConfig = Object.freeze({
    apiOrigin: API_ORIGIN,
    apiUrl,
    backendStatus,
    checkBackendAvailability,
    offlineMessage: OFFLINE_MESSAGE,
    registerServiceWorker
  });

  global.__svBackendCheckPromise = checkBackendAvailability();
  global.addEventListener('load', () => {
    registerServiceWorker().catch(error => {
      console.warn('[StreamVault] service worker registration failed:', error.message);
    });
  }, { once: true });
})(window);
