#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const defaultFixturePath = path.join(
  root,
  "tools",
  "playback-parity-v1",
  "inactive-playback-route-adapter-fixtures.json"
);

const ALLOWED_METHODS = new Set(["GET", "POST"]);
const CLIENT_TYPES = new Set(["desktop", "mobile"]);
const SOURCE_TYPES = new Set(["movie", "series", "live"]);
const PLAYBACK_MODES = new Set(["direct", "hls", "live", "invalid"]);
const STREAM_URL_PREFIXES = ["http://", "https://", "ftp://", "local://"];

const ROUTE_METADATA = {
  "/api/playback/movie": {
    routeTarget: "/api/playback/movie",
    futureHaskellMirrorName: "PlaybackRouteMovieShadow",
    riskLevel: "medium",
    responseKind: "json-only",
    expectedInputFields: ["id", "name", "url", "streamUrl", "mobile", "quality"],
    expectedOutputFields: ["ok", "streamUrl", "sourceType", "clientType", "playbackMode", "error"],
  },
  "/api/playback/local": {
    routeTarget: "/api/playback/local",
    futureHaskellMirrorName: "PlaybackRouteLocalShadow",
    riskLevel: "high",
    responseKind: "json-only",
    expectedInputFields: ["id", "streamUrl", "mobile", "quality", "audio", "start", "forceHls"],
    expectedOutputFields: ["ok", "src", "mode", "directPlayable", "duration", "decodedUrl", "error"],
  },
  "/api/playback/ftp": {
    routeTarget: "/api/playback/ftp",
    futureHaskellMirrorName: "PlaybackRouteFtpShadow",
    riskLevel: "high",
    responseKind: "json-only",
    expectedInputFields: ["url", "streamUrl", "mobile", "audio", "audioStream", "start", "forceHls", "mode"],
    expectedOutputFields: ["ok", "src", "mode", "directPlayable", "decodedUrl", "duration", "error"],
  },
  "/api/ftp/raw": {
    routeTarget: "/api/ftp/raw",
    futureHaskellMirrorName: "PlaybackRouteFtpRawShadow",
    riskLevel: "high",
    responseKind: "may-stream-bytes",
    expectedInputFields: ["url", "streamUrl", "range"],
    expectedOutputFields: ["status", "contentType", "acceptRanges", "contentRange", "streamUrl", "error"],
  },
  "/api/playback/series/episode": {
    routeTarget: "series episode playback",
    futureHaskellMirrorName: "PlaybackRouteSeriesEpisodeShadow",
    riskLevel: "medium",
    responseKind: "json-only",
    expectedInputFields: ["seriesId", "season", "episode", "streamUrl", "mobile"],
    expectedOutputFields: ["ok", "src", "mode", "sourceType", "streamUrl", "error"],
  },
  "/api/playback/live/hls": {
    routeTarget: "live TV m3u8 playback",
    futureHaskellMirrorName: "PlaybackRouteLiveM3u8Shadow",
    riskLevel: "high",
    responseKind: "may-stream-bytes",
    expectedInputFields: ["channelId", "src", "streamUrl"],
    expectedOutputFields: ["ok", "src", "mode", "streamUrl", "contentType", "error"],
  },
};

function readFixtures(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const fixtures = JSON.parse(raw);
  if (!Array.isArray(fixtures)) {
    throw new Error("Inactive playback route adapter fixture file must contain a JSON array");
  }
  return fixtures;
}

