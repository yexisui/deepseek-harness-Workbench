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
    $env:DSH_DESKTOP_DEV_ROOT = $root
    $nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $env:DSH_DESKTOP_NODE = $nodeCommand.Source
    $env:DSH_HOME = Join-Path $root 'dsh-data'
    $env:PATH = (Join-Path $root 'runtime\node_modules\.bin') + ';' + $env:PATH
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Start-Process -FilePath $electronExe -ArgumentList ('"' + $sourceApp + '"') -WorkingDirectory $root -WindowStyle Normal | Out-Null
    Write-Host 'DSH Desktop launched. Its logs are in desktop-state\logs.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
