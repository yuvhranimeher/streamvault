#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const defaultFixturePath = path.join(
  root,
  "tools",
  "playback-parity-v1",
  "inactive-playback-route-response-body-fixtures.json"
);

const ROUTE_TARGETS = new Set([
  "/api/playback/movie",
  "/api/playback/ftp",
  "/api/playback/local",
  "/api/ftp/raw",
  "series episode playback",
  "live TV m3u8 playback",
]);
const CLIENT_TYPES = new Set(["desktop", "mobile"]);
const SOURCE_TYPES = new Set(["movie", "series", "live"]);
const PLAYBACK_MODES = new Set(["direct", "hls", "live"]);
const STREAM_URL_PREFIXES = ["http://", "https://", "ftp://", "local://"];

function readFixtures(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const fixtures = JSON.parse(raw);
  if (!Array.isArray(fixtures)) {
    throw new Error("Route response body fixture file must contain a JSON array");
  }
  return fixtures;
}

function responseBodyDecision(fixture) {
  const source = normalizeFixture(fixture);

  if (!source.routeTarget) {
    return decision(source, false, "invalid", false, false, "Missing routeTarget; response body contract is invalid.", "MISSING_ROUTE");
  }
  if (!ROUTE_TARGETS.has(source.routeTarget)) {
    return decision(source, false, "invalid", false, false, "Unknown routeTarget; response body contract is invalid.", "UNKNOWN_ROUTE");
  }
  if (!source.sourceType) {
    return decision(source, false, "invalid", false, false, "Missing sourceType; response body contract is invalid.", "UNSUPPORTED_SOURCE_TYPE");
  }
  if (!SOURCE_TYPES.has(source.sourceType)) {
    return decision(source, false, "invalid", false, false, "Unsupported sourceType; response body contract is invalid.", "UNSUPPORTED_SOURCE_TYPE");
  }
  if (!source.clientType) {
    return decision(source, false, "invalid", false, false, "Missing clientType; response body contract is invalid.", "UNSUPPORTED_CLIENT_TYPE");
  }
  if (!CLIENT_TYPES.has(source.clientType)) {
    return decision(source, false, "invalid", false, false, "Unsupported clientType; response body contract is invalid.", "UNSUPPORTED_CLIENT_TYPE");
  }
  if (!source.streamUrl) {
    return decision(source, false, "invalid", false, false, "Missing streamUrl; response body contract is invalid.", "MISSING_STREAM_URL");
  }
  if (!safeStreamUrl(source.streamUrl)) {
    return decision(source, false, "invalid", false, false, "Unsafe streamUrl; response body contract is invalid.", "UNSAFE_STREAM_URL");
  }
  if (!PLAYBACK_MODES.has(source.playbackMode)) {
    return decision(source, false, "invalid", false, false, "Unsupported playbackMode; response body contract is invalid.", "UNSUPPORTED_PLAYBACK_MODE");
  }

  if (source.routeTarget === "/api/playback/movie") {
    return decision(source, true, "movie-json", false, false, "Movie response body returns normalized playback JSON.");
  }
  if (source.routeTarget === "/api/playback/ftp") {
    const hls = source.clientType === "mobile" && source.playbackMode === "hls";
    return decision(source, true, "ftp-json", hls, hls, "FTP response body preserves direct playback or explicit mobile HLS.");
  }
  if (source.routeTarget === "/api/playback/local") {
    return decision(source, true, "local-json", false, false, "Local response body preserves direct local playback.");
  }
  if (source.routeTarget === "/api/ftp/raw") {
    return decision(source, true, "raw-bytes", false, false, "FTP raw response body records byte-stream metadata only.");
  }
  if (source.routeTarget === "series episode playback") {
    return decision(source, true, "series-json", false, false, "Series response body preserves episode direct playback.");
  }
  if (source.routeTarget === "live TV m3u8 playback") {
    return decision(source, true, "live-hls", false, false, "Live HLS response body records playlist metadata only.");
  }
  return decision(source, false, "invalid", false, false, "Unknown routeTarget; response body contract is invalid.", "UNKNOWN_ROUTE");
}

