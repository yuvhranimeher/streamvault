$ErrorActionPreference = "Stop"

function Step($msg){ Write-Host "`n== $msg ==" -ForegroundColor Cyan }

Step "Collect Node fixtures"
node "tools\details-parity-v1\collect-node-details-fixtures.js"

Step "Run Cabal Haskell details generator"
cabal run details-parity-native

Step "Normalize + compare"
node "tools\details-parity-v1\shape-node-details.js"
node "tools\details-parity-v1\shape-haskell-details.js"
node "tools\details-parity-v1\compare-details-parity.js"
node "tools\details-parity-v1\show-fail-fields.js"

Step "Commit"
git add -A "tools\details-parity-v1" "*.cabal"
$changes = git status --porcelain
if ($changes) {
  git commit -m "Add Cabal executable for details parity generator"
  git push
} else {
  Write-Host "No changes to commit."
}
