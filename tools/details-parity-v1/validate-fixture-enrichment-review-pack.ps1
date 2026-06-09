$ErrorActionPreference = "Stop"

$fixturePath = "tools\details-parity-v1\expanded-details-fixture.json"
$reviewPath = "tools\details-parity-v1\out\fixture-enrichment-candidates-8j.json"
$report = "tools\details-parity-v1\DETAILS_8K_FIXTURE_ENRICHMENT_REVIEW_GATE.md"
$targetFields = @("genre","runtime","language","director","productionCompanies")

function GetField($obj, $name) {
  if ($null -eq $obj) { return $null }
  $p = $obj.PSObject.Properties[$name]
  if ($null -eq $p) { return $null }
  return $p.Value
}

function HasValue($value) {
  if ($null -eq $value) { return $false }
  if ($value -is [System.Array]) { return $value.Count -gt 0 }
  $s = [string]$value
  return $s.Trim().Length -gt 0
}

function AsArray($value) {
  if ($null -eq $value) { return @() }
  if ($value -is [System.Array]) { return @($value) }
  return @($value)
}

$fixtureRaw = Get-Content $fixturePath -Raw | ConvertFrom-Json
$reviewRaw = Get-Content $reviewPath -Raw | ConvertFrom-Json
$fixtureRows = @($fixtureRaw)
$reviewRows = @($reviewRaw)

$fieldAllowed = @{}
foreach ($field in $targetFields) { $fieldAllowed[$field] = $true }

$seen = @{}
$fieldCounts = @{}
foreach ($field in $targetFields) { $fieldCounts[$field] = 0 }

$invalidIndex = 0
$duplicateIndex = 0
$invalidMatchedBy = 0
$invalidField = 0
$missingCandidateValue = 0
$alreadyFilledInFixture = 0
$rowsWithNoFill = 0
$validRows = 0
$validSamples = New-Object System.Collections.Generic.List[string]
$badSamples = New-Object System.Collections.Generic.List[string]

for ($i = 0; $i -lt $reviewRows.Count; $i++) {
  $candidate = $reviewRows[$i]
  $ok = $true

  $idxRaw = GetField $candidate "index"
  $title = GetField $candidate "title"
  $matchedKey = GetField $candidate "matchedKey"
  $matchedBy = GetField $candidate "matchedBy"
  $values = GetField $candidate "values"
  $wouldFill = AsArray (GetField $candidate "wouldFill")

  $idx = -1
  if ($null -ne $idxRaw) { $idx = [int]$idxRaw }

  if ($idx -lt 0 -or $idx -ge $fixtureRows.Count) {
    $invalidIndex++
    $ok = $false
  } else {
    $idxKey = [string]$idx
    if ($seen.ContainsKey($idxKey)) {
      $duplicateIndex++
      $ok = $false
    } else {
      $seen[$idxKey] = $true
    }
  }

  if ($matchedBy -ne "poster" -and $matchedBy -ne "backdrop") {
    $invalidMatchedBy++
    $ok = $false
  }

  if ($wouldFill.Count -eq 0) {
    $rowsWithNoFill++
    $ok = $false
  }

  foreach ($fieldRaw in $wouldFill) {
    $field = [string]$fieldRaw
    if (-not $fieldAllowed.ContainsKey($field)) {
      $invalidField++
      $ok = $false
      continue
    }

    $fieldCounts[$field] = $fieldCounts[$field] + 1
    $candidateValue = GetField $values $field
    if (-not (HasValue $candidateValue)) {
      $missingCandidateValue++
      $ok = $false
    }

    if ($idx -ge 0 -and $idx -lt $fixtureRows.Count) {
      $fixtureValue = GetField $fixtureRows[$idx] $field
      if (HasValue $fixtureValue) {
        $alreadyFilledInFixture++
        $ok = $false
      }
    }
  }

  $fieldList = [string]::Join(",", @($wouldFill))
  if ($ok) {
    $validRows++
    if ($validSamples.Count -lt 80) {
      $validSamples.Add("- [$idx] $title => $matchedKey | matchedBy=$matchedBy | fields=$fieldList")
    }
  } else {
    if ($badSamples.Count -lt 40) {
      $badSamples.Add("- reviewRow=$i index=$idx title=$title matchedBy=$matchedBy fields=$fieldList")
    }
  }
}

$gatePass = "no"
if ($invalidIndex -eq 0 -and $duplicateIndex -eq 0 -and $invalidMatchedBy -eq 0 -and $invalidField -eq 0 -and $missingCandidateValue -eq 0 -and $alreadyFilledInFixture -eq 0 -and $rowsWithNoFill -eq 0) {
  $gatePass = "yes"
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("StreamVault Haskell Details 8K Fixture Enrichment Review Gate")
$lines.Add("=============================================================")
$lines.Add("")
$lines.Add("Status:")
$lines.Add("- Task type: review-pack quality gate")
$lines.Add("- Runtime/frontend/playback files changed: no")
$lines.Add("- expanded-details-fixture.json mutated: no")
$lines.Add("")
$lines.Add("Inputs:")
$lines.Add("- fixture: $fixturePath")
$lines.Add("- review pack: $reviewPath")
$lines.Add("")
$lines.Add("Gate result:")
$lines.Add("- pass: $gatePass")
$lines.Add("")
$lines.Add("Counts:")
$lines.Add("- fixture rows: $($fixtureRows.Count)")
$lines.Add("- review candidate rows: $($reviewRows.Count)")
$lines.Add("- valid review rows: $validRows")
$lines.Add("- invalid index rows: $invalidIndex")
$lines.Add("- duplicate index rows: $duplicateIndex")
$lines.Add("- invalid matchedBy rows: $invalidMatchedBy")
$lines.Add("- invalid field entries: $invalidField")
$lines.Add("- missing candidate values: $missingCandidateValue")
$lines.Add("- fields already filled in fixture: $alreadyFilledInFixture")
$lines.Add("- rows with no fill fields: $rowsWithNoFill")
$lines.Add("")
$lines.Add("Field counts:")
foreach ($field in $targetFields) { $lines.Add("- ${field}: $($fieldCounts[$field])") }
$lines.Add("")
$lines.Add("Safety:")
$lines.Add("- This validates the 8J candidate review file only.")
$lines.Add("- It does not overwrite expanded-details-fixture.json.")
$lines.Add("- Next task can prepare guarded apply only if gate pass is yes and samples look correct.")
$lines.Add("")
$lines.Add("Valid sample rows:")
if ($validSamples.Count -gt 0) { foreach ($sample in $validSamples) { $lines.Add($sample) } } else { $lines.Add("- none") }
$lines.Add("")
$lines.Add("Bad sample rows:")
if ($badSamples.Count -gt 0) { foreach ($sample in $badSamples) { $lines.Add($sample) } } else { $lines.Add("- none") }

Set-Content -Encoding UTF8 $report $lines
Get-Content $report
