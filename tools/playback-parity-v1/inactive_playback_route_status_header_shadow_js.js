#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const defaultFixturePath = path.join(
  root,
  "tools",
  "playback-parity-v1",
  "inactive-playback-route-status-header-fixtures.json"
);

const ROUTE_TARGETS = new Set([
  "/api/playback/movie",
  "/api/playback/ftp",
  "/api/playback/local",
  "/api/ftp/raw",
  "series episode playback",
  "live TV m3u8 playback",
]);
const METHODS = new Set(["GET", "POST"]);
const CLIENT_TYPES = new Set(["desktop", "mobile"]);
const SOURCE_TYPES = new Set(["movie", "series", "live"]);
const PLAYBACK_MODES = new Set(["direct", "hls", "live"]);
const BODY_SHAPES = new Set(["movie-json", "ftp-json", "local-json", "raw-bytes", "series-json", "live-hls"]);
const SAFETY_NOTES = ["shadow-only", "no-server", "no-network", "no-ffmpeg", "no-active-runtime-wiring"];

function readFixtures(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Status/header fixture file must contain a JSON array");
  }
  return parsed;
}

function statusHeaderDecision(fixture) {
  const source = normalizeFixture(fixture);
  const reasonCode = rejectionReason(source);
  if (reasonCode) {
    return envelope(source, "rejected", statusForReason(reasonCode), errorHeaders(reasonCode), "error-json", reasonCode);
  }

  const reason = source.bodyShape === "raw-bytes" && source.range ? "PARTIAL_CONTENT" : "OK";
  return envelope(
    source,
    "accepted",
    statusForReason(reason),
    headersForShape(source.bodyShape, source.range),
    source.bodyShape,
    reason
  );
}

function normalizeFixture(fixture) {
  return {
    fixtureId: String(fixture.fixtureId || ""),
    method: String(fixture.method || "").toUpperCase(),
    routeTarget: String(fixture.routeTarget || ""),
    playbackId: String(fixture.playbackId || ""),
    sourceType: String(fixture.sourceType || ""),
    clientType: String(fixture.clientType || ""),
    playbackMode: String(fixture.playbackMode || ""),
    streamUrl: String(fixture.streamUrl || ""),
    adapterDecision: String(fixture.adapterDecision || "accepted"),
    responseBodyDecision: String(fixture.responseBodyDecision || "accepted"),
    bodyShape: String(fixture.bodyShape || ""),
    range: String(fixture.range || ""),
  };
}

function rejectionReason(source) {
  if (!source.routeTarget) return "MISSING_ROUTE";
  if (!ROUTE_TARGETS.has(source.routeTarget)) return "UNKNOWN_ROUTE";
  if (!METHODS.has(source.method)) return "UNSUPPORTED_METHOD";
  if (!source.playbackId) return "MISSING_ID";
  if (!/^[A-Za-z0-9._-]+$/.test(source.playbackId)) return "MALFORMED_ID";
  if (!source.sourceType || !SOURCE_TYPES.has(source.sourceType)) return "UNSUPPORTED_SOURCE_TYPE";
  if (!source.clientType || !CLIENT_TYPES.has(source.clientType)) return "UNSUPPORTED_CLIENT_TYPE";
  if (!source.playbackMode || !PLAYBACK_MODES.has(source.playbackMode)) return "UNSUPPORTED_PLAYBACK_MODE";
  if (!source.streamUrl) return "MISSING_STREAM_URL";
  if (!safeStreamUrl(source.streamUrl)) return "UNSAFE_STREAM_URL";
  if (source.adapterDecision !== "accepted") return "ADAPTER_DENIED";
  if (source.responseBodyDecision !== "accepted") return "RESPONSE_BODY_DENIED";
  if (!BODY_SHAPES.has(source.bodyShape)) return "UNSUPPORTED_BODY_SHAPE";
  return "";
}

function envelope(source, decision, status, headers, bodyShape, reasonCode) {
  return {
    fixtureId: source.fixtureId,
    decision,
    status,
    headers: sortHeaders(headers),
    bodyShape,
    reasonCode,
    safetyNotes: SAFETY_NOTES,
  };
}

function headersForShape(bodyShape, range) {
  if (bodyShape === "raw-bytes") {
    const headers = {
      "accept-ranges": "bytes",
      "cache-control": "no-store",
      "content-type": "video/mp4",
      "x-streamvault-shadow": "inactive-route-status-header-v1",
    };
    if (range) {
      headers["content-range"] = `${range}/*`;
    }
    return headers;
  }
  if (bodyShape === "live-hls") {
    return {
      "cache-control": "no-store",
      "content-type": "application/vnd.apple.mpegurl",
      "x-streamvault-shadow": "inactive-route-status-header-v1",
    };
  }
  return jsonHeaders();
}

function errorHeaders(reasonCode) {
  const headers = jsonHeaders();
  if (reasonCode === "UNSUPPORTED_METHOD") {
    headers.allow = "GET, POST";
  }
  return headers;
}

function jsonHeaders() {
  return {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-streamvault-shadow": "inactive-route-status-header-v1",
  };
}

function sortHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).sort(([left], [right]) => left.localeCompare(right)));
}

function safeStreamUrl(value) {
  if (value.startsWith("local://")) return true;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("ftp://")) {
    try {
      return new URL(value).hostname.endsWith(".example.test");
    } catch (_error) {
      return false;
    }
  }
  return false;
}

function statusForReason(reasonCode) {
  if (reasonCode === "OK") return 200;
  if (reasonCode === "PARTIAL_CONTENT") return 206;
  if (reasonCode === "MISSING_ROUTE" || reasonCode === "UNKNOWN_ROUTE") return 404;
  if (reasonCode === "UNSUPPORTED_METHOD") return 405;
  if (reasonCode === "ADAPTER_DENIED") return 403;
  if (reasonCode === "RESPONSE_BODY_DENIED") return 502;
  if (
    reasonCode === "UNSUPPORTED_SOURCE_TYPE" ||
    reasonCode === "UNSUPPORTED_CLIENT_TYPE" ||
    reasonCode === "UNSUPPORTED_PLAYBACK_MODE" ||
    reasonCode === "UNSUPPORTED_BODY_SHAPE"
  ) {
    return 422;
  }
  return 400;
}

function main() {
  const fixturePath = process.argv[2] || defaultFixturePath;
  const fixtures = readFixtures(fixturePath);
  const decisions = fixtures.map(statusHeaderDecision);
  process.stdout.write(`${JSON.stringify(decisions, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
