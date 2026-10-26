#requires -Version 5.1
[CmdletBinding()]
param([switch]$Check, [string[]]$Only, [switch]$SkipService)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if ([Environment]::OSVersion.Platform -ne 'Win32NT' -or -not [Environment]::Is64BitOperatingSystem) { throw 'External tools require Windows x64.' }
$manifest = Get-Content -LiteralPath (Join-Path $root 'tools.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $manifest.tools) {
    $tool = $entry
    if ($PSBoundParameters.ContainsKey('Only') -and $tool.id -notin $PSBoundParameters['Only']) { continue }
    if ($tool.runtimeManifest) { & (Join-Path $root 'install-milvus.ps1') -Check:$Check; continue }
    $toolRoot = Join-Path $root $tool.id
    $release = Join-Path $toolRoot ('releases\' + $tool.directory)
    $ready = $true
    foreach ($exe in $tool.executables.PSObject.Properties) {
        if (-not (Test-Path -LiteralPath (Join-Path $release $exe.Value) -PathType Leaf)) { $ready = $false }
    }
    if (-not $ready) {
        if ($Check) { throw "Missing external tool: $($tool.id). Run deploy.ps1 -Mode Tools." }
        $cache = Join-Path $root 'downloads'
        New-Item -ItemType Directory -Force -Path $cache | Out-Null
        $zip = Join-Path $cache $tool.archive
        if (-not (Test-Path -LiteralPath $zip)) {
            Write-Host "Downloading $($tool.id) $($tool.version)..."
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -UseBasicParsing -Uri $tool.url -OutFile ($zip + '.partial') -TimeoutSec 300
            if ((Get-FileHash -LiteralPath ($zip + '.partial') -Algorithm SHA256).Hash -ne $tool.sha256) { throw 'Downloaded archive checksum differs; existing installation retained.' }
            Move-Item -LiteralPath ($zip + '.partial') -Destination $zip
        }
        if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $tool.sha256) { throw "Cached archive checksum differs: $zip" }
        $stage = Join-Path $toolRoot ('staging-' + [guid]::NewGuid().ToString('N'))
        Expand-Archive -LiteralPath $zip -DestinationPath $stage
        $unpacked = if ($tool.flatArchive) { $stage } else { Join-Path $stage $tool.directory }
        foreach ($exe in $tool.executables.PSObject.Properties) {
            if (-not (Test-Path -LiteralPath (Join-Path $unpacked $exe.Value))) { throw "Archive is missing $($exe.Name)." }
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $release) | Out-Null
        # Keep an incomplete previous installation instead of deleting it.
        $resolvedRelease = [IO.Path]::GetFullPath($release)
        if (-not $resolvedRelease.StartsWith(([IO.Path]::GetFullPath($toolRoot) + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) { throw 'Tool release is outside installation root.' }
        if (Test-Path -LiteralPath $release) {
            Move-Item -LiteralPath $release -Destination ($release + '.previous-' + [guid]::NewGuid().ToString('N'))
        }
        $resolvedStage = [IO.Path]::GetFullPath($unpacked)
        if (-not $resolvedStage.StartsWith(([IO.Path]::GetFullPath($toolRoot) + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) { throw 'Tool stage is outside installation root.' }
        Move-Item -LiteralPath $unpacked -Destination $release
    }
    foreach ($exe in $tool.executables.PSObject.Properties) {
        if ($tool.fileVersion) {
            $version = (Get-Item -LiteralPath (Join-Path $release $exe.Value)).VersionInfo.FileVersion
            if ($version -ne $tool.version) { throw "Unexpected $($exe.Name) file version: $version" }
        } else {
            $versionArgument = if ($tool.versionArgument) { $tool.versionArgument } else { '-version' }
            $output = & (Join-Path $release $exe.Value) $versionArgument
            if ($LASTEXITCODE -ne 0 -or ($output -join "`n") -notmatch ([regex]::Escape($tool.version))) { throw "Cannot start the expected $($exe.Name) version." }
        }
    }
    if ($tool.licenseFile) {
        $licenseSource = Join-Path $root $tool.licenseFile
        $licenseTarget = Join-Path $release 'LICENSE.txt'
        if ($Check) { if (-not (Test-Path -LiteralPath $licenseTarget)) { throw "Missing license: $($tool.id)" } }
        else { Copy-Item -LiteralPath $licenseSource -Destination $licenseTarget -Force }
    }
    $current = [ordered]@{ version=$tool.version; platform='win64'; source=$tool.url; sha256=$tool.sha256 }
    foreach ($exe in $tool.executables.PSObject.Properties) { $current[$exe.Name] = 'releases/' + $tool.directory + '/' + $exe.Value.Replace('\','/') }
    $pointer = Join-Path $toolRoot 'current.json'
    if ($Check) {
        if (-not (Test-Path -LiteralPath $pointer -PathType Leaf)) { throw "Missing tool pointer: $($tool.id). Run deploy.ps1 -Mode Tools." }
        $installed = Get-Content -LiteralPath $pointer -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($key in $current.Keys) {
            if ($installed.$key -ne $current[$key]) { throw "Tool pointer differs for $($tool.id): $key. Run deploy.ps1 -Mode Tools." }
        }
        Write-Host "$($tool.id) $($tool.version) checked (no download or configuration changes)."
        continue
    }
    $temporary = $pointer + '.tmp'
    $current | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $pointer -Force
    Write-Host "$($tool.id) $($tool.version) ready (local installation reused when present)."
}

if (-not $SkipService -and (-not $Only -or 'everything' -in $Only)) { & (Join-Path $root 'search-service.ps1') -Check:$Check }
