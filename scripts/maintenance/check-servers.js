const axios = require("axios");
const fs = require("fs");

const servers = require("./servers.json");

const OUTPUT = "servers-status.json";

async function checkServer(server) {
  const started = Date.now();

  try {
    const res = await axios.get(server.url, {
      timeout: 8000,
      validateStatus: () => true
    });

    const html = String(res.data || "").toLowerCase();

    const isIndex =
      html.includes("index of") ||
      html.includes("parent directory") ||
      html.includes("<title>index");

    const latency = Date.now() - started;

    console.log(`✓ ${server.name} | ${res.status} | ${latency}ms`);

    return {
      ...server,
      status: "online",
      statusCode: res.status,
      latency,
      directoryIndex: isIndex,
      checkedAt: new Date().toISOString()
    };
  } catch (err) {
    console.log(`✗ ${server.name} | offline`);

    return {
      ...server,
      status: "offline",
      error: err.message,
      checkedAt: new Date().toISOString()
    };
  }
}

async function main() {
  console.log("[CHECK] Starting server checks...");

  const results = [];

  for (const server of servers) {
    const result = await checkServer(server);
    results.push(result);
  }

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(results, null, 2),
    "utf8"
  );

  const online = results.filter(s => s.status === "online").length;

  console.log(`\n[DONE] ${online}/${results.length} online`);
  console.log(`[SAVED] ${OUTPUT}`);
}

main().catch(console.error);