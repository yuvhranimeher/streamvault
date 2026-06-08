const { spawnSync } = require("child_process");
const http = require("http");

function waitFor(path, port, label, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tick() {
      const req = http.get({ hostname: "127.0.0.1", port, path, timeout: 2000 }, res => {
        res.resume();
        resolve();
      });
      req.on("timeout", () => req.destroy());
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`${label} not reachable on ${port}`));
        else setTimeout(tick, 500);
      });
    }
    tick();
  });
}

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status || 1);
}

(async () => {
  await waitFor("/", 3000, "Node server");
  await waitFor("/api/details-shadow/ping", 3033, "Native details shadow");

  run("node", ["tools/details-parity-v1/test-native-details-shadow.js"]);
  run("node", ["tools/details-parity-v1/test-expanded-native-details-shadow.js"]);
  run("node", ["tools/details-parity-v1/compare-http-details-shadow.js"]);

  console.log("\nDETAILS_SHADOW_SUITE_PASS");
})();