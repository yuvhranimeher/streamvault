#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const defaultFixturePath = path.join(
  root,
  "tools",
  "playback-parity-v1",
  "inactive-playback-route-error-taxonomy-fixtures.json"
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
const MEDIA_TYPES = new Set(["movie", "series", "live"]);
const SAFETY_NOTES = [
  "shadow-only",
  "fixture-only",
  "no-server",
  "no-network",
  "no-ffmpeg",
  "no-active-runtime-wiring",
  "no-live-urls",
];

const TAXONOMY = {
  MISSING_ID: {
    status: 400,
    errorCode: "PLAYBACK_ROUTE_VALIDATION_ERROR",
    errorCategory: "VALIDATION_ERROR",
    userSafeMessage: "Playback request is missing required information.",
    developerDetail: "Missing playback id before inactive route selection.",
    retryable: false,
  },
  MALFORMED_ID: {
    status: 400,
    errorCode: "PLAYBACK_ROUTE_VALIDATION_ERROR",
    errorCategory: "VALIDATION_ERROR",
    userSafeMessage: "Playback request is missing required information.",
    developerDetail: "Playback id contains unsupported characters.",
    retryable: false,
  },
  MISSING_MEDIA_TYPE: {
    status: 400,
    errorCode: "PLAYBACK_ROUTE_VALIDATION_ERROR",
    errorCategory: "VALIDATION_ERROR",
    userSafeMessage: "Playback request is missing required information.",
    developerDetail: "Missing media type before inactive route selection.",
    retryable: false,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 422,
    errorCode: "PLAYBACK_ROUTE_VALIDATION_ERROR",
    errorCategory: "VALIDATION_ERROR",
    userSafeMessage: "Playback request is not supported.",
    developerDetail: "Media type is outside the inactive route taxonomy allowlist.",
    retryable: false,
  },
  MISSING_SOURCE_URL: {
    status: 400,
    errorCode: "PLAYBACK_ROUTE_VALIDATION_ERROR",
    errorCategory: "VALIDATION_ERROR",
    userSafeMessage: "Playback request is missing required information.",
    developerDetail: "Missing source URL before inactive adapter selection.",
    retryable: false,
  },
  UNSAFE_PLACEHOLDER_URL: {
    status: 400,
    errorCode: "PLAYBACK_ROUTE_UNSAFE_URL",
    errorCategory: "UNSAFE_URL",
    userSafeMessage: "Playback source is not allowed.",
    developerDetail: "Unsafe placeholder stream URL was rejected before adapter selection.",
    retryable: false,
  },
  ADAPTER_DENIED: {
    status: 403,
    errorCode: "PLAYBACK_ROUTE_ADAPTER_DENIED",
    errorCategory: "ADAPTER_DENIED",
    userSafeMessage: "Playback source is not available.",
    developerDetail: "Inactive adapter denied the source without exposing transport details.",
    retryable: false,
  },
  RESPONSE_BODY_REJECTED: {
    status: 502,
    errorCode: "PLAYBACK_ROUTE_BODY_REJECTED",
    errorCategory: "BODY_REJECTED",
    userSafeMessage: "Playback response could not be prepared.",
    developerDetail: "Response body validator rejected the fixture envelope.",
    retryable: true,
  },
  STATUS_HEADER_REJECTED: {
    status: 502,
    errorCode: "PLAYBACK_ROUTE_HEADER_REJECTED",
    errorCategory: "HEADER_REJECTED",
    userSafeMessage: "Playback response could not be prepared.",
    developerDetail: "Status/header validator rejected the fixture envelope.",
    retryable: true,
  },
  UNKNOWN_ROUTE: {
    status: 404,
    errorCode: "PLAYBACK_ROUTE_NOT_FOUND",
    errorCategory: "NOT_FOUND",
    userSafeMessage: "Playback route was not found.",
    developerDetail: "Route target is not part of the inactive playback route taxonomy.",
    retryable: false,
  },
  METHOD_NOT_ALLOWED: {
    status: 405,
    errorCode: "PLAYBACK_ROUTE_METHOD_NOT_ALLOWED",
    errorCategory: "METHOD_NOT_ALLOWED",
    userSafeMessage: "Playback request method is not allowed.",
    developerDetail: "Inactive route taxonomy allows only GET and POST methods.",
    retryable: false,
  },
  SHADOW_INTERNAL_SAFE_ERROR: {
    status: 500,
    errorCode: "PLAYBACK_ROUTE_SHADOW_INTERNAL_ERROR",
    errorCategory: "SHADOW_INTERNAL_ERROR",
    userSafeMessage: "Playback is temporarily unavailable.",
    developerDetail: "Shadow-only internal error fixture uses sanitized detail.",
    retryable: true,
  },
};

