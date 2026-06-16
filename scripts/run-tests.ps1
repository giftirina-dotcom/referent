# Automated TEST-PLAN runner (ASCII-only script; UTF-8 output files)
$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
$base = "http://localhost:3000"
$results = @()
$wikiUrl = "https://en.wikipedia.org/wiki/Artificial_intelligence"

function Add-Result($Id, $Name, $Pass, $Detail) {
    $script:results += [PSCustomObject]@{
        Id     = $Id
        Name   = $Name
        Pass   = $Pass
        Detail = $Detail
    }
}

function Invoke-Api($Path, $Body, $TimeoutSec = 60) {
    $json = if ($Body) { $Body | ConvertTo-Json -Compress -Depth 6 } else { "{}" }
    try {
        $response = Invoke-WebRequest -Uri "$base$Path" -Method POST -Body $json `
            -ContentType "application/json; charset=utf-8" -UseBasicParsing -TimeoutSec $TimeoutSec
        return @{ Ok = $true; Status = $response.StatusCode; Body = $response.Content | ConvertFrom-Json; Raw = $response.Content }
    } catch {
        $status = $null
        $raw = ""
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $raw = $reader.ReadToEnd()
        }
        $body = $null
        try { $body = $raw | ConvertFrom-Json } catch {}
        return @{ Ok = $false; Status = $status; Body = $body; Raw = $raw }
    }
}

Write-Host "=== T-01 build ==="
Push-Location $root
$buildOut = pnpm.cmd run build 2>&1 | Out-String
$buildOk = $LASTEXITCODE -eq 0
Add-Result "T-01" "pnpm run build" $buildOk $(if ($buildOk) { "OK" } else { "exit $LASTEXITCODE" })
Pop-Location

Write-Host "=== T-02 T-03 availability ==="
try {
    $page = Invoke-WebRequest -Uri $base -UseBasicParsing -TimeoutSec 15
    Add-Result "T-02" "GET /" ($page.StatusCode -eq 200) "Status $($page.StatusCode)"
    if ($page.Content -match 'href="([^"]*layout\.css[^"]*)"') {
        $css = Invoke-WebRequest -Uri "$base$($matches[1])" -UseBasicParsing -TimeoutSec 15
        $hasTailwind = $css.Content -match 'bg-red-500'
        Add-Result "T-03" "CSS layout.css" (($css.StatusCode -eq 200) -and $hasTailwind) "Status $($css.StatusCode), tailwind=$hasTailwind"
    } else {
        Add-Result "T-03" "CSS layout.css" $false "CSS link not found"
    }
} catch {
    Add-Result "T-02" "GET /" $false $_.Exception.Message
    Add-Result "T-03" "CSS layout.css" $false "skipped"
}

Write-Host "=== T-10..T-15 parse ==="
$r = Invoke-Api "/api/parse" @{ url = "" }
Add-Result "T-10" "Parse empty URL" ((-not $r.Ok) -and ($r.Status -eq 400)) "Status $($r.Status)"

$r = Invoke-Api "/api/parse" @{ url = "not-a-url" }
Add-Result "T-11" "Parse invalid URL" ((-not $r.Ok) -and ($r.Status -eq 400)) "Status $($r.Status)"

$r = Invoke-Api "/api/parse" @{ url = "ftp://example.com/x" }
Add-Result "T-12" "Parse ftp rejected" ((-not $r.Ok) -and ($r.Status -eq 400)) "Status $($r.Status)"

$r = Invoke-Api "/api/parse" @{ url = $wikiUrl } 120
$parseOk = $r.Ok -and $r.Body.content -and $r.Body.title
Add-Result "T-13" "Parse Wikipedia" $parseOk "title=$($r.Body.title.Length), content=$($r.Body.content.Length)"
$article = $r.Body

$r = Invoke-Api "/api/parse" @{ url = "https://httpbin.org/status/403" } 90
Add-Result "T-14" "Parse 403 unavailable" ((-not $r.Ok) -and ($r.Status -eq 422) -and ($r.Body.code -eq "unavailable")) "Status $($r.Status), code=$($r.Body.code)"

Write-Host "=== T-20..T-25 translate ==="
$r = Invoke-Api "/api/translate" @{ action = "summary" }
Add-Result "T-20" "Translate no article" ((-not $r.Ok) -and ($r.Status -eq 400)) "Status $($r.Status)"

$r = Invoke-Api "/api/translate" @{ article = $article; action = "invalid" }
Add-Result "T-21" "Translate bad action" ((-not $r.Ok) -and ($r.Status -eq 400)) "Status $($r.Status)"

$translateResult = $null
$summaryResult = $null
$thesesResult = $null
$telegramResult = $null

foreach ($pair in @(
        @{ Id = "T-22"; Action = "translate"; Timeout = 180 },
        @{ Id = "T-23"; Action = "summary"; Timeout = 180 },
        @{ Id = "T-24"; Action = "theses"; Timeout = 180 },
        @{ Id = "T-25"; Action = "telegram"; Timeout = 180 }
    )) {
    $req = @{ article = $article; action = $pair.Action }
    if ($pair.Action -eq "telegram") { $req.sourceUrl = $wikiUrl }
    $r = Invoke-Api "/api/translate" $req $pair.Timeout
    $text = $r.Body.result
    switch ($pair.Action) {
        "translate" { $script:translateResult = $text }
        "summary" { $script:summaryResult = $text }
        "theses" { $script:thesesResult = $text }
        "telegram" { $script:telegramResult = $text }
    }
    Add-Result $pair.Id "Translate $($pair.Action)" ($r.Ok -and $text) "Status $($r.Status), len=$($text.Length)"
}

Write-Host "=== T-30..T-33 format ==="
if ($translateResult -and $summaryResult) {
    Add-Result "T-30" "Summary shorter than translate" ($summaryResult.Length -lt $translateResult.Length) "summary=$($summaryResult.Length), translate=$($translateResult.Length)"
} else {
    Add-Result "T-30" "Summary shorter than translate" $false "missing results"
}

if ($thesesResult) {
    $bullets = ([regex]::Matches($thesesResult, '(?m)^\s*[-*]')).Count
    $h2Count = ([regex]::Matches($thesesResult, '(?m)^##\s')).Count
    Add-Result "T-31" "Theses list" (($h2Count -ge 1) -and ($bullets -ge 3)) "h2=$h2Count, bullets=$bullets"
} else {
    Add-Result "T-31" "Theses list" $false "missing result"
}

if ($telegramResult) {
    $hasSource = $telegramResult -match [regex]::Escape($wikiUrl)
    $hasBold = $telegramResult -match '\*\*'
    Add-Result "T-32" "Telegram post format" ($hasSource -and $hasBold -and ($telegramResult.Length -le 1500)) "source=$hasSource, bold=$hasBold, len=$($telegramResult.Length)"
} else {
    Add-Result "T-32" "Telegram post format" $false "missing result"
}

if ($translateResult) {
    $hasH1 = $translateResult -match '(?m)^#\s+'
    Add-Result "T-33" "Translate markdown" $hasH1 "hasH1=$hasH1, len=$($translateResult.Length)"
} else {
    Add-Result "T-33" "Translate markdown" $false "missing result"
}

Write-Host "=== T-50 T-51 ==="
$r = Invoke-Api "/api/process" @{ url = $wikiUrl; action = "summary" }
Add-Result "T-50" "Process legacy 501" ((-not $r.Ok) -and ($r.Status -eq 501)) "Status $($r.Status)"

$envIgnored = [bool](git -C $root check-ignore -v .env.local 2>$null)
$envTracked = [bool](git -C $root ls-files .env.local 2>$null)
Add-Result "T-51" ".env.local gitignored" ($envIgnored -and -not $envTracked) "ignored=$envIgnored"

$samplePath = Join-Path $root ".test-samples.md"
@(
    "# AI response samples",
    "",
    "## summary",
    $summaryResult,
    "",
    "## theses",
    $thesesResult,
    "",
    "## telegram",
    $telegramResult
) | Out-File -FilePath $samplePath -Encoding utf8

$passed = @($results | Where-Object { $_.Pass }).Count
$total = $results.Count
Write-Host ""
Write-Host "=== SUMMARY: $passed / $total passed ==="
$results | Format-Table -AutoSize

$mdPath = Join-Path $root "TEST-RESULTS.md"
$date = Get-Date -Format "yyyy-MM-dd HH:mm"
$lines = New-Object System.Collections.Generic.List[string]
[void]$lines.Add("# Test results")
[void]$lines.Add("")
[void]$lines.Add("Date: $date")
[void]$lines.Add("Total: $passed / $total passed")
[void]$lines.Add("")
[void]$lines.Add("| ID | Test | Status | Details |")
[void]$lines.Add("|----|------|--------|---------|")
foreach ($r in $results) {
    $status = if ($r.Pass) { "PASS" } else { "FAIL" }
    $detail = ($r.Detail -replace '\|', '/')
    [void]$lines.Add("| $($r.Id) | $($r.Name) | $status | $detail |")
}
[void]$lines.Add("")
[void]$lines.Add("Samples: [.test-samples.md](./.test-samples.md)")
$lines -join [Environment]::NewLine | Out-File -FilePath $mdPath -Encoding utf8

Write-Host "Written: TEST-RESULTS.md"
if ($passed -lt $total) { exit 1 }
