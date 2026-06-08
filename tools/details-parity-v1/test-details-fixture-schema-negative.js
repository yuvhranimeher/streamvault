const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sv-details-schema-negative-"));
const badFixture = path.join(dir, "bad-fixture.json");

fs.writeFileSync(badFixture, JSON.stringify([
  { key: "", status: "hit", type: "movie", title: "", year: "" }
], null, 2));

const validator = path.join("tools", "details-parity-v1", "validate-details-fixture-schema.js");
const result = spawnSync(process.execPath, [validator, badFixture], {
  encoding: "utf8"
});

process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");

if (result.status === 0) {
  console.error("NEGATIVE_SCHEMA_FAIL: bad fixture unexpectedly passed");
  process.exit(1);
}

console.log("NEGATIVE_SCHEMA_PASS");
