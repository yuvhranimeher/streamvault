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

  const candidates = raw.split(/[,;/|]+/).map(item => item.trim()).filter(Boolean);
  for (const candidate of candidates) {
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

function determineTitleLanguage(metadata = {}) {
  const explicit = firstLanguageFromFields(metadata, [
    'preferredLanguage', 'preferred_language', 'titleLanguage', 'title_language',
    'originalLanguage', 'original_language',
  ]);
  if (explicit) return { ...explicit, reason: `explicit-title-language:${explicit.field}` };

  const category = normalizedLanguageText(metadata.category || metadata.catalogCategory || metadata.catalog_category);
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
  if (/\btv[-_ ]?web[-_ ]?series\b/i.test(category)) {
    return { language: 'en', field: 'category', reason: 'project-rule:english-tv-web-catalog' };
  }

  return { language: null, field: null, reason: 'conservative-fallback' };
}

function trackText(track = {}) {
  return [track.title, track.label, track.handlerName, track.handler_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function trackLanguage(track = {}) {
  const tagged = normalizeLanguage(track.language ?? track.lang);
  if (tagged) return tagged;
  return normalizeLanguage([track.title, track.label, track.handlerName, track.handler_name]);
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
  const aAux = isAuxiliaryTrack(a.track) ? 1 : 0;
  const bAux = isAuxiliaryTrack(b.track) ? 1 : 0;
  if (aAux !== bAux) return aAux - bAux;

  const aDefault = isDefaultTrack(a.track) ? 1 : 0;
  const bDefault = isDefaultTrack(b.track) ? 1 : 0;
  if (aDefault !== bDefault) return bDefault - aDefault;

  const codecDelta = codecCompatibilityScore(b.track) - codecCompatibilityScore(a.track);
  if (codecDelta) return codecDelta;

  const channelDelta = (Number(b.track.channels) || 0) - (Number(a.track.channels) || 0);
  if (channelDelta) return channelDelta;

  const bitrateDelta = (Number(b.track.bitrate) || 0) - (Number(a.track.bitrate) || 0);
  if (bitrateDelta) return bitrateDelta;

  return stableStreamIndex(a.track, a.index) - stableStreamIndex(b.track, b.index);
}

function uniqueCandidates(groups) {
  const seen = new Set();
  const result = [];
  for (const group of groups) {
    for (const candidate of group) {
      if (seen.has(candidate.index)) continue;
      seen.add(candidate.index);
      result.push(candidate);
    }
  }
  return result;
}

function selectAudioTrack({ preferredLanguage, titleMetadata = {}, audioStreams = [], requestedStreamIndex = null, isPlayable } = {}) {
  const streams = Array.isArray(audioStreams) ? audioStreams : [];
  const playable = streams
    .map((track, index) => ({ track, index }))
    .filter(candidate => typeof isPlayable === 'function' ? isPlayable(candidate.track) : candidate.track?.playable !== false);

  const titleDecision = preferredLanguage
    ? { language: normalizeLanguage(preferredLanguage), field: 'preferredLanguage', reason: 'explicit-selector-language' }
    : determineTitleLanguage(titleMetadata);
  const requested = requestedStreamIndex === null || requestedStreamIndex === undefined || requestedStreamIndex === ''
    ? NaN
    : Number(requestedStreamIndex);
  const manual = Number.isFinite(requested) && requested >= 0
    ? playable.filter(candidate => stableStreamIndex(candidate.track, candidate.index) === requested)
    : [];
  const preferred = titleDecision.language
    ? playable.filter(candidate => trackLanguage(candidate.track) === titleDecision.language).sort(compareMatchingTracks)
    : [];
  const original = playable.filter(candidate => isReliableOriginalTrack(candidate.track)).sort(compareMatchingTracks);
  const sourceDefault = playable.filter(candidate => isDefaultTrack(candidate.track)).sort(compareMatchingTracks);
  const normalByIndex = playable
    .filter(candidate => !isAuxiliaryTrack(candidate.track))
    .sort((a, b) => stableStreamIndex(a.track, a.index) - stableStreamIndex(b.track, b.index));
  const byIndex = playable
    .slice()
    .sort((a, b) => stableStreamIndex(a.track, a.index) - stableStreamIndex(b.track, b.index));

  const candidates = uniqueCandidates([manual, preferred, original, sourceDefault, normalByIndex, byIndex]);
  const selected = candidates[0] || null;
  let reason = 'no-playable-audio';
  if (selected) {
    if (manual.some(candidate => candidate.index === selected.index)) reason = 'manual-stream-request';
    else if (preferred.some(candidate => candidate.index === selected.index)) reason = `preferred-language:${titleDecision.language}`;
    else if (original.some(candidate => candidate.index === selected.index)) reason = 'reliable-original-track';
    else if (sourceDefault.some(candidate => candidate.index === selected.index)) reason = 'source-default-track';
    else reason = 'first-playable-track';
  }

  return {
    preferredLanguage: titleDecision.language,
    titleLanguageReason: titleDecision.reason,
    selectedTrack: selected?.track || null,
    selectedIndex: selected?.index ?? null,
    selectedStreamIndex: selected ? stableStreamIndex(selected.track, selected.index) : null,
    reason,
    candidateIndexes: candidates.map(candidate => candidate.index),
    availableLanguages: streams.map(track => trackLanguage(track)),
  };
}

module.exports = {
  determineTitleLanguage,
  isAuxiliaryTrack,
  isDefaultTrack,
  isReliableOriginalTrack,
  normalizeLanguage,
  selectAudioTrack,
  stableStreamIndex,
  trackLanguage,
};