function readFixtures(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Error taxonomy fixture file must contain a JSON array");
  }
  return parsed;
}

function errorTaxonomyDecision(fixture) {
  const source = normalizeFixture(fixture);
  const reasonCode = rejectionReason(source);
  const taxonomy = TAXONOMY[reasonCode] || TAXONOMY.SHADOW_INTERNAL_SAFE_ERROR;
  return envelope(source, reasonCode, taxonomy);
}

function normalizeFixture(fixture) {
  return {
    fixtureId: String(fixture.fixtureId || ""),
    method: String(fixture.method || "").toUpperCase(),
    routeTarget: String(fixture.routeTarget || ""),
    playbackId: String(fixture.playbackId || ""),
    mediaType: String(fixture.mediaType || ""),
    streamUrl: String(fixture.streamUrl || ""),
    adapterDecision: String(fixture.adapterDecision || "accepted"),
    responseBodyDecision: String(fixture.responseBodyDecision || "accepted"),
    statusHeaderDecision: String(fixture.statusHeaderDecision || "accepted"),
    forceInternalError: String(fixture.forceInternalError || "false").toLowerCase(),
  };
}

function rejectionReason(source) {
  if (source.forceInternalError === "true") return "SHADOW_INTERNAL_SAFE_ERROR";
  if (!source.routeTarget || !ROUTE_TARGETS.has(source.routeTarget)) return "UNKNOWN_ROUTE";
  if (!METHODS.has(source.method)) return "METHOD_NOT_ALLOWED";
  if (!source.playbackId) return "MISSING_ID";
  if (!/^[A-Za-z0-9._-]+$/.test(source.playbackId)) return "MALFORMED_ID";
  if (!source.mediaType) return "MISSING_MEDIA_TYPE";
  if (!MEDIA_TYPES.has(source.mediaType)) return "UNSUPPORTED_MEDIA_TYPE";
  if (!source.streamUrl) return "MISSING_SOURCE_URL";
  if (!safeStreamUrl(source.streamUrl)) return "UNSAFE_PLACEHOLDER_URL";
  if (source.adapterDecision !== "accepted") return "ADAPTER_DENIED";
  if (source.responseBodyDecision !== "accepted") return "RESPONSE_BODY_REJECTED";
  if (source.statusHeaderDecision !== "accepted") return "STATUS_HEADER_REJECTED";
  return "SHADOW_INTERNAL_SAFE_ERROR";
}

function envelope(source, reasonCode, taxonomy) {
  return {
    fixtureId: source.fixtureId,
    decision: "rejected",
    ok: false,
    status: taxonomy.status,
    errorCode: taxonomy.errorCode,
    errorCategory: taxonomy.errorCategory,
    reasonCode,
    userSafeMessage: taxonomy.userSafeMessage,
    developerDetail: taxonomy.developerDetail,
    retryable: taxonomy.retryable,
    headers: headersForReason(reasonCode),
    bodyShape: "error-json",
    safetyNotes: SAFETY_NOTES,
  };
}

function headersForReason(reasonCode) {
  const headers = {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-streamvault-shadow": "inactive-route-error-taxonomy-v1",
  };
  if (reasonCode === "METHOD_NOT_ALLOWED") {
    headers.allow = "GET, POST";
  }
  return sortHeaders(headers);
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

function main() {
  const fixturePath = process.argv[2] || defaultFixturePath;
  const fixtures = readFixtures(fixturePath);
  const decisions = fixtures.map(errorTaxonomyDecision);
  process.stdout.write(`${JSON.stringify(decisions, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
