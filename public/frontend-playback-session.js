(function installStreamVaultPlaybackSession(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StreamVaultPlaybackSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStreamVaultPlaybackSession() {
  'use strict';

  const UNKNOWN_LANGUAGE_VALUES = new Set([
    '', 'und', 'unknown', 'undefined', 'null', 'none', 'original', 'default',
    'mul', 'multiple', 'misc', 'miscellaneous', 'na', 'n a',
  ]);
  const ENGLISH_ALIASES = new Set(['en', 'eng', 'english']);
  const HINDI_ALIASES = new Set(['hi', 'hin', 'hindi']);

  function normalizedLanguageText(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/\s+/g, ' ');
  }

  function normalizeLanguage(value) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const normalized = normalizeLanguage(item);
        if (normalized) return normalized;
      }
      return null;
    }
    const raw = normalizedLanguageText(value);
    if (!raw || UNKNOWN_LANGUAGE_VALUES.has(raw)) return null;
    for (const candidate of raw.split(/[,;/|]+/).map(item => item.trim()).filter(Boolean)) {
      if (UNKNOWN_LANGUAGE_VALUES.has(candidate)) continue;
      const compact = candidate.replace(/[^a-z-]/g, '');
      const primary = compact.split('-')[0];
      if (ENGLISH_ALIASES.has(compact) || ENGLISH_ALIASES.has(primary) || /^english(?:\b|[- ])/.test(candidate)) return 'en';
      if (HINDI_ALIASES.has(compact) || HINDI_ALIASES.has(primary) || /^hindi(?:\b|[- ])/.test(candidate)) return 'hi';
    }
    return null;
  }

  function firstLanguageFromFields(metadata, fields) {
    for (const field of fields) {
      const language = normalizeLanguage(metadata?.[field]);
      if (language) return { language, field };
    }
    return null;
  }

  function determinePreferredLanguage(metadata = {}) {
    const explicit = firstLanguageFromFields(metadata, [
      'preferredLanguage', 'preferred_language', 'titleLanguage', 'title_language',
      'originalLanguage', 'original_language',
    ]);
    if (explicit) return { ...explicit, reason: `explicit-title-language:${explicit.field}` };

    const category = normalizedLanguageText(
      metadata.category || metadata.catalogCategory || metadata.catalog_category
    );
    if (/\benglish\s+(?:movies?|films?|catalog)\b/.test(category)) {
      return { language: 'en', field: 'category', reason: 'catalog-category:english' };
    }
    if (/\bhindi\s+(?:movies?|films?|catalog)\b/.test(category)) {
      return { language: 'hi', field: 'category', reason: 'catalog-category:hindi' };
    }

    const content = firstLanguageFromFields(metadata, [
      'contentLanguage', 'content_language', 'language', 'languages',
      'audioLanguage', 'audio_language',
    ]);
    if (content) return { ...content, reason: `content-language:${content.field}` };

    const projectText = [
      metadata.category,
      metadata.title,
      metadata.name,
      metadata.filename,
      metadata.file,
      metadata.streamUrl,
      metadata.source,
    ].filter(Boolean).join(' ');
    const decodedProjectText = (() => {
      try { return decodeURIComponent(projectText); } catch { return projectText; }
    })();
    if (/\bseason\s*\d*\s*\(\s*hindi\s+language\s*\)|\bhindi\s+language\b/i.test(decodedProjectText)) {
      return { language: 'hi', field: 'project-path', reason: 'project-rule:hindi-season' };
    }
    if (/(?:^|[/\\\s])hindi%?20?movies?(?:[/\\\s(]|$)/i.test(decodedProjectText)) {
      return { language: 'hi', field: 'project-path', reason: 'project-rule:hindi-movie-path' };
    }
    if (/(?:^|[/\\\s])english%?20?movies?(?:[/\\\s(]|$)/i.test(decodedProjectText)) {
      return { language: 'en', field: 'project-path', reason: 'project-rule:english-movie-path' };
    }
    if (/\btv[-_ ]?web[-_ ]?series\b/i.test(decodedProjectText)) {
      return { language: 'en', field: 'project-path', reason: 'project-rule:english-tv-web-catalog' };
    }
    return { language: null, field: null, reason: 'conservative-fallback' };
  }

  function trackText(track = {}) {
    return [
      track.title,
      track.label,
      track.name,
      track.handlerName,
      track.handler_name,
      track.characteristics,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function trackLanguage(track = {}) {
    const tagged = normalizeLanguage(track.language ?? track.lang);
    return tagged || normalizeLanguage([
      track.title,
      track.label,
      track.name,
      track.handlerName,
      track.handler_name,
    ]);
  }

  function isAuxiliaryTrack(track = {}) {
    const disposition = track.disposition || {};
    if (
      track.commentary === true || track.descriptive === true ||
      track.visualImpaired === true || track.visual_impaired === true ||
      track.hearingImpaired === true || track.hearing_impaired === true ||
      disposition.comment === 1 || disposition.commentary === 1 ||
      disposition.visual_impaired === 1 || disposition.hearing_impaired === 1
    ) return true;
    return /\b(commentary|director(?:'s)? commentary|audio description|audio descriptive|descriptive audio|described audio|visually impaired|hearing impaired|isolated (?:music|score|effects)|music and effects|m\s*&\s*e)\b/i.test(trackText(track));
  }

  function isReliableOriginalTrack(track = {}) {
    const disposition = track.disposition || {};
    if (track.original === true || disposition.original === 1) return true;
    return /(?:^|[\s[(\-])(original(?: language)?|orig)(?:$|[\s)\]\-])/i.test(trackText(track));
  }

  function isDefaultTrack(track = {}) {
    return track.default === true || track.isDefault === true || track.disposition?.default === 1;
  }

  function stableStreamIndex(track = {}, fallback = 0) {
    const index = Number(track.streamIndex ?? track.sourceIndex ?? track.index);
    return Number.isFinite(index) && index >= 0 ? index : fallback;
  }

  function codecCompatibilityScore(track = {}) {
    const codec = String(track.codec || track.codecName || track.codec_name || '').trim().toLowerCase();
    if (/^(aac|mp3|mp4a)$/.test(codec) || codec.includes('aac') || codec.includes('mp4a')) return 2;
    if (/^(ac3|eac3|opus|vorbis|flac|dts)$/.test(codec)) return 1;
    return 0;
  }

  function compareMatchingTracks(a, b) {
    const defaultDelta = Number(isDefaultTrack(b.track)) - Number(isDefaultTrack(a.track));
    if (defaultDelta) return defaultDelta;
    const codecDelta = codecCompatibilityScore(b.track) - codecCompatibilityScore(a.track);
    if (codecDelta) return codecDelta;
    const channelDelta = (Number(b.track.channels) || 0) - (Number(a.track.channels) || 0);
    if (channelDelta) return channelDelta;
    const bitrateDelta = (Number(b.track.bitrate) || 0) - (Number(a.track.bitrate) || 0);
    if (bitrateDelta) return bitrateDelta;
    return stableStreamIndex(a.track, a.index) - stableStreamIndex(b.track, b.index);
  }

  function selectAudioTrack({
    preferredLanguage,
    titleMetadata = {},
    audioStreams = [],
    manualIndex = null,
    trustedIndex = null,
    trustedReason = '',
    isPlayable,
  } = {}) {
    const streams = Array.isArray(audioStreams) ? audioStreams : [];
    const playable = streams
      .map((track, index) => ({ track, index }))
      .filter(candidate => typeof isPlayable === 'function'
        ? isPlayable(candidate.track)
        : candidate.track?.playable !== false);
    const preferredDecision = preferredLanguage
      ? { language: normalizeLanguage(preferredLanguage), reason: 'explicit-session-language' }
      : determinePreferredLanguage(titleMetadata);
    const normal = playable.filter(candidate => !isAuxiliaryTrack(candidate.track));
    const manualValue = manualIndex === null || manualIndex === undefined || manualIndex === ''
      ? NaN
      : Number(manualIndex);
    const manual = Number.isInteger(manualValue)
      ? playable.find(candidate => candidate.index === manualValue)
      : null;
    if (manual) {
      return buildDecision(manual, preferredDecision, streams, 'manual-session-selection', true);
    }

    const preferred = preferredDecision.language
      ? normal.filter(candidate => trackLanguage(candidate.track) === preferredDecision.language).sort(compareMatchingTracks)
      : [];
    if (preferred[0]) {
      return buildDecision(preferred[0], preferredDecision, streams, `preferred-language:${preferredDecision.language}`, false);
    }

    const trustedValue = trustedIndex === null || trustedIndex === undefined || trustedIndex === ''
      ? NaN
      : Number(trustedIndex);
    const trusted = Number.isInteger(trustedValue)
      ? normal.find(candidate => candidate.index === trustedValue)
      : null;
    if (trusted) {
      return buildDecision(trusted, preferredDecision, streams, `trusted-server:${trustedReason || 'automatic-selection'}`, false);
    }

    const original = normal.filter(candidate => isReliableOriginalTrack(candidate.track)).sort(compareMatchingTracks);
    if (original[0]) return buildDecision(original[0], preferredDecision, streams, 'reliable-original-track', false);

    const sourceDefault = normal.filter(candidate => isDefaultTrack(candidate.track)).sort(compareMatchingTracks);
    if (sourceDefault[0]) return buildDecision(sourceDefault[0], preferredDecision, streams, 'source-default-track', false);

    const normalByIndex = normal.slice().sort((a, b) =>
      stableStreamIndex(a.track, a.index) - stableStreamIndex(b.track, b.index)
    );
    if (normalByIndex[0]) return buildDecision(normalByIndex[0], preferredDecision, streams, 'first-normal-playable-track', false);

    const byIndex = playable.slice().sort((a, b) =>
      stableStreamIndex(a.track, a.index) - stableStreamIndex(b.track, b.index)
    );
    if (byIndex[0]) return buildDecision(byIndex[0], preferredDecision, streams, 'first-playable-track', false);

    return {
      preferredLanguage: preferredDecision.language || null,
      preferredLanguageReason: preferredDecision.reason,
      selectedTrack: null,
      selectedIndex: null,
      selectedStreamIndex: null,
      reason: 'no-playable-audio',
      manual: false,
      availableLanguages: streams.map(trackLanguage),
    };
  }

  function buildDecision(candidate, preferredDecision, streams, reason, manual) {
    return {
      preferredLanguage: preferredDecision.language || null,
      preferredLanguageReason: preferredDecision.reason,
      selectedTrack: candidate.track,
      selectedIndex: candidate.index,
      selectedStreamIndex: stableStreamIndex(candidate.track, candidate.index),
      reason,
      manual,
      availableLanguages: streams.map(trackLanguage),
    };
  }

  function stablePart(value) {
    return encodeURIComponent(String(value ?? '').trim() || '-');
  }

  function createMediaSessionKey({
    mediaType,
    mediaId,
    season,
    episode,
    sourceIdentity,
  } = {}) {
    const type = /^(?:tv|series|episode)$/i.test(String(mediaType || '')) ? 'series' : 'movie';
    return [
      `type=${type}`,
      `id=${stablePart(mediaId)}`,
      `season=${stablePart(season)}`,
      `episode=${stablePart(episode)}`,
      `source=${stablePart(sourceIdentity)}`,
    ].join('|');
  }

  function createAudioSessionController({ debug = false, logger = console } = {}) {
    let current = emptySession();

    function begin(context = {}) {
      const key = createMediaSessionKey(context);
      const preferred = determinePreferredLanguage(context.titleMetadata || {});
      current = {
        key,
        context: { ...context },
        preferredLanguage: normalizeLanguage(context.preferredLanguage) || preferred.language,
        preferredLanguageReason: context.preferredLanguage
          ? 'explicit-session-language'
          : preferred.reason,
        manualIndex: null,
        manualStreamIndex: null,
      };
      return snapshot();
    }

    function setPreferredLanguage(language, reason = '') {
      const normalized = normalizeLanguage(language);
      if (!normalized) return false;
      current.preferredLanguage = normalized;
      current.preferredLanguageReason = reason || 'server-preferred-language';
      return true;
    }

    function setManual(index, streamIndex = null) {
      const value = Number(index);
      if (!current.key || !Number.isInteger(value) || value < 0) return false;
      current.manualIndex = value;
      current.manualStreamIndex = Number.isFinite(Number(streamIndex)) ? Number(streamIndex) : null;
      return true;
    }

    function clearManual() {
      current.manualIndex = null;
      current.manualStreamIndex = null;
    }

    function select(audioStreams, options = {}) {
      const decision = selectAudioTrack({
        preferredLanguage: options.preferredLanguage || current.preferredLanguage,
        titleMetadata: options.titleMetadata || current.context.titleMetadata || {},
        audioStreams,
        manualIndex: options.ignoreManual ? null : current.manualIndex,
        trustedIndex: options.trustedIndex,
        trustedReason: options.trustedReason,
        isPlayable: options.isPlayable,
      });
      if (debug && logger?.debug) {
        logger.debug('[Audio Session]', {
          title: current.context.title || '',
          mediaSessionKey: current.key,
          preferredLanguage: decision.preferredLanguage,
          tracks: (Array.isArray(audioStreams) ? audioStreams : []).map((track, index) => ({
            index,
            streamIndex: stableStreamIndex(track, index),
            language: trackLanguage(track),
            title: track.title || track.label || track.name || '',
            default: isDefaultTrack(track),
            auxiliary: isAuxiliaryTrack(track),
          })),
          selectedIndex: decision.selectedIndex,
          selectedStreamIndex: decision.selectedStreamIndex,
          reason: decision.reason,
          selectionMode: decision.manual ? 'manual' : 'automatic',
        });
      }
      return decision;
    }

    function snapshot() {
      return {
        key: current.key,
        context: { ...current.context },
        preferredLanguage: current.preferredLanguage,
        preferredLanguageReason: current.preferredLanguageReason,
        manualIndex: current.manualIndex,
        manualStreamIndex: current.manualStreamIndex,
      };
    }

    function restore(value = {}) {
      current = {
        key: String(value.key || ''),
        context: { ...(value.context || {}) },
        preferredLanguage: normalizeLanguage(value.preferredLanguage),
        preferredLanguageReason: String(value.preferredLanguageReason || ''),
        manualIndex: value.manualIndex !== null && value.manualIndex !== undefined && value.manualIndex !== '' && Number.isInteger(Number(value.manualIndex))
          ? Number(value.manualIndex)
          : null,
        manualStreamIndex: value.manualStreamIndex !== null && value.manualStreamIndex !== undefined && value.manualStreamIndex !== '' && Number.isFinite(Number(value.manualStreamIndex))
          ? Number(value.manualStreamIndex)
          : null,
      };
      return snapshot();
    }

    function clear() {
      current = emptySession();
    }

    return {
      begin,
      clear,
      clearManual,
      restore,
      select,
      setManual,
      setPreferredLanguage,
      snapshot,
    };
  }

  function emptySession() {
    return {
      key: '',
      context: {},
      preferredLanguage: null,
      preferredLanguageReason: '',
      manualIndex: null,
      manualStreamIndex: null,
    };
  }

  function createModalNavigationSnapshot({
    mediaType,
    mediaId,
    mediaKey,
    selectedSeason,
    selectedEpisode,
    modalScrollTop,
    browsingView,
    browsingScrollTop,
    theme,
    historyVersion = 1,
  } = {}) {
    return {
      view: 'detail',
      type: 'media',
      source: 'media-modal',
      mediaType: mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie',
      mediaId: String(mediaId ?? ''),
      mediaKey: String(mediaKey ?? ''),
      key: String(mediaKey ?? ''),
      selectedSeason: selectedSeason !== null && selectedSeason !== undefined && selectedSeason !== '' && Number.isFinite(Number(selectedSeason))
        ? Number(selectedSeason)
        : null,
      selectedEpisode: selectedEpisode !== null && selectedEpisode !== undefined && selectedEpisode !== '' && Number.isFinite(Number(selectedEpisode))
        ? Number(selectedEpisode)
        : null,
      modalScrollTop: Math.max(0, Number(modalScrollTop) || 0),
      browsingView: browsingView && typeof browsingView === 'object' ? { ...browsingView } : {},
      browsingScrollTop: Math.max(0, Number(browsingScrollTop) || 0),
      theme: theme === 'dark' ? 'dark' : 'light',
      historyVersion: Math.max(1, Number(historyVersion) || 1),
    };
  }

  return {
    createAudioSessionController,
    createMediaSessionKey,
    createModalNavigationSnapshot,
    determinePreferredLanguage,
    isAuxiliaryTrack,
    isDefaultTrack,
    isReliableOriginalTrack,
    normalizeLanguage,
    selectAudioTrack,
    stableStreamIndex,
    trackLanguage,
  };
});
