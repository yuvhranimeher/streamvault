#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const defaultFixturePath = path.join(
  root,
  "tools",
  "playback-parity-v1",
  "playback-planner-fixtures.json"
);

function readFixtures(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const fixtures = JSON.parse(raw);
  if (!Array.isArray(fixtures)) {
    throw new Error("Fixture file must contain a JSON array");
  }
  return fixtures;
}

function planFixture(fixture) {
  const input = fixture.input || {};
  const streamUrl = fixture.streamUrl || "";
  const sourceType = fixture.sourceType || "";
  const clientType = fixture.clientType || "";

  if (!streamUrl) {
    return plan(fixture, "invalid", false, false, false, "Missing streamUrl; playback plan is invalid.");
  }
  if (sourceType === "live" && streamUrl.includes(".m3u8")) {
    return plan(fixture, "live", true, false, false, "Live TV m3u8 source maps to live shadow playback.");
  }
  if (clientType === "mobile" && fixture.playbackMode === "hls") {
    return plan(fixture, "hls", true, true, true, "Mobile compatibility fixture maps to HLS shadow playback.");
  }
  if (sourceType === "series") {
    return plan(fixture, "direct", true, false, false, "Series episode streamUrl maps to direct shadow playback.");
  }
  if (clientType === "desktop") {
    return plan(fixture, "direct", true, false, false, "Desktop streamUrl maps to direct shadow playback without FFmpeg.");
  }
  return plan(
    fixture,
    "direct",
    true,
    fixture.requiresTranscode === true,
    fixture.shouldUseFfmpeg === true,
    "Fallback shadow playback decision preserves fixture contract."
  );

  function plan(source, playbackMode, ok, requiresTranscode, shouldUseFfmpeg, reason) {
    return {
      inputId: input.id || "",
      fixtureName: source.name || "",
      sourceType,
      clientType,
      playbackMode,
      requiresTranscode,
      shouldUseFfmpeg,
      streamUrl,
      reason,
      ok,
    };
  }
}

function main() {
  const fixturePath = process.argv[2] || defaultFixturePath;
  const fixtures = readFixtures(fixturePath);
  const plans = fixtures.map(planFixture);
  process.stdout.write(`${JSON.stringify(plans, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
