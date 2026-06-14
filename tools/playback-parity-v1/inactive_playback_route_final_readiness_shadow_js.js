#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const defaultFixturePath = path.join(
  root,
  "tools",
  "playback-parity-v1",
  "inactive-playback-route-final-readiness-fixtures.json"
);

function readFixtures(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Final readiness fixture manifest must contain a JSON array");
  }
  return parsed;
}

function readinessSummary(fixtures) {
  const components = fixtures.map(normalizeComponent);
  return {
    contractId: "inactive-playback-route-final-readiness-v1",
    mode: "read-only shadow-only inactive playback route readiness",
    readinessDecision: "ready-when-all-required-gates-pass",
    componentCount: components.length,
    requiredComponents: components,
    requiredPassCriteria: components.map((component) => `${component.displayName} ${component.requiredStatus}`),
    safety: {
      serverStarted: false,
      networkCalled: false,
      ffmpegStarted: false,
      runtimePlaybackChanged: false,
      activeRoutesAdded: false,
      inactiveRouteWired: false,
      frontendPlaybackChanged: false,
      liveUrlActivated: false,
      fixturesRequireExampleTestOrLocalOnly: true,
    },
  };
}

function normalizeComponent(fixture) {
  return {
    component: String(fixture.component || ""),
    displayName: String(fixture.displayName || ""),
    requiredStatus: String(fixture.requiredStatus || "PASS"),
    parityGate: String(fixture.parityGate || ""),
    envelopeGate: String(fixture.envelopeGate || ""),
    fixtureGate: String(fixture.fixtureGate || ""),
    safetyGate: String(fixture.safetyGate || ""),
    fixtureFile: String(fixture.fixtureFile || ""),
    contractFile: String(fixture.contractFile || ""),
    fixtureSafety: String(fixture.fixtureSafety || ""),
    readinessContribution: "required",
  };
}

function main() {
  const fixturePath = process.argv[2] || defaultFixturePath;
  const fixtures = readFixtures(fixturePath);
  process.stdout.write(`${JSON.stringify(readinessSummary(fixtures), null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
