#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ArchivePath)
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('workbench-tool-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'install.ps1'),(Join-Path $PSScriptRoot 'tools.json') -Destination $testRoot
$manifest = Get-Content -LiteralPath (Join-Path $testRoot 'tools.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$tool = $manifest.tools | Where-Object id -eq 'ffmpeg'
if (-not $tool) { throw 'FFmpeg fixture is required for the audio integration test.' }
if ((Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash -ne $tool.sha256) { throw 'Test archive differs from repository manifest.' }
function Expect-Failure([scriptblock]$Action, [string]$Pattern) {
    try { & $Action } catch {
        if ($_.Exception.Message -notmatch $Pattern) { throw }
        Write-Host "PASS expected failure: $Pattern"
        return
    }
    throw "Expected failure did not occur: $Pattern"
}
$installer = Join-Path $testRoot 'install.ps1'
$before = @(Get-ChildItem -LiteralPath $testRoot -Recurse -File).Count
Expect-Failure { & $installer -Check } 'Missing external tool'
if (@(Get-ChildItem -LiteralPath $testRoot -Recurse -File).Count -ne $before) { throw 'Check wrote files.' }
New-Item -ItemType Directory -Path (Join-Path $testRoot 'downloads') | Out-Null
$cache = Join-Path $testRoot ('downloads\' + $tool.archive)
[IO.File]::WriteAllText($cache, 'deliberately invalid test archive')
Expect-Failure { & $installer } 'checksum differs'
if (Test-Path -LiteralPath (Join-Path $testRoot 'ffmpeg\current.json')) { throw 'Invalid archive published a pointer.' }
Copy-Item -LiteralPath $ArchivePath -Destination $cache -Force
& $installer
Write-Host 'PASS clean installation from verified offline cache'
$pointer = Join-Path $testRoot 'ffmpeg\current.json'
$pointerHash = (Get-FileHash -LiteralPath $pointer).Hash
& $installer -Check
if ((Get-FileHash -LiteralPath $pointer).Hash -ne $pointerHash) { throw 'Check modified pointer.' }
$current = Get-Content -LiteralPath $pointer -Raw -Encoding UTF8 | ConvertFrom-Json
$exe = Join-Path (Join-Path $testRoot 'ffmpeg') $current.ffmpeg
$probe = Join-Path (Join-Path $testRoot 'ffmpeg') $current.ffprobe
$stamp = (Get-Item -LiteralPath $exe).LastWriteTimeUtc
& $installer
if ((Get-Item -LiteralPath $exe).LastWriteTimeUtc -ne $stamp) { throw 'Reuse replaced an existing executable.' }
Write-Host 'PASS existing installation reuse'
$bad = $current | ConvertTo-Json
$bad.Replace($current.version, '0.0.0-invalid') | Set-Content -LiteralPath $pointer -Encoding UTF8
Expect-Failure { & $installer -Check } 'Tool pointer differs'
& $installer
& $installer -Check
$audio = Join-Path $testRoot 'synthetic.wav'
& $exe -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:duration=1' -ac 1 -ar 16000 $audio
if ($LASTEXITCODE -ne 0) { throw 'Synthetic audio generation failed.' }
$duration = & $probe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $audio
if ($LASTEXITCODE -ne 0 -or [double]::Parse($duration, [Globalization.CultureInfo]::InvariantCulture) -lt 0.9) { throw 'Audio duration probe failed.' }
$segment = Join-Path $testRoot 'segment.wav'
& $exe -hide_banner -loglevel error -nostdin -i $audio -ss 0.2 -t 0.5 -vn -ac 1 -ar 16000 -c:a pcm_s16le $segment
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $segment)) { throw 'Audio segmentation failed.' }
Write-Host 'PASS FFmpeg/ffprobe audio generation, probe and segment extraction'
Write-Host "All tool installer checks passed. Isolated evidence retained at: $testRoot"
