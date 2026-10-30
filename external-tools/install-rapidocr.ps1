#requires -Version 5.1
[CmdletBinding()]
param([switch]$Check)
$ErrorActionPreference = 'Stop'
$toolRoot = Join-Path $PSScriptRoot 'rapidocr'
$lockPath = Join-Path $PSScriptRoot 'rapidocr-lock.json'
$lock = Get-Content -LiteralPath $lockPath -Raw -Encoding UTF8 | ConvertFrom-Json
$directory = 'rapidocr-' + $lock.rapidocr + '-python-' + $lock.python + '-win-x64'
$release = Join-Path $toolRoot ('releases\' + $directory)
$python = Join-Path $release 'python.exe'
$probe = 'import importlib.metadata as m; import rapidocr,onnxruntime,pypdfium2,openpyxl,pypdf; print(m.version("rapidocr"))'
$ready = Test-Path -LiteralPath $python -PathType Leaf
if ($ready) {
    $result = & $python -B -c $probe 2>$null
    $ready = $LASTEXITCODE -eq 0 -and ($result -join '').Trim() -eq $lock.rapidocr
    if ($ready) { foreach ($model in $lock.models) { $file = Join-Path $release ('models\' + $model.name); if (-not (Test-Path -LiteralPath $file) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $model.sha256) { $ready = $false; break } } }
}
if (-not $ready) {
    if ($Check) { throw 'Document OCR runtime is missing or incomplete. Run workbench Tools or Deploy.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $cache = Join-Path $PSScriptRoot 'downloads'
    New-Item -ItemType Directory -Force -Path $cache | Out-Null
    function Fetch-Verified([string]$name,[string]$url,[string]$sha) {
        $target = Join-Path $cache $name
        if (-not (Test-Path -LiteralPath $target)) {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile ($target + '.partial') -TimeoutSec 300
            if ((Get-FileHash -LiteralPath ($target + '.partial') -Algorithm SHA256).Hash -ne $sha) { throw "Download checksum mismatch: $name" }
            Move-Item -LiteralPath ($target + '.partial') -Destination $target
        }
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $sha) { throw "Runtime cache checksum mismatch: $name" }
        return $target
    }
    $stage = Join-Path $toolRoot ('staging-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    $pythonZip = Fetch-Verified ('python-' + $lock.python + '-embed-amd64.zip') $lock.pythonUrl $lock.pythonArchiveSha256
    [IO.Compression.ZipFile]::ExtractToDirectory($pythonZip,$stage)
    $site = Join-Path $stage 'Lib\site-packages'
    New-Item -ItemType Directory -Force -Path $site | Out-Null
    foreach ($wheel in $lock.wheels) {
        $archive = Fetch-Verified $wheel.name $wheel.url $wheel.sha256
        [IO.Compression.ZipFile]::ExtractToDirectory($archive,$site)
        foreach ($dataDir in $wheel.dataDirectories) {
            foreach ($part in @('purelib','platlib')) {
                $data = Join-Path $site ($dataDir + '\' + $part)
                if (Test-Path -LiteralPath $data) { Get-ChildItem -LiteralPath $data | Copy-Item -Destination $site -Recurse -Force }
            }
        }
    }
    $models = Join-Path $stage 'models'
    New-Item -ItemType Directory -Force -Path $models | Out-Null
    foreach ($model in $lock.models) {
        $from = Join-Path $site $model.wheelPath
        if ((Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash -ne $model.sha256) { throw 'OCR model checksum mismatch.' }
        Copy-Item -LiteralPath $from -Destination (Join-Path $models $model.name)
    }
    [IO.File]::WriteAllText((Join-Path $models 'paths.json'),($lock.modelPaths | ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText((Join-Path $stage 'python312._pth'),"python312.zip`n.`nLib/site-packages`nimport site`n",(New-Object Text.UTF8Encoding($false)))
    Copy-Item -LiteralPath $lockPath -Destination (Join-Path $stage 'runtime-lock.json')
    $result = & (Join-Path $stage 'python.exe') -B -c $probe
    if ($LASTEXITCODE -ne 0 -or ($result -join '').Trim() -ne $lock.rapidocr) { throw 'OCR runtime could not start; previous runtime retained.' }
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
    if ($current.python -ne $relative -or $current.version -ne $lock.rapidocr) { throw 'OCR runtime pointer differs.' }
    Write-Host 'Document OCR runtime present.'
} else {
    $value = [ordered]@{version=$lock.rapidocr;platform='win64';python=$relative;source='https://pypi.org/project/rapidocr/';pythonVersion=$lock.python;models='Bundled PP-OCRv6 ONNX CPU models'}
    $value | ConvertTo-Json | Set-Content -LiteralPath ($pointer + '.tmp') -Encoding UTF8
    Move-Item -LiteralPath ($pointer + '.tmp') -Destination $pointer -Force
    Write-Host 'Document OCR runtime ready; local models installed.'
}
