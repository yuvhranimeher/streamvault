#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const defaultFixturePath = path.join(
  root,
  "tools",
  "playback-parity-v1",
  "inactive-playback-route-implementation-shadow-fixtures.json"
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
const SOURCE_TYPES = new Set(["movie", "series", "live"]);
const CLIENT_TYPES = new Set(["desktop", "mobile"]);
const PLAYBACK_MODES = new Set(["direct", "hls", "live"]);
const BODY_SHAPES = new Set(["movie-json", "ftp-json", "local-json", "raw-bytes", "series-json", "live-hls"]);
const SAFETY_NOTES = [
  "shadow-only",
  "fixture-only",
  "no-server",
  "no-network",
  "no-ffmpeg",
  "no-active-runtime-wiring",
  "no-live-url-activation",
];

const TAXONOMY = {
  OK: taxonomy(true, 200, "", "", "OK", "", "", false),
  PARTIAL_CONTENT: taxonomy(true, 206, "", "", "PARTIAL_CONTENT", "", "", false),
  UNKNOWN_ROUTE: taxonomy(false, 404, "PLAYBACK_ROUTE_NOT_FOUND", "NOT_FOUND", "UNKNOWN_ROUTE", "Playback route was not found.", "Route target is not part of the inactive playback route implementation shadow.", false),
  METHOD_NOT_ALLOWED: taxonomy(false, 405, "PLAYBACK_ROUTE_METHOD_NOT_ALLOWED", "METHOD_NOT_ALLOWED", "METHOD_NOT_ALLOWED", "Playback request method is not allowed.", "Inactive route implementation shadow allows only GET and POST methods.", false),
  MISSING_ID: taxonomy(false, 400, "PLAYBACK_ROUTE_VALIDATION_ERROR", "VALIDATION_ERROR", "MISSING_ID", "Playback request is missing required information.", "Missing playback id before inactive route composition.", false),
  MALFORMED_ID: taxonomy(false, 400, "PLAYBACK_ROUTE_VALIDATION_ERROR", "VALIDATION_ERROR", "MALFORMED_ID", "Playback request is missing required information.", "Playback id contains unsupported characters.", false),
  UNSUPPORTED_SOURCE_TYPE: taxonomy(false, 422, "PLAYBACK_ROUTE_VALIDATION_ERROR", "VALIDATION_ERROR", "UNSUPPORTED_SOURCE_TYPE", "Playback request is not supported.", "Source type is outside the inactive route implementation allowlist.", false),
  UNSUPPORTED_CLIENT_TYPE: taxonomy(false, 422, "PLAYBACK_ROUTE_VALIDATION_ERROR", "VALIDATION_ERROR", "UNSUPPORTED_CLIENT_TYPE", "Playback request is not supported.", "Client type is outside the inactive route implementation allowlist.", false),
  UNSUPPORTED_PLAYBACK_MODE: taxonomy(false, 422, "PLAYBACK_ROUTE_VALIDATION_ERROR", "VALIDATION_ERROR", "UNSUPPORTED_PLAYBACK_MODE", "Playback request is not supported.", "Playback mode is outside the inactive route implementation allowlist.", false),
  UNSUPPORTED_BODY_SHAPE: taxonomy(false, 422, "PLAYBACK_ROUTE_VALIDATION_ERROR", "VALIDATION_ERROR", "UNSUPPORTED_BODY_SHAPE", "Playback response could not be prepared.", "Response body shape is outside the inactive implementation allowlist.", false),
  MISSING_SOURCE_URL: taxonomy(false, 400, "PLAYBACK_ROUTE_VALIDATION_ERROR", "VALIDATION_ERROR", "MISSING_SOURCE_URL", "Playback request is missing required information.", "Missing source URL before inactive route composition.", false),
  UNSAFE_PLACEHOLDER_URL: taxonomy(false, 400, "PLAYBACK_ROUTE_UNSAFE_URL", "UNSAFE_URL", "UNSAFE_PLACEHOLDER_URL", "Playback source is not allowed.", "Unsafe placeholder stream URL was rejected before any active playback.", false),
  RESPONSE_BODY_REJECTED: taxonomy(false, 502, "PLAYBACK_ROUTE_BODY_REJECTED", "BODY_REJECTED", "RESPONSE_BODY_REJECTED", "Playback response could not be prepared.", "Response body shadow rejected the composed fixture envelope.", true),
  STATUS_HEADER_REJECTED: taxonomy(false, 502, "PLAYBACK_ROUTE_HEADER_REJECTED", "HEADER_REJECTED", "STATUS_HEADER_REJECTED", "Playback response could not be prepared.", "Status/header shadow rejected the composed fixture envelope.", true),
  SHADOW_INTERNAL_SAFE_ERROR: taxonomy(false, 500, "PLAYBACK_ROUTE_SHADOW_INTERNAL_ERROR", "SHADOW_INTERNAL_ERROR", "SHADOW_INTERNAL_SAFE_ERROR", "Playback is temporarily unavailable.", "Shadow-only internal error fixture uses sanitized detail.", true),
};

