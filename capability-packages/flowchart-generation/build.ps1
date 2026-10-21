#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
# The portable capability carries a generated copy of the same renderer bundled by the host.
$rendererSource = Join-Path $root '../../deepseek_harness_desktop/shared/flowchart/renderer.cjs'
Copy-Item -LiteralPath $rendererSource -Destination (Join-Path $root 'runtime/renderer.cjs')
$manifest = Get-Content -LiteralPath (Join-Path $root 'capability.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $manifest.files.PSObject.Properties) {
  $entry.Value = (Get-FileHash -LiteralPath (Join-Path $root $entry.Name) -Algorithm SHA256).Hash.ToLowerInvariant()
}
New-Item -ItemType Directory -Path (Join-Path $root 'dist') -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $root 'dist/flowchart-generation.zip'
$stream = [IO.File]::Open($zip, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
  $entry = $archive.CreateEntry('capability.json')
  $writer = [IO.StreamWriter]::new($entry.Open(), [Text.UTF8Encoding]::new($false))
  try { $writer.Write(($manifest | ConvertTo-Json -Depth 12)) } finally { $writer.Dispose() }
  foreach ($file in $manifest.files.PSObject.Properties.Name) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $root $file), $file.Replace('\','/')) | Out-Null
  }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Host "Built: $zip"
