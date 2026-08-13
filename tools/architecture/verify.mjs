import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const failures = [];
const generatedDirectories = new Set(["_build", "deps", "doc"]);

const required = [
  "platform/mix.exs",
  "platform/apps/streamvault_core/mix.exs",
  "platform/apps/streamvault_catalog/mix.exs",
  "platform/apps/streamvault_playback/mix.exs",
  "platform/apps/streamvault_edge/mix.exs",
  "services/media-planner/streamvault-media-planner.cabal",
  "contracts/openapi.yaml",
  "contracts/playback-plan.schema.json",
  "compose.platform.yaml"
];

for (const path of required) {
  if (!existsSync(join(root, path))) failures.push(`missing required file: ${path}`);
}

for (const path of walk(join(root, "platform"))) {
  if ([".html", ".css", ".js", ".jsx", ".ts", ".tsx"].includes(extname(path))) {
    failures.push(`API-only platform contains browser source: ${relative(root, path)}`);
  }
}

const schema = JSON.parse(readFileSync(join(root, "contracts/playback-plan.schema.json"), "utf8"));
if (!schema.required.includes("strategy") || schema.properties.strategy.enum.length !== 4) {
  failures.push("playback schema must define all four planner strategies");
}

const openapi = readFileSync(join(root, "contracts/openapi.yaml"), "utf8");
const router = readFileSync(join(root, "platform/apps/streamvault_edge/lib/streamvault/edge/router.ex"), "utf8");
const documentedPaths = [...openapi.matchAll(/^  (\/[^:]+):$/gm)].map((match) => match[1]);
const routedPaths = [...router.matchAll(/(?:get|post|patch|delete)\(\s*"([^"]+)"/g)].map((match) => match[1]);

if (routedPaths.length === 0) failures.push("no Phoenix routes discovered");

for (const path of routedPaths) {
  const normalized = path.replace(/:([a-zA-Z_]+)/g, "{$1}");
  if (!documentedPaths.includes(normalized) && !path.startsWith("/api/admin/") && path !== "/api/playback/sessions") {
    failures.push(`route missing from OpenAPI: ${path}`);
  }
}

const cabalProject = readFileSync(join(root, "cabal.project"), "utf8");
if (!cabalProject.includes("services/media-planner")) failures.push("cabal.project does not include media-planner");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Architecture verified: ${required.length} required artifacts, ${routedPaths.length} Phoenix routes, ${documentedPaths.length} documented paths.`);

function* walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (!generatedDirectories.has(name)) yield* walk(path);
      continue;
    }
    yield path;
  }
}