function normalizeRequest(fixture) {
  const request = fixture.request && typeof fixture.request === "object" ? fixture.request : {};
  const method = String(request.method || "").toUpperCase();
  const requestPath = String(request.path || "");
  const query = request.query && typeof request.query === "object" ? request.query : {};
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const payloads = method === "POST" ? [body, query] : [query, body];
  const metadata = ROUTE_METADATA[requestPath] || null;

  const streamUrl = firstString(payloads, ["streamUrl", "url", "src"]);
  const sourceType = firstString(payloads, ["sourceType"]);
  const clientType = normalizeClientType(payloads);
  const playbackMode = normalizePlaybackMode(payloads, sourceType, streamUrl);
  const requiresTranscode = firstBool(payloads, ["requiresTranscode", "needsTranscode"]) ?? (clientType === "mobile" && playbackMode === "hls");
  const shouldUseFfmpeg = firstBool(payloads, ["shouldUseFfmpeg", "useFfmpeg"]) ?? requiresTranscode;

  return {
    caseName: String(fixture.name || ""),
    requestMethod: method,
    requestPath,
    routeTarget: metadata ? metadata.routeTarget : "",
    futureHaskellMirrorName: metadata ? metadata.futureHaskellMirrorName : "",
    riskLevel: metadata ? metadata.riskLevel : "",
    sourceType,
    clientType,
    responseKind: metadata ? metadata.responseKind : "json-only",
    playbackMode,
    requiresTranscode,
    shouldUseFfmpeg,
    streamUrl,
    expectedInputFields: metadata ? metadata.expectedInputFields : [],
    expectedOutputFields: metadata ? metadata.expectedOutputFields : [],
  };
}

function firstString(payloads, keys) {
  for (const payload of payloads) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const value = payload[key];
        if (value === null || value === undefined) {
          return "";
        }
        return String(value);
      }
    }
  }
  return "";
}

function firstBool(payloads, keys) {
  for (const payload of payloads) {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) {
        continue;
      }
      const value = payload[key];
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const lowered = value.toLowerCase();
        if (lowered === "true") return true;
        if (lowered === "false") return false;
      }
    }
  }
  return null;
}

function normalizeClientType(payloads) {
  const direct = firstString(payloads, ["clientType"]);
  if (direct) {
    return direct;
  }
  const mobile = firstBool(payloads, ["mobile"]);
  if (mobile === true) {
    return "mobile";
  }
  if (mobile === false) {
    return "desktop";
  }
  return "";
}

function normalizePlaybackMode(payloads, sourceType, streamUrl) {
  const direct = firstString(payloads, ["playbackMode", "mode"]);
  if (direct) {
    return direct;
  }
  if (firstBool(payloads, ["forceHls"]) === true) {
    return "hls";
  }
  if (sourceType === "live" && streamUrl.includes(".m3u8")) {
    return "live";
  }
  return "direct";
}

