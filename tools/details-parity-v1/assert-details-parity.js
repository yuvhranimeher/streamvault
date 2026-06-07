const fs = require("fs");
const path = require("path");

const shape = fs.readFileSync(path.join(__dirname, "out", "details-parity-report.md"), "utf8");
const native = fs.readFileSync(path.join(__dirname, "out", "native-value-gap-report.md"), "utf8");

function getFail(text) {
  const m = text.match(/FAIL=(\d+)/) || text.match(/FAIL:\s*(\d+)/);
  return m ? Number(m[1]) : 999;
}

const shapeFail = getFail(shape);
const nativeFail = getFail(native);

console.log(`shape FAIL=${shapeFail}`);
console.log(`native FAIL=${nativeFail}`);

if (shapeFail !== 0 || nativeFail !== 0) {
  console.error("Details parity regression detected");
  process.exit(1);
}

console.log("Details parity locked: PASS");
