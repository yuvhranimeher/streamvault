const fs = require("fs");
const path = require("path");

const baseDir = __dirname;
const outDir = path.join(baseDir, "out");
const reportPath = path.join(baseDir, "DETAILS_7R_SHADOW_OUTPUT_SUMMARY.md");

function markerValue(text, key) {
const escaped = key.replace(/[.*+?^${}()|[]\]/g, "\$&");
const match = text.match(new RegExp("^" + escaped + "=(.*)$", "m"));
return match ? match[1].trim() : "unknown";
}

function count(lines, re) {
return lines.filter(line => re.test(line)).length;
}

const files = fs.existsSync(outDir)
? fs.readdirSync(outDir)
.filter(name => /^details-shadow-all-safe-\d{8}-\d{6}.txt$/.test(name))
.map(name => ({
name,
full: path.join(outDir, name),
mtime: fs.statSync(path.join(outDir, name)).mtimeMs
}))
.sort((a, b) => b.mtime - a.mtime)
: [];

if (!files.length) {
throw new Error("No safe shadow output found in " + outDir);
}

const latest = files[0];
const text = fs.readFileSync(latest.full, "utf8");
const lines = text.split(/\r?\n/);

const interesting = lines
.filter(line => /(EXIT_CODE=|SCHEMA_|SUITE_|PASS=|FAIL=|BAD=|mismatch|MISMATCH|error|Error|ERROR)/.test(line))
.slice(-80);

# const md = `StreamVault Haskell Details 7R Shadow Output Summary

Status:

* Task type: report-only analyzer
* Runtime/frontend/playback files changed: no

Source:

* ${latest.name}

Summary:

* EXIT_CODE=${markerValue(text, "EXIT_CODE")}
* SCHEMA_TOTAL=${markerValue(text, "SCHEMA_TOTAL")}
* SCHEMA_BAD=${markerValue(text, "SCHEMA_BAD")}
* SUITE_PASS markers=${count(lines, /^SUITE_PASS\b/)}
* PASS markers=${count(lines, /\bPASS\b|_PASS\b/)}
* FAIL markers=${count(lines, /\bFAIL\b|_FAIL\b/)}
* BAD markers=${count(lines, /\bBAD\b|_BAD\b/)}
* mismatch markers=${count(lines, /mismatch|MISMATCH/)}
* error markers=${count(lines, /\berror\b|\bError\b|\bERROR\b/)}

Interpretation:

* EXIT_CODE=0 means the PowerShell-safe details shadow runner completed successfully.
* SCHEMA_BAD can be expected when schema-negative fixtures intentionally test rejection behavior.
* Next parity work should target real mismatch/fail markers, not expected negative-test stderr.

Recent interesting lines:
${interesting.map(line => "- " + line).join("\n")}
`;

fs.writeFileSync(reportPath, md, "utf8");
console.log(md);