function normalizeFixture(fixture) {
  const playbackMode = String(fixture.playbackMode || "");
  const clientType = String(fixture.clientType || "");
  return {
    caseName: String(fixture.name || ""),
    routeTarget: String(fixture.routeTarget || ""),
    sourceType: String(fixture.sourceType || ""),
    clientType,
    playbackMode,
    streamUrl: String(fixture.streamUrl || ""),
    responseKind: String(fixture.responseKind || "json-only"),
    range: String(fixture.range || ""),
    expectedResponseShape: String(fixture.expectedResponseShape || ""),
    requiresTranscode: clientType === "mobile" && playbackMode === "hls",
    shouldUseFfmpeg: clientType === "mobile" && playbackMode === "hls",
  };
}

function decision(source, ok, responseShape, requiresTranscode, shouldUseFfmpeg, reason, errorCode = "") {
  const shape = ok ? responseShape : "error-json";
  return {
    caseName: source.caseName,
    route: source.routeTarget,
    routeTarget: source.routeTarget,
    sourceType: source.sourceType,
    clientType: source.clientType,
    responseKind: source.responseKind,
    playbackMode: ok ? source.playbackMode : "invalid",
    requiresTranscode,
    shouldUseFfmpeg,
    streamUrl: source.streamUrl,
    statusCode: ok ? statusCodeForSuccess(shape, source.range) : statusCodeFor(errorCode),
    errorCode,
    responseShape: shape,
    responsePayload: responsePayload(source, shape, errorCode, reason),
    ok,
    reason,
    safety: {
      serverStarted: false,
      networkCalled: false,
      ffmpegStarted: false,
      runtimePlaybackChanged: false,
      activeRoutesAdded: false,
      inactiveRouteWired: false,
      frontendPlaybackChanged: false,
      localhostUrlActivated: false,
    },
  };
}

function responsePayload(source, shape, errorCode, reason) {
  if (shape === "movie-json") {
    return {
      ok: true,
      streamUrl: source.streamUrl,
      sourceType: source.sourceType,
      clientType: source.clientType,
      playbackMode: source.playbackMode,
    };
  }
  if (shape === "ftp-json") {
    return {
      ok: true,
      src: source.streamUrl,
      mode: source.playbackMode,
      directPlayable: source.playbackMode === "direct",
      decodedUrl: source.streamUrl,
      duration: null,
    };
  }
  if (shape === "local-json") {
    return {
      ok: true,
      src: source.streamUrl,
      mode: source.playbackMode,
      directPlayable: true,
      duration: null,
    };
  }
  if (shape === "raw-bytes") {
    return {
      status: source.range ? 206 : 200,
      contentType: "video/mp4",
      acceptRanges: "bytes",
      contentRange: source.range ? `${source.range}/*` : "",
      streamUrl: source.streamUrl,
    };
  }
  if (shape === "series-json") {
    return {
      ok: true,
      src: source.streamUrl,
      mode: source.playbackMode,
      sourceType: "series",
      streamUrl: source.streamUrl,
    };
  }
  if (shape === "live-hls") {
    return {
      ok: true,
      src: source.streamUrl,
      mode: "live",
      streamUrl: source.streamUrl,
      contentType: "application/vnd.apple.mpegurl",
    };
  }
  return {
    ok: false,
    error: errorCode,
    reason,
  };
}

function safeStreamUrl(value) {
  return STREAM_URL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function statusCodeForSuccess(shape, range) {
  if (shape === "raw-bytes" && range) {
    return 206;
  }
  return 200;
}

function statusCodeFor(errorCode) {
  if (errorCode === "UNKNOWN_ROUTE") return 404;
  if (errorCode === "UNSUPPORTED_CLIENT_TYPE") return 422;
  if (errorCode === "UNSUPPORTED_SOURCE_TYPE") return 422;
  if (errorCode === "UNSUPPORTED_PLAYBACK_MODE") return 422;
  return 400;
}

function main() {
  const fixturePath = process.argv[2] || defaultFixturePath;
  const fixtures = readFixtures(fixturePath);
  const decisions = fixtures.map(responseBodyDecision);
  process.stdout.write(`${JSON.stringify(decisions, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
