$ErrorActionPreference = "Stop"

function Step($msg){ Write-Host "`n== $msg ==" -ForegroundColor Cyan }

Step "Collect Node fixtures"
node "tools\details-parity-v1\collect-node-details-fixtures.js"

Step "Make Haskell placeholder fixtures"
node "tools\details-parity-v1\make-haskell-placeholder-fixtures.js"

Step "Normalize + compare"
node "tools\details-parity-v1\shape-node-details.js"
node "tools\details-parity-v1\shape-haskell-details.js"
node "tools\details-parity-v1\compare-details-parity.js"
node "tools\details-parity-v1\show-fail-fields.js"

Step "Commit"
git add -A "tools\details-parity-v1"
$changes = git status --porcelain -- "tools/details-parity-v1"
if ($changes) {
  git commit -m "Add stable details parity placeholder generator"
  git push
} else {
  Write-Host "No changes to commit."
}
