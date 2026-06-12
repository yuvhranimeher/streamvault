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

  if (!streamUrl) {
    return decision(fixture, "invalid", false, false, false, "Missing streamUrl; route contract is invalid.");
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

  function decision(source, playbackMode, ok, requiresTranscode, shouldUseFfmpeg, reason) {
    return {
      caseName: source.name || "",
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
      expectedInputFields: Array.isArray(source.expectedInputFields) ? source.expectedInputFields : [],
      expectedOutputFields: Array.isArray(source.expectedOutputFields) ? source.expectedOutputFields : [],
      ok,
      reason,
    };
  }
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
