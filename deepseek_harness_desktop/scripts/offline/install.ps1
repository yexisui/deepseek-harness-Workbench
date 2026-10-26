#requires -Version 5.1
[CmdletBinding()]
param([ValidateSet('Deploy','Repair','Check','Inspect','Desktop','Tools','Bootstrap','Build')][string]$Mode='Deploy',[switch]$Repair, [string]$WorkbenchRoot, [string]$PackageDirectory, [switch]$PreserveLaunchers)
$ErrorActionPreference='Stop'
$root=if($WorkbenchRoot){[IO.Path]::GetFullPath($WorkbenchRoot)}else{[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))}
$packageRoot=if($PackageDirectory){[IO.Path]::GetFullPath($PackageDirectory)}else{$PSScriptRoot}
$lock=$null; $zip=$null
$checkedParents=@{}
function Long-Path([string]$path) { if($path.StartsWith('\\?\')){return $path}; if($path.StartsWith('\\')){return '\\?\UNC\'+$path.Substring(2)}; return '\\?\'+$path }
function File-Hash([string]$path) {
    $stream=[IO.File]::OpenRead((Long-Path $path)); $sha=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
}
function Safe-Path([string]$relative) {
    if ([IO.Path]::IsPathRooted($relative) -or $relative.Contains(':')) { throw 'Invalid payload path' }
    $full=[IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $full.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Payload path escapes installation' }
    $cursor=Split-Path -Parent $full
    while ($cursor -ne $root) {
        if($checkedParents.ContainsKey($cursor)){break}
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                # Older pnpm installs may link an individual dependency into a build tree.
                # Remove ONLY that junction, never its target, and materialize the package locally.
                $relativeParent=$cursor.Substring($root.Length+1)
                if($readOnly -or $relativeParent -notmatch '(^|\\)node_modules\\') { throw "Linked installation path needs deployment repair: $cursor" }
                [IO.Directory]::Delete((Long-Path $cursor))
                [IO.Directory]::CreateDirectory((Long-Path $cursor)) | Out-Null
                Write-Host ('Replacing dependency link with local files: '+$relativeParent)
            }
        }
        $checkedParents[$cursor]=$true
        $cursor=Split-Path -Parent $cursor
    }
    if ((Test-Path -LiteralPath $full) -and ((Get-Item -LiteralPath $full -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Linked file cannot be overwritten: $full" }
    return $full
}
try {
    if ($Mode -eq 'Desktop') { & (Join-Path $root 'start-desktop.ps1'); exit $LASTEXITCODE }
    if ($Mode -eq 'Build') { throw 'This offline release is prebuilt. Use Deploy or Check; source builds require the development project.' }
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'This release requires Windows x64.' }
    $manifest=Get-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($Mode -eq 'Inspect') { Write-Host ('Offline release: '+$manifest.release+'; files: '+$manifest.files.Count); exit 0 }
    $readOnly=$Mode -eq 'Check'
    if (-not $readOnly) {
        $busy=@(Get-Process -Name electron,node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) })
        if ($busy.Count) { throw 'Close this workbench before installing or repairing. No running program was stopped.' }
        [IO.Directory]::CreateDirectory((Join-Path $root 'offline-state')) | Out-Null
        $lock=[IO.File]::Open((Join-Path $root 'offline-state/install.lock'),'OpenOrCreate','ReadWrite','None')
    }
    $archive=Join-Path $packageRoot 'payload.zip'
    Write-Host 'Checking local offline package (no downloads)...'
    if ((File-Hash $archive) -ne $manifest.payloadSha256) { throw 'Offline package checksum failed. Replace the damaged offline package.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::OpenRead($archive)
    $entries=@{}; foreach($entry in $zip.Entries) { if($entries.ContainsKey($entry.FullName)){throw 'Duplicate ZIP entry'}; $entries[$entry.FullName]=$entry }
    $todo=New-Object 'System.Collections.Generic.List[object]'; $reused=0; $scanned=0
    foreach ($file in $manifest.files) {
        $target=Safe-Path $file.path
        # A Git checkout owns its launchers; a runtime payload must not downgrade them.
        if($PreserveLaunchers -and $file.path -in @('start-desktop.ps1','deploy.ps1','启动桌面端.cmd','一键部署.cmd') -and [IO.File]::Exists($target)){$reused++;continue}
        if (-not $entries.ContainsKey($file.path)) { throw ('Missing payload entry: '+$file.path) }
        $longTarget=Long-Path $target
        $good=[IO.File]::Exists($longTarget) -and ((New-Object IO.FileInfo($longTarget)).Length -eq $file.size)
        if ($good) { $good=(File-Hash $target) -eq $file.sha256 }
        if($good){$reused++}else{$todo.Add([pscustomobject]@{file=$file;target=$target})}
        $scanned++; if($scanned % 5000 -eq 0){Write-Host ("Checked $scanned / "+$manifest.files.Count)}
    }
    if($readOnly -and $todo.Count){throw ('Missing/damaged files: '+$todo.Count+'. Run deployment to repair.')}
    $done=0
    foreach($item in $todo) {
        $parent=Split-Path -Parent $item.target
        [IO.Directory]::CreateDirectory((Long-Path $parent)) | Out-Null
        $temp=Join-Path $parent ('.o-'+[guid]::NewGuid().ToString('N').Substring(0,8)+'.tmp')
        try {
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entries[$item.file.path],(Long-Path $temp),$false)
            if((File-Hash $temp) -ne $item.file.sha256){throw ('File checksum failed: '+$item.file.path)}
            if([IO.File]::Exists((Long-Path $item.target))){
                $replaceBackup=Long-Path ($temp+'.bak')
                [IO.File]::Replace((Long-Path $temp),(Long-Path $item.target),$replaceBackup)
                [IO.File]::Delete($replaceBackup)
            }else{[IO.File]::Move((Long-Path $temp),(Long-Path $item.target))}
        } finally {if([IO.File]::Exists((Long-Path $temp))){[IO.File]::Delete((Long-Path $temp))}}
        $done++; if($done % 2000 -eq 0){Write-Host ("Installed/repaired $done / "+$todo.Count)}
    }
    $node=Join-Path $root 'runtime-node/node.exe'
    & $node (Join-Path $packageRoot 'configure.cjs') $root (Join-Path $packageRoot 'profile-template.json') $Mode
    if($LASTEXITCODE -ne 0){throw 'Profile verification failed'}
    & $node --version
    if($LASTEXITCODE -ne 0){throw 'Node runtime failed'}
    $savedElectron=$env:ELECTRON_RUN_AS_NODE
    try { $env:ELECTRON_RUN_AS_NODE='1'; & (Join-Path $root 'runtime-desktop/node_modules/electron/dist/electron.exe') -p 'process.versions.electron'; if($LASTEXITCODE -ne 0){throw 'Electron runtime failed. Check system runtime compatibility.'} } finally { $env:ELECTRON_RUN_AS_NODE=$savedElectron }
    $ff=Get-Content -LiteralPath (Join-Path $root 'external-tools/ffmpeg/current.json') -Raw | ConvertFrom-Json
    & (Join-Path (Join-Path $root 'external-tools/ffmpeg') $ff.ffmpeg) -version | Select-Object -First 1
    if($LASTEXITCODE -ne 0){throw 'FFmpeg runtime failed'}
    $searchSetup=Join-Path $root 'external-tools/search-service.ps1'
    if(Test-Path -LiteralPath $searchSetup){ & (Join-Path $root 'external-tools/install.ps1') -Check -Only everything,es,opencode,milvus -SkipService; & $searchSetup -Check:$readOnly }
    $summary=[pscustomobject]@{release=$manifest.release;mode=$Mode;reused=$reused;repaired=$done;completedAt=(Get-Date -Format o)}
    if(-not $readOnly){$summary|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'offline-state/last-install.json') -Encoding UTF8}
    Write-Host ("Completed. Reused: $reused; installed/repaired: $done. No downloads or package-manager installs.")
} catch {Write-Host ('Offline deployment failed: '+$_.Exception.Message) -ForegroundColor Red; exit 1}
finally {if($zip){$zip.Dispose()};if($lock){$lock.Dispose()}}