function taxonomy(ok, status, errorCode, errorCategory, reasonCode, userSafeMessage, developerDetail, retryable) {
  return { ok, status, errorCode, errorCategory, reasonCode, userSafeMessage, developerDetail, retryable };
}

function readFixtures(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Implementation shadow fixture file must contain a JSON array");
  }
  return parsed;
}

function routeImplementationDecision(fixture) {
  const source = normalizeFixture(fixture);
  const adapter = adapterDecision(source);
  const responseBody = responseBodyDecision(source, adapter);
  const statusHeader = statusHeaderDecision(source, responseBody);
  const finalReason = finalReasonCode(source, adapter, responseBody, statusHeader);
  const accepted = finalReason === "OK" || finalReason === "PARTIAL_CONTENT";
  const errorTaxonomy = TAXONOMY[finalReason] || TAXONOMY.SHADOW_INTERNAL_SAFE_ERROR;
  const status = accepted ? statusHeader.status : errorTaxonomy.status;
  const bodyShape = accepted ? responseBody.responseShape : "error-json";

  return {
    fixtureId: source.fixtureId,
    routeDecision: accepted ? "accepted" : "rejected",
    ok: accepted,
    status,
    headers: accepted ? statusHeader.headers : errorHeaders(finalReason),
    body: accepted ? responseBody.body : errorBody(errorTaxonomy),
    bodyShape,
    reasonCode: accepted ? statusHeader.reasonCode : finalReason,
    errorTaxonomy,
    adapterDecision: adapter,
    responseBodyDecision: responseBody,
    statusHeaderDecision: statusHeader,
    safetyNotes: SAFETY_NOTES,
  };
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
    bodyShape: String(fixture.bodyShape || ""),
    range: String(fixture.range || ""),
    forceResponseBodyReject: String(fixture.forceResponseBodyReject || "false").toLowerCase(),
    forceStatusHeaderReject: String(fixture.forceStatusHeaderReject || "false").toLowerCase(),
    forceInternalError: String(fixture.forceInternalError || "false").toLowerCase(),
  };
}

function adapterDecision(source) {
  const reasonCode = adapterReasonCode(source);
  const accepted = reasonCode === "OK";
  return {
    decision: accepted ? "accepted" : "rejected",
    ok: accepted,
    routeTarget: source.routeTarget,
    playbackMode: accepted ? source.playbackMode : "invalid",
    requiresTranscode: source.clientType === "mobile" && source.playbackMode === "hls",
    shouldUseFfmpeg: source.clientType === "mobile" && source.playbackMode === "hls",
    reasonCode,
    errorCode: accepted ? "" : (TAXONOMY[reasonCode] || TAXONOMY.SHADOW_INTERNAL_SAFE_ERROR).errorCode,
  };
}

function adapterReasonCode(source) {
  if (!ROUTE_TARGETS.has(source.routeTarget)) return "UNKNOWN_ROUTE";
  if (!METHODS.has(source.method)) return "METHOD_NOT_ALLOWED";
  if (!source.playbackId) return "MISSING_ID";
  if (!/^[A-Za-z0-9._-]+$/.test(source.playbackId)) return "MALFORMED_ID";
  if (!SOURCE_TYPES.has(source.sourceType)) return "UNSUPPORTED_SOURCE_TYPE";
  if (!CLIENT_TYPES.has(source.clientType)) return "UNSUPPORTED_CLIENT_TYPE";
  if (!PLAYBACK_MODES.has(source.playbackMode)) return "UNSUPPORTED_PLAYBACK_MODE";
  if (!source.streamUrl) return "MISSING_SOURCE_URL";
  if (!safeStreamUrl(source.streamUrl)) return "UNSAFE_PLACEHOLDER_URL";
  return "OK";
}

function responseBodyDecision(source, adapter) {
  if (!adapter.ok) {
    return responseBodyEnvelope("skipped", false, "error-json", 0, "ADAPTER_REJECTED", adapter.errorCode, {});
  }
  if (source.forceResponseBodyReject === "true") {
    return responseBodyEnvelope("rejected", false, "error-json", 502, "RESPONSE_BODY_REJECTED", TAXONOMY.RESPONSE_BODY_REJECTED.errorCode, {});
  }
  if (!BODY_SHAPES.has(source.bodyShape) || expectedBodyShape(source.routeTarget) !== source.bodyShape) {
    return responseBodyEnvelope("rejected", false, "error-json", 422, "UNSUPPORTED_BODY_SHAPE", TAXONOMY.UNSUPPORTED_BODY_SHAPE.errorCode, {});
  }
  const statusCode = source.bodyShape === "raw-bytes" && source.range ? 206 : 200;
  return responseBodyEnvelope("accepted", true, source.bodyShape, statusCode, "OK", "", responsePayload(source));
}

function responseBodyEnvelope(decision, ok, responseShape, statusCode, reasonCode, errorCode, body) {
  return { decision, ok, responseShape, statusCode, reasonCode, errorCode, body };
}

