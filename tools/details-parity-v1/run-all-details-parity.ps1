$ErrorActionPreference = "Stop"

function Step($msg) {
  Write-Host "
== $msg ==" -ForegroundColor Cyan
}

Step "Checkout"
git checkout haskell-readonly-metadata-apis
git pull

Step "Collect Node fixtures"
node "tools\details-parity-v1\collect-node-details-fixtures.js"

Step "Shape Node details"
node "tools\details-parity-v1\shape-node-details.js"

Step "Compare parity"
node "tools\details-parity-v1\compare-details-parity.js"

Step "Commit"
git add -A "tools\details-parity-v1"

$changes = git status --porcelain -- "tools/details-parity-v1"
if ($changes) {
  git commit -m "Run details TMDB parity suite"
  git push
} else {
  Write-Host "No changes to commit."
}

Step "Done"
git status --short
