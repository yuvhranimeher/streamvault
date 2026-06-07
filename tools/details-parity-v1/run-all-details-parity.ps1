$ErrorActionPreference = "Stop"

function Step($msg) {
  Write-Host "`n== $msg ==" -ForegroundColor Cyan
}

Step "Collect Node fixtures"
node "tools\details-parity-v1\collect-node-details-fixtures.js"

Step "Run native Haskell cached details"
cabal exec runghc -- "tools\details-parity-v1\NativeCachedDetails.hs"

Step "Normalize shapes"
node "tools\details-parity-v1\shape-node-details.js"
node "tools\details-parity-v1\shape-haskell-details.js"

Step "Compare parity"
node "tools\details-parity-v1\compare-details-parity.js"

Step "Show fail fields"
node "tools\details-parity-v1\show-fail-fields.js"

Step "Commit"
git add -A "tools\details-parity-v1"
$changes = git status --porcelain -- "tools/details-parity-v1"
if ($changes) {
  git commit -m "Use safer Haskell details cache merge"
  git push
} else {
  Write-Host "No changes to commit."
}




