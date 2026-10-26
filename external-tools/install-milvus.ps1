#requires -Version 5.1
[CmdletBinding()]
param([switch]$Check)
$ErrorActionPreference = 'Stop'
$toolRoot = Join-Path $PSScriptRoot 'milvus'
$lock = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'milvus-lock.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$directory = 'milvus-' + $lock.'milvus-lite' + '-python-' + $lock.python + '-win-x64'
$release = Join-Path $toolRoot ('releases\' + $directory)
$python = Join-Path $release 'python.exe'
$probe = 'import importlib.metadata as m; import pymilvus,faiss,pyarrow,pypdf; print(m.version("milvus-lite"))'
$ready = Test-Path -LiteralPath $python -PathType Leaf
if ($ready) {
    $result = & $python -B -c $probe 2>$null
    $ready = $LASTEXITCODE -eq 0 -and ($result -join '') -eq $lock.'milvus-lite'
}
if (-not $ready) {
    if ($Check) { throw 'Milvus runtime is missing or incomplete. Run the workbench deployment.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $cache = Join-Path $PSScriptRoot 'downloads'
    New-Item -ItemType Directory -Force -Path $cache | Out-Null
    function Fetch-Verified([string]$name, [string]$url, [string]$sha) {
        $target = Join-Path $cache $name
        if (-not (Test-Path -LiteralPath $target)) {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile ($target + '.partial') -TimeoutSec 300
            if ((Get-FileHash -LiteralPath ($target + '.partial') -Algorithm SHA256).Hash -ne $sha) { throw "Runtime download checksum mismatch: $name" }
            Move-Item -LiteralPath ($target + '.partial') -Destination $target
        }
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $sha) { throw "Runtime cache checksum mismatch: $name" }
        return $target
    }
    $stage = Join-Path $toolRoot ('staging-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    $pythonZip = Fetch-Verified ('python-' + $lock.python + '-embed-amd64.zip') $lock.pythonUrl $lock.pythonArchiveSha256
    [IO.Compression.ZipFile]::ExtractToDirectory($pythonZip, $stage)
    $site = Join-Path $stage 'Lib\site-packages'
    New-Item -ItemType Directory -Force -Path $site | Out-Null
    foreach ($wheel in $lock.wheels) {
        $archive = Fetch-Verified $wheel.name $wheel.url $wheel.sha256
        [IO.Compression.ZipFile]::ExtractToDirectory($archive, $site)
    }
    [IO.File]::WriteAllText((Join-Path $stage 'python312._pth'), "python312.zip`n.`nLib/site-packages`nimport site`n", (New-Object Text.UTF8Encoding($false)))
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'milvus-lock.json') -Destination (Join-Path $stage 'runtime-lock.json')
    $result = & (Join-Path $stage 'python.exe') -B -c $probe
    if ($LASTEXITCODE -ne 0 -or ($result -join '') -ne $lock.'milvus-lite') { throw 'Milvus runtime probe failed. Existing runtime retained.' }
    $fullRoot = [IO.Path]::GetFullPath($toolRoot) + [IO.Path]::DirectorySeparatorChar
    foreach ($targetPath in @($stage,$release)) { if (-not [IO.Path]::GetFullPath($targetPath).StartsWith($fullRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Runtime path is outside tool root.' } }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $release) | Out-Null
    if (Test-Path -LiteralPath $release) { Move-Item -LiteralPath $release -Destination ($release + '.previous-' + [guid]::NewGuid().ToString('N')) }
    Move-Item -LiteralPath $stage -Destination $release
}
$pointer = Join-Path $toolRoot 'current.json'
$relative = 'releases/' + $directory + '/python.exe'
if ($Check) {
    $current = Get-Content -LiteralPath $pointer -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($current.python -ne $relative -or $current.version -ne $lock.'milvus-lite') { throw 'Milvus runtime pointer differs.' }
    Write-Host 'Milvus runtime checked (read-only).'
} else {
    $value = [ordered]@{version=$lock.'milvus-lite';platform='win64';python=$relative;source='https://pypi.org/project/milvus-lite/';pythonVersion=$lock.python}
    $value | ConvertTo-Json | Set-Content -LiteralPath ($pointer + '.tmp') -Encoding UTF8
    Move-Item -LiteralPath ($pointer + '.tmp') -Destination $pointer -Force
    Write-Host 'Milvus runtime ready; no local embedding model is installed.'
}
