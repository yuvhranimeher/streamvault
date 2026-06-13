#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const defaultFixturePath = path.join(
  root,
  "tools",
  "playback-parity-v1",
  "playback-route-contract-fixtures.json"
);
const ROUTE_TARGETS = new Set([
  "/api/playback/local",
  "/api/playback/ftp",
  "/api/playback/movie",
  "/api/ftp/raw",
  "live TV m3u8 playback",
  "series episode playback",
]);
const CLIENT_TYPES = new Set(["desktop", "mobile"]);
const SOURCE_TYPES = new Set(["movie", "series", "live"]);
const PLAYBACK_MODES = new Set(["direct", "hls", "live", "invalid"]);
const STREAM_URL_PREFIXES = ["http://", "https://", "ftp://", "local://"];

function readFixtures(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const fixtures = JSON.parse(raw);
  if (!Array.isArray(fixtures)) {
    throw new Error("Route contract fixture file must contain a JSON array");
  }
  return fixtures;
}

function routeDecision(fixture) {
  const streamUrl = fixture.streamUrl || "";
  const sourceType = fixture.sourceType || "";
  const clientType = fixture.clientType || "";
  const responseKind = fixture.responseKind || "json-only";

  if (!fixture.routeTarget) {
    return decision(fixture, "invalid", false, false, false, "Missing routeTarget; route contract is invalid.", "MISSING_ROUTE");
  }
  if (!sourceType) {
    return decision(fixture, "invalid", false, false, false, "Missing sourceType; route contract is invalid.", "INVALID_FIXTURE");
  }
  if (!clientType) {
    return decision(fixture, "invalid", false, false, false, "Missing clientType; route contract is invalid.", "INVALID_FIXTURE");
  }
  if (!streamUrl) {
    return decision(fixture, "invalid", false, false, false, "Missing streamUrl; route contract is invalid.", "MISSING_STREAM_URL");
  }
  if (!ROUTE_TARGETS.has(fixture.routeTarget)) {
    return decision(fixture, "invalid", false, false, false, "Unknown routeTarget; route contract is invalid.", "UNKNOWN_ROUTE");
  }
  if (!CLIENT_TYPES.has(clientType)) {
    return decision(fixture, "invalid", false, false, false, "Unsupported clientType; route contract is invalid.", "UNSUPPORTED_CLIENT_TYPE");
  }
  if (!SOURCE_TYPES.has(sourceType)) {
    return decision(fixture, "invalid", false, false, false, "Unsupported sourceType; route contract is invalid.", "UNSUPPORTED_SOURCE_TYPE");
  }
  if (!STREAM_URL_PREFIXES.some((prefix) => streamUrl.startsWith(prefix))) {
    return decision(fixture, "invalid", false, false, false, "Unsafe streamUrl; route contract is invalid.", "UNSAFE_STREAM_URL");
  }
  if (!PLAYBACK_MODES.has(fixture.playbackMode || "")) {
    return decision(fixture, "invalid", false, false, false, "Unsupported playbackMode; route contract is invalid.", "UNSUPPORTED_PLAYBACK_MODE");
  }
  if (sourceType === "live" && streamUrl.includes(".m3u8")) {
    return decision(fixture, "live", true, false, false, "Live m3u8 route contract preserves live playback.");
  }
  if (clientType === "mobile" && fixture.playbackMode === "hls") {
    return decision(fixture, "hls", true, true, true, "Mobile route contract allows HLS only when required.");
  }
  if (sourceType === "series") {
    return decision(fixture, "direct", true, false, false, "Series episode route contract preserves direct playback.");
  }
  if (fixture.routeTarget === "/api/ftp/raw") {
    return decision(fixture, "direct", true, false, false, "FTP raw route contract may stream bytes without transcoding.");
  }
  if (clientType === "desktop") {
    return decision(fixture, "direct", true, false, false, "Desktop route contract preserves direct playback without FFmpeg.");
  }
  return decision(
    fixture,
    "direct",
    true,
    fixture.requiresTranscode === true,
    fixture.shouldUseFfmpeg === true,
    "Fallback route contract preserves fixture flags."
  );

  function decision(source, playbackMode, ok, requiresTranscode, shouldUseFfmpeg, reason, errorCode = "") {
    return {
      caseName: source.name || "",
      route: source.routeTarget || "",
      routeTarget: source.routeTarget || "",
      futureHaskellMirrorName: source.futureHaskellMirrorName || "",
      riskLevel: source.riskLevel || "",
      sourceType,
      clientType,
      responseKind,
      routeMayStreamBytes: responseKind === "may-stream-bytes",
      routeReturnsJson: responseKind === "json-only",
      playbackMode,
      requiresTranscode,
      shouldUseFfmpeg,
      streamUrl,
      statusCode: ok ? 200 : statusCodeFor(errorCode),
      errorCode,
      expectedInputFields: Array.isArray(source.expectedInputFields) ? source.expectedInputFields : [],
      expectedOutputFields: Array.isArray(source.expectedOutputFields) ? source.expectedOutputFields : [],
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
  const decisions = fixtures.map(routeDecision);
  process.stdout.write(`${JSON.stringify(decisions, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