function adapterDecision(fixture) {
  const normalized = normalizeRequest(fixture);

  if (!ALLOWED_METHODS.has(normalized.requestMethod)) {
    return decision(normalized, "invalid", false, false, false, "Unsupported request method; inactive adapter contract is invalid.", "UNSUPPORTED_METHOD");
  }
  if (!normalized.requestPath) {
    return decision(normalized, "invalid", false, false, false, "Missing route path; inactive adapter contract is invalid.", "MISSING_ROUTE");
  }
  if (!normalized.routeTarget) {
    return decision(normalized, "invalid", false, false, false, "Unknown route path; inactive adapter contract is invalid.", "UNKNOWN_ROUTE");
  }
  if (!normalized.sourceType) {
    return decision(normalized, "invalid", false, false, false, "Missing sourceType; inactive adapter contract is invalid.", "MISSING_SOURCE_TYPE");
  }
  if (!SOURCE_TYPES.has(normalized.sourceType)) {
    return decision(normalized, "invalid", false, false, false, "Unsupported sourceType; inactive adapter contract is invalid.", "UNSUPPORTED_SOURCE_TYPE");
  }
  if (!normalized.clientType) {
    return decision(normalized, "invalid", false, false, false, "Missing clientType; inactive adapter contract is invalid.", "MISSING_CLIENT_TYPE");
  }
  if (!CLIENT_TYPES.has(normalized.clientType)) {
    return decision(normalized, "invalid", false, false, false, "Unsupported clientType; inactive adapter contract is invalid.", "UNSUPPORTED_CLIENT_TYPE");
  }
  if (!normalized.streamUrl) {
    return decision(normalized, "invalid", false, false, false, "Missing streamUrl; inactive adapter contract is invalid.", "MISSING_STREAM_URL");
  }
  if (!safeStreamUrl(normalized.streamUrl)) {
    return decision(normalized, "invalid", false, false, false, "Unsafe streamUrl; inactive adapter contract is invalid.", "UNSAFE_STREAM_URL");
  }
  if (!PLAYBACK_MODES.has(normalized.playbackMode)) {
    return decision(normalized, "invalid", false, false, false, "Unsupported playbackMode; inactive adapter contract is invalid.", "UNSUPPORTED_PLAYBACK_MODE");
  }
  if (normalized.sourceType === "live" && normalized.streamUrl.includes(".m3u8")) {
    return decision(normalized, "live", true, false, false, "Live m3u8 adapter contract preserves live playback.");
  }
  if (normalized.clientType === "mobile" && normalized.playbackMode === "hls") {
    return decision(normalized, "hls", true, true, true, "Mobile adapter contract allows HLS only when required.");
  }
  if (normalized.sourceType === "series") {
    return decision(normalized, "direct", true, false, false, "Series episode adapter contract preserves direct playback.");
  }
  if (normalized.routeTarget === "/api/ftp/raw") {
    return decision(normalized, "direct", true, false, false, "FTP raw adapter contract may stream bytes without transcoding.");
  }
  if (normalized.clientType === "desktop") {
    return decision(normalized, "direct", true, false, false, "Desktop adapter contract preserves direct playback without FFmpeg.");
  }
  return decision(
    normalized,
    "direct",
    true,
    normalized.requiresTranscode === true,
    normalized.shouldUseFfmpeg === true,
    "Fallback adapter contract preserves normalized fixture flags."
  );
}

function decision(source, playbackMode, ok, requiresTranscode, shouldUseFfmpeg, reason, errorCode = "") {
  return {
    caseName: source.caseName,
    requestMethod: source.requestMethod,
    requestPath: source.requestPath,
    route: source.routeTarget,
    routeTarget: source.routeTarget,
    futureHaskellMirrorName: source.futureHaskellMirrorName,
    riskLevel: source.riskLevel,
    sourceType: source.sourceType,
    clientType: source.clientType,
    responseKind: source.responseKind,
    routeMayStreamBytes: source.responseKind === "may-stream-bytes",
    routeReturnsJson: source.responseKind === "json-only",
    playbackMode,
    requiresTranscode,
    shouldUseFfmpeg,
    streamUrl: source.streamUrl,
    statusCode: ok ? 200 : statusCodeFor(errorCode),
    errorCode,
    expectedInputFields: source.expectedInputFields,
    expectedOutputFields: source.expectedOutputFields,
    ok,
    reason,
    safety: {
      serverStarted: false,
      networkCalled: false,
      ffmpegStarted: false,
      runtimePlaybackChanged: false,
      activeRoutesAdded: false,
      inactiveRouteWired: false,
    },
  };
}

function safeStreamUrl(value) {
  return STREAM_URL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function statusCodeFor(errorCode) {
  if (errorCode === "UNKNOWN_ROUTE") return 404;
  if (errorCode === "UNSUPPORTED_METHOD") return 405;
  if (errorCode === "UNSUPPORTED_CLIENT_TYPE") return 422;
  if (errorCode === "UNSUPPORTED_SOURCE_TYPE") return 422;
  if (errorCode === "UNSUPPORTED_PLAYBACK_MODE") return 422;
  return 400;
}

function main() {
  const fixturePath = process.argv[2] || defaultFixturePath;
  const fixtures = readFixtures(fixturePath);
  const decisions = fixtures.map(adapterDecision);
  process.stdout.write(`${JSON.stringify(decisions, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
