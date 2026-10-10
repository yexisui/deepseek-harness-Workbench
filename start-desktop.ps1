$ErrorActionPreference = 'Stop'
try {
    $root = $PSScriptRoot
    $electronExe = Join-Path $root 'runtime-desktop\node_modules\electron\dist\electron.exe'
    $sourceApp = Join-Path $root 'deepseek_harness_desktop\desktop'
    $hostEntry = Join-Path $root 'runtime\node_modules\@deepseek-ai\dsh\lib\bin.js'
    $profileFile = Join-Path $root 'dsh-data\profiles\web\package.json'
    foreach ($required in @($electronExe, (Join-Path $sourceApp 'src\main.cjs'), $hostEntry, $profileFile)) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            throw "Required file is missing: $required"
        }
    }
    $capabilityLock = Join-Path $root 'dsh-data\capabilities\writer.lock'
    if (Test-Path -LiteralPath $capabilityLock -PathType Leaf) {
        try {
            $savedLock = Get-Content -LiteralPath $capabilityLock -Raw
            $lockRecord = $savedLock | ConvertFrom-Json
            $lockPid = [int]$lockRecord.pid
            $timeMatch = [regex]::Match($savedLock, '"startedAt"\s*:\s*"([^"]+)"')
            if (-not $timeMatch.Success) { throw 'Capability lock has no start timestamp.' }
            $lockTime = [DateTimeOffset]::Parse($timeMatch.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).UtcDateTime
            if ($lockPid -gt 0) {
                $owner = $null
                $isStale = $false
                try {
                    $owner = Get-Process -Id $lockPid -ErrorAction Stop
                } catch {
                    if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId*') { $isStale = $true }
                    else { throw }
                }
                if ($null -ne $owner) {
                    $isStale = $owner.StartTime.ToUniversalTime() -gt $lockTime.AddSeconds(5)
                }
                if ($isStale -and (Get-Content -LiteralPath $capabilityLock -Raw) -eq $savedLock) {
                    Remove-Item -LiteralPath $capabilityLock -Force
                    Write-Host "Removed a stale capability lock from PID $lockPid."
                }
            }
        } catch {
            Write-Warning "Could not verify capability lock; leaving it in place: $($_.Exception.Message)"
        }
    }
    $env:DSH_DESKTOP_DEV_ROOT = $root
    $localNode = Join-Path $root 'runtime-node\node.exe'
    if (Test-Path -LiteralPath $localNode -PathType Leaf) {
        $env:DSH_DESKTOP_NODE = $localNode
        $env:PATH = (Split-Path -Parent $localNode) + ';' + $env:PATH
    } else {
        $nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
        $env:DSH_DESKTOP_NODE = $nodeCommand.Source
    }
    $env:DSH_HOME = Join-Path $root 'dsh-data'
    $env:PATH = (Join-Path $root 'runtime\node_modules\.bin') + ';' + $env:PATH
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Start-Process -FilePath $electronExe -ArgumentList ('"' + $sourceApp + '"') -WorkingDirectory $root -WindowStyle Normal | Out-Null
    Write-Host 'DSH Desktop launched. Its logs are in desktop-state\logs.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
