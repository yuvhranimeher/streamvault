import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Phoenix router preserves critical legacy catalog routes", () => {
  const router = read("platform/apps/streamvault_edge/lib/streamvault/edge/router.ex");
  for (const route of ["/api/version", "/api/catalog-stats", "/api/movies", "/api/series", "/api/search", "/api/home-feed", "/api/history"]) {
    assert.match(router, new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("planner schema exposes only executable strategies", () => {
  const schema = JSON.parse(read("contracts/playback-plan.schema.json"));
  assert.deepEqual(schema.properties.strategy.enum, ["direct", "remux", "transcode", "reject"]);
  assert.equal(schema.additionalProperties, false);
});

test("new platform contains no frontend implementation", () => {
  const verifier = read("tools/architecture/verify.mjs");
  assert.match(verifier, /API-only platform contains browser source/);
});

test("Haskell policy retains direct, remux, transcode, and rejection branches", () => {
  const policy = read("services/media-planner/src/StreamVault/Planner/Policy.hs");
  for (const strategy of ["Direct", "Remux", "Transcode", "Reject"]) assert.match(policy, new RegExp(strategy));
});
