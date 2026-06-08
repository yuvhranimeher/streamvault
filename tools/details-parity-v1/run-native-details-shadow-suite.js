const { spawn, spawnSync } = require("child_process");
const http = require("http");

const started = [];

function reachable(path, port, timeoutMs = 2000) {
  return new Promise(resolve => {
    const req = http.get({ hostname: "127.0.0.1", port, path, timeout: timeoutMs }, res => {
      res.resume();
      resolve(true);
    });
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
  });
}

function waitFor(path, port, label, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    async function tick() {
      if (await reachable(path, port)) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`${label} not reachable on ${port}`));
      setTimeout(tick, 750);
    }
    tick();
  });
}

function start(label, cmd, args) {
  console.log(`Starting ${label}: ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    stdio: "ignore",
    shell: process.platform === "win32"
  });
  started.push({ label, child });
  return child;
}

async function ensure(label, port, path, cmd, args, timeoutMs) {
  if (await reachable(path, port)) {
    console.log(`${label} already running on ${port}`);
    return;
  }
  start(label, cmd, args);
  await waitFor(path, port, label, timeoutMs);
  console.log(`${label} ready on ${port}`);
}

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status || 1);
}

function killStarted() {
  for (const { label, child } of started.reverse()) {
    if (!child || !child.pid) continue;
    console.log(`Stopping ${label}`);
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try { process.kill(-child.pid, "SIGTERM"); } catch {}
      try { child.kill("SIGTERM"); } catch {}
    }
  }
}

(async () => {
  try {
    await ensure("Node server", 3000, "/", "node", ["server.js"], 30000);
    await ensure("Native details shadow", 3033, "/api/details-shadow/ping", "cabal", ["run", "details-shadow-native"], 90000);

    run("node", ["tools/details-parity-v1/test-native-details-shadow.js"]);
    run("node", ["tools/details-parity-v1/test-expanded-native-details-shadow.js"]);
    run("node", ["tools/details-parity-v1/compare-http-details-shadow.js"]);

    console.log("\nDETAILS_SHADOW_SUITE_PASS");
  } finally {
    killStarted();
  }
})().catch(err => {
  console.error(err.message || err);
  killStarted();
  process.exit(1);
});