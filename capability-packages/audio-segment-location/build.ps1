#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$delivery = Join-Path $root 'dist\delivery'
New-Item -ItemType Directory -Force -Path "$delivery\runtime","$delivery\docs","$root\history" | Out-Null
Copy-Item -LiteralPath "$root\src\main.cjs" -Destination "$delivery\runtime\main.cjs" -Force
Copy-Item -LiteralPath "$root\docs\README.txt" -Destination "$delivery\docs\README.txt" -Force
$manifest = Get-Content "$root\capability.json" -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $manifest.files.PSObject.Properties) { $entry.Value = (Get-FileHash -LiteralPath (Join-Path $delivery $entry.Name) -Algorithm SHA256).Hash.ToLowerInvariant() }
[IO.File]::WriteAllText("$delivery\capability.json", ($manifest | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
$zip = Join-Path $root 'dist\audio-segment-location-latest.zip'
if (Test-Path -LiteralPath $zip) { Copy-Item -LiteralPath $zip -Destination "$root\history\audio-segment-location-previous-$([DateTime]::Now.ToString('yyyyMMdd-HHmmssfff')).zip" }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [IO.File]::Open($zip, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in Get-ChildItem -LiteralPath $delivery -Recurse -File) {
    $relative = $file.FullName.Substring($delivery.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative) | Out-Null
  }
} finally { $archive.Dispose(); $stream.Dispose() }
Copy-Item -LiteralPath $zip -Destination "$root\history\audio-segment-location-$($manifest.version).zip" -Force
Write-Host "Built: $zip"
