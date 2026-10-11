#requires -Version 5.1
param([string]$PrepareScript=(Join-Path $PSScriptRoot 'prepare-offline.ps1'))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('offline-prepare-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory((Join-Path $testRoot 'offline-delivery')) | Out-Null
function Assert-Test($Value,[string]$Name) { if(-not $Value){throw ('FAIL: '+$Name)};Write-Host ('PASS: '+$Name) }
function Make-Package([string]$Name,[switch]$Traversal,[switch]$Corrupt) {
    $file=Join-Path $testRoot ('offline-delivery/'+$Name)
    $zip=[IO.Compression.ZipFile]::Open($file,[IO.Compression.ZipArchiveMode]::Create)
    try {
        $payload=[Text.Encoding]::UTF8.GetBytes('test runtime payload')
        $sha=[Security.Cryptography.SHA256]::Create()
        try{$hash=([BitConverter]::ToString($sha.ComputeHash($payload))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
        if($Corrupt){$hash='0'*64}
        $entries=@{'offline/payload.zip'='test runtime payload';'offline/manifest.json'=(@{schema=1;payloadSha256=$hash}|ConvertTo-Json);'offline/install.ps1'='test installer';'offline/configure.cjs'='test config';'offline/profile-template.json'='{}';'deploy.ps1'='must not replace git launcher'}
        if($Traversal){$entries['offline/../../outside.txt']='bad'}
        foreach($name in $entries.Keys){$entry=$zip.CreateEntry($name);$stream=$entry.Open();try{$bytes=[Text.Encoding]::UTF8.GetBytes($entries[$name]);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}}
    }finally{$zip.Dispose()}
    return $file
}
function Expect-Failure([scriptblock]$Action,[string]$Name){$failed=$false;try{& $Action}catch{$failed=$true};Assert-Test $failed $Name}
try {
    [IO.File]::WriteAllText((Join-Path $testRoot 'deploy.ps1'),'git launcher')
    Expect-Failure { & $PrepareScript -Root $testRoot } 'empty delivery folder fails without online fallback'
    $archive=Make-Package 'DeepSeek-Workbench-Offline-test.zip'
    Expect-Failure { & $PrepareScript -Root $testRoot -ReadOnly } 'readonly mode refuses first extraction'
    Assert-Test (-not(Test-Path -LiteralPath (Join-Path $testRoot 'offline'))) 'readonly leaves files unchanged'
    & $PrepareScript -Root $testRoot
    Assert-Test ([IO.File]::ReadAllText((Join-Path $testRoot 'deploy.ps1')) -eq 'git launcher') 'archive root launcher ignored'
    $target=Join-Path $testRoot 'offline/configure.cjs'
    $stamp=(Get-Item -LiteralPath $target).LastWriteTimeUtc
    & $PrepareScript -Root $testRoot
    Assert-Test ((Get-Item -LiteralPath $target).LastWriteTimeUtc -eq $stamp) 'repeat preparation skips extraction'
    [IO.File]::WriteAllText($target,'damaged')
    Expect-Failure { & $PrepareScript -Root $testRoot -ReadOnly } 'readonly detects damaged extracted file'
    & $PrepareScript -Root $testRoot
    Assert-Test ([IO.File]::ReadAllText($target) -eq 'test config') 'damaged extracted file repaired from ZIP'
    [IO.File]::WriteAllText($archive+'.sha256',('0'*64))
    Expect-Failure { & $PrepareScript -Root $testRoot } 'bad ZIP sidecar rejected'
    [IO.File]::Delete($archive+'.sha256')
    $bad=Make-Package 'DeepSeek-Workbench-Offline-new.zip' -Corrupt
    [IO.File]::SetLastWriteTimeUtc($bad,[DateTime]::UtcNow.AddHours(1))
    Expect-Failure { & $PrepareScript -Root $testRoot } 'newest invalid payload rejected without older fallback'
    Assert-Test ([IO.File]::ReadAllText($target) -eq 'test config') 'failed preparation preserves prior extracted files'
    [IO.File]::Delete($bad)
    $bad=Make-Package 'DeepSeek-Workbench-Offline-traversal.zip' -Traversal
    [IO.File]::SetLastWriteTimeUtc($bad,[DateTime]::UtcNow.AddHours(1))
    Expect-Failure { & $PrepareScript -Root $testRoot } 'ZIP traversal rejected'
    Assert-Test (-not(Test-Path -LiteralPath (Join-Path (Split-Path $testRoot) 'outside.txt'))) 'no file written outside test root'
} finally {
    $full=[IO.Path]::GetFullPath($testRoot)
    if((Split-Path -Parent $full) -ne [IO.Path]::GetTempPath().TrimEnd('\') -or -not (Split-Path -Leaf $full).StartsWith('offline-prepare-')){throw 'Unsafe test cleanup'}
    Remove-Item -LiteralPath $full -Recurse -Force
}
