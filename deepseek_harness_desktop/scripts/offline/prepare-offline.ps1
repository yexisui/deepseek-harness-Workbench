#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Root, [switch]$ReadOnly)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)
$delivery = Join-Path $Root 'offline-delivery'
if (-not (Test-Path -LiteralPath $delivery)) { return }
function Assert-LocalPath([string]$Relative) {
    if ($Relative -match '(^|[\\/])\.{1,2}([\\/]|$)|:|^[/\\]|[\\/]{2}|[. ]([\\/]|$)') { throw 'Invalid offline archive path.' }
    $full = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if (-not $full.StartsWith($Root.TrimEnd('\')+'\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Offline archive escapes workbench root.' }
    $cursor = $full
    while ($cursor -ne $Root) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Linked offline path is not supported: $Relative" }
        $cursor = Split-Path -Parent $cursor
    }
    return $full
}
function Hash-File([string]$File) {
    $stream = [IO.File]::OpenRead($File); $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
}
$null = Assert-LocalPath 'offline-delivery'
$packages = @(Get-ChildItem -LiteralPath $delivery -Filter 'DeepSeek-Workbench-Offline-*.zip' -File | Sort-Object -Property @{Expression='LastWriteTimeUtc';Descending=$true}, @{Expression='Name';Descending=$true})
if ($packages.Count -eq 0) { throw 'offline-delivery exists but contains no DeepSeek-Workbench-Offline-*.zip. Put the installation ZIP directly in that folder.' }
$package = $packages[0]
$null = Assert-LocalPath ('offline-delivery/'+$package.Name)
$receiptPath = Assert-LocalPath 'offline-delivery/.prepared.json'
$lock = $null; $archive = $null; $stage = $null
try {
    if (-not $ReadOnly) {
        $lockPath = Assert-LocalPath 'offline-delivery/.prepare.lock'
        try { $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') }
        catch { throw 'Another offline package preparation is running, or offline-delivery is not writable.' }
    }
    Write-Host ('Offline package: offline-delivery\'+$package.Name)
    $zipHash = Hash-File $package.FullName
    $sidecar = Assert-LocalPath ('offline-delivery/'+$package.Name+'.sha256')
    if (Test-Path -LiteralPath $sidecar) {
        $expected = ([IO.File]::ReadAllText($sidecar).Trim() -split '\s+')[0]
        if ($expected -notmatch '^[a-fA-F0-9]{64}$' -or $expected -ne $zipHash) { throw 'Offline ZIP checksum mismatch. Copy the complete ZIP and its matching checksum again.' }
    }
    $receipt = $null
    if (Test-Path -LiteralPath $receiptPath) { try { $receipt = [IO.File]::ReadAllText($receiptPath) | ConvertFrom-Json } catch { $receipt = $null } }
    $ready = $receipt -and $receipt.archiveSha256 -eq $zipHash -and @($receipt.files).Count -gt 0
    if ($ready) {
        foreach ($file in $receipt.files) {
            if (-not ([string]$file.path).StartsWith('offline/')) { throw 'Invalid offline preparation receipt.' }
            $target = Assert-LocalPath $file.path
            if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Hash-File $target) -ne $file.sha256) { $ready = $false; break }
        }
        foreach ($name in @('install.ps1','configure.cjs','manifest.json','profile-template.json','payload.zip')) {
            if (-not (Test-Path -LiteralPath (Assert-LocalPath ('offline/'+$name)) -PathType Leaf)) { $ready = $false }
        }
    }
    if ($ready) { Write-Host 'Offline archive already prepared; extraction skipped.'; return }
    if ($ReadOnly) { throw 'Offline package is new or extracted files need repair. Run one-click deployment first; Check/Inspect do not extract files.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($package.FullName)
    $selected = @{}; $files = @()
    foreach ($entry in $archive.Entries) {
        $name = $entry.FullName.Replace('\','/')
        # Old deliveries also contain root launchers. Never overwrite Git-managed files.
        if (-not $name.StartsWith('offline/')) { continue }
        $null = Assert-LocalPath $name
        if ($name.EndsWith('/')) { continue }
        if (($entry.ExternalAttributes -shr 16 -band 0xF000) -eq 0xA000) { throw 'Symlink entry is not supported.' }
        if ($selected.ContainsKey($name)) { throw 'Duplicate offline archive entry.' }
        $selected[$name] = $entry
    }
    foreach ($name in @('install.ps1','configure.cjs','manifest.json','profile-template.json','payload.zip')) {
        if (-not $selected.ContainsKey('offline/'+$name)) { throw ('Incomplete offline ZIP: '+$name) }
    }
    $stageRelative = 'offline-delivery/.extract-'+[guid]::NewGuid().ToString('N')
    $stage = Assert-LocalPath $stageRelative
    [IO.Directory]::CreateDirectory($stage) | Out-Null
    Write-Host 'Preparing offline files; Git launchers and source files are preserved...'
    foreach ($name in $selected.Keys) {
        $temp = Assert-LocalPath ($stageRelative+'/'+$name)
        [IO.Directory]::CreateDirectory((Split-Path -Parent $temp)) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($selected[$name], $temp, $false)
        $files += [pscustomobject]@{path=$name;sha256=(Hash-File $temp)}
    }
    $manifest = [IO.File]::ReadAllText((Join-Path $stage 'offline/manifest.json')) | ConvertFrom-Json
    $payload = $files | Where-Object { $_.path -eq 'offline/payload.zip' }
    if ($manifest.schema -ne 1 -or $manifest.payloadSha256 -ne $payload.sha256) { throw 'Offline payload checksum or manifest is invalid.' }
    foreach ($file in $files) {
        $target = Assert-LocalPath $file.path
        if ((Test-Path -LiteralPath $target -PathType Leaf) -and (Hash-File $target) -eq $file.sha256) { continue }
        [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
        $temp = Join-Path $stage $file.path
        if ([IO.File]::Exists($target)) {
            $backup = $temp+'.replaced'
            [IO.File]::Replace($temp, $target, $backup)
            [IO.File]::Delete($backup)
        } else { [IO.File]::Move($temp, $target) }
    }
    $record = [pscustomobject]@{archive=$package.Name;archiveSha256=$zipHash;files=$files}
    [IO.File]::WriteAllText($receiptPath, ($record | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Offline files ready. Continuing local installation.'
} finally {
    if ($archive) { $archive.Dispose() }
    if ($lock) { $lock.Dispose() }
    if ($stage -and (Test-Path -LiteralPath $stage)) {
        # Only remove the unique staging directory created by this invocation.
        $resolvedStage = [IO.Path]::GetFullPath($stage)
        if (-not $resolvedStage.StartsWith($delivery+'\.extract-', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe staging cleanup path.' }
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
}