function statusHeaderDecision(source, responseBody) {
  if (!responseBody.ok) {
    return statusHeaderEnvelope("skipped", false, 0, {}, "error-json", responseBody.reasonCode);
  }
  if (source.forceStatusHeaderReject === "true") {
    return statusHeaderEnvelope("rejected", false, 502, errorHeaders("STATUS_HEADER_REJECTED"), "error-json", "STATUS_HEADER_REJECTED");
  }
  const reasonCode = source.bodyShape === "raw-bytes" && source.range ? "PARTIAL_CONTENT" : "OK";
  return statusHeaderEnvelope("accepted", true, statusForSuccess(source), headersForShape(source), source.bodyShape, reasonCode);
}

function statusHeaderEnvelope(decision, ok, status, headers, bodyShape, reasonCode) {
  return { decision, ok, status, headers, bodyShape, reasonCode };
}

function finalReasonCode(source, adapter, responseBody, statusHeader) {
  if (source.forceInternalError === "true") return "SHADOW_INTERNAL_SAFE_ERROR";
  if (!adapter.ok) return adapter.reasonCode;
  if (!responseBody.ok) return responseBody.reasonCode === "UNSUPPORTED_BODY_SHAPE" ? "RESPONSE_BODY_REJECTED" : responseBody.reasonCode;
  if (!statusHeader.ok) return "STATUS_HEADER_REJECTED";
  return statusHeader.reasonCode;
}

function expectedBodyShape(routeTarget) {
  if (routeTarget === "/api/playback/movie") return "movie-json";
  if (routeTarget === "/api/playback/ftp") return "ftp-json";
  if (routeTarget === "/api/playback/local") return "local-json";
  if (routeTarget === "/api/ftp/raw") return "raw-bytes";
  if (routeTarget === "series episode playback") return "series-json";
  if (routeTarget === "live TV m3u8 playback") return "live-hls";
  return "";
}

function responsePayload(source) {
  if (source.bodyShape === "movie-json") {
    return {
      ok: true,
      streamUrl: source.streamUrl,
      sourceType: source.sourceType,
      clientType: source.clientType,
      playbackMode: source.playbackMode,
    };
  }
  if (source.bodyShape === "ftp-json") {
    return {
      ok: true,
      src: source.streamUrl,
      mode: source.playbackMode,
      directPlayable: source.playbackMode === "direct",
      decodedUrl: source.streamUrl,
    };
  }
  if (source.bodyShape === "local-json") {
    return {
      ok: true,
      src: source.streamUrl,
      mode: source.playbackMode,
      directPlayable: true,
    };
  }
  if (source.bodyShape === "raw-bytes") {
    return {
      status: statusForSuccess(source),
      contentType: "video/mp4",
      acceptRanges: "bytes",
      contentRange: source.range ? `${source.range}/*` : "",
      streamUrl: source.streamUrl,
    };
  }
  if (source.bodyShape === "series-json") {
    return {
      ok: true,
      src: source.streamUrl,
      mode: source.playbackMode,
      sourceType: "series",
      streamUrl: source.streamUrl,
    };
  }
  return {
    ok: true,
    src: source.streamUrl,
    mode: "live",
    streamUrl: source.streamUrl,
    contentType: "application/vnd.apple.mpegurl",
  };
}

function errorBody(errorTaxonomy) {
  return {
    ok: false,
    error: errorTaxonomy.errorCode,
    reasonCode: errorTaxonomy.reasonCode,
    message: errorTaxonomy.userSafeMessage,
  };
}

function headersForShape(source) {
  if (source.bodyShape === "raw-bytes") {
    const headers = implementationBaseHeaders("video/mp4");
    headers["accept-ranges"] = "bytes";
    if (source.range) {
      headers["content-range"] = `${source.range}/*`;
    }
    return sortHeaders(headers);
  }
  if (source.bodyShape === "live-hls") {
    return sortHeaders(implementationBaseHeaders("application/vnd.apple.mpegurl"));
  }
  return sortHeaders(implementationBaseHeaders("application/json; charset=utf-8"));
}

function errorHeaders(reasonCode) {
  const headers = implementationBaseHeaders("application/json; charset=utf-8");
  if (reasonCode === "METHOD_NOT_ALLOWED") {
    headers.allow = "GET, POST";
  }
  return sortHeaders(headers);
}

function implementationBaseHeaders(contentType) {
  return {
    "cache-control": "no-store",
    "content-type": contentType,
    "x-streamvault-shadow": "inactive-route-implementation-shadow-v1",
  };
}

function statusForSuccess(source) {
  return source.bodyShape === "raw-bytes" && source.range ? 206 : 200;
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

function sortHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).sort(([left], [right]) => left.localeCompare(right)));
}

function main() {
  const fixturePath = process.argv[2] || defaultFixturePath;
  const fixtures = readFixtures(fixturePath);
  const decisions = fixtures.map(routeImplementationDecision);
  process.stdout.write(`${JSON.stringify(decisions, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
