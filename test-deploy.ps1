#requires -Version 5.1
[CmdletBinding()]
param([switch]$DownloadNode, [string]$ArchivePath)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'deploy.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('workbench-bootstrap-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$script:Root = $testRoot
$script:BackupRoot = Join-Path $testRoot 'backup'
function Assert-Test($Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}
Set-LocalEnvironment
if ($DownloadNode) {
    if ($ArchivePath) {
        $cache = Join-Path $testRoot 'runtime\downloads'
        New-Item -ItemType Directory -Force -Path $cache | Out-Null
        Copy-Item -LiteralPath $ArchivePath -Destination (Join-Path $cache ('node-v' + $script:Versions.Node + '-win-x64.zip'))
    }
    Install-Node
    $before = (Get-Item -LiteralPath $script:Node).LastWriteTimeUtc
    $hash = (Get-FileHash -LiteralPath $script:Node).Hash
    Install-Node
    Assert-Test ((Get-Item -LiteralPath $script:Node).LastWriteTimeUtc -eq $before -and (Get-FileHash -LiteralPath $script:Node).Hash -eq $hash) 'official download installation and repeated reuse'
    $nodeVersion = & $script:Node --version
    Assert-Test ($nodeVersion -eq ('v' + $script:Versions.Node)) 'portable Node version'
    & $script:Node $script:Npm --version
    Assert-Test ($LASTEXITCODE -eq 0) 'portable npm starts'
}
$desktopEntry = Join-Path $testRoot ('start-desktop.ps1')
$cmdEntry = Join-Path $testRoot ([string]::Concat([char]0x542f,[char]0x52a8,[char]0x684c,[char]0x9762,[char]0x7aef,'.cmd'))
[IO.File]::WriteAllText($desktopEntry, '# existing stale-lock handling and user entry')
[IO.File]::WriteAllText($cmdEntry, '@echo existing entry')
$fixtureProfilePath = Join-Path $testRoot 'dsh-data\profiles\web\package.json'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $fixtureProfilePath) | Out-Null
[IO.File]::WriteAllText($fixtureProfilePath, '{"custom":"keep","dependencies":{"custom-plugin":"local"}}')
$profileHash = (Get-FileHash -LiteralPath $fixtureProfilePath).Hash
$entryHash = (Get-FileHash -LiteralPath $desktopEntry).Hash
$cmdHash = (Get-FileHash -LiteralPath $cmdEntry).Hash
Write-Launchers -MissingOnly
Assert-Test ((Get-FileHash -LiteralPath $desktopEntry).Hash -eq $entryHash -and (Get-FileHash -LiteralPath $cmdEntry).Hash -eq $cmdHash) 'existing launchers preserved byte-for-byte'
$generated = @(Get-ChildItem -LiteralPath $testRoot -Filter '*.cmd')
Assert-Test ($generated.Count -eq 3) 'missing Web and Build launchers created'
$hashes = @($generated | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName).Hash }) -join ','
Write-Launchers -MissingOnly
Assert-Test ((@((Get-ChildItem -LiteralPath $testRoot -Filter '*.cmd') | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName).Hash }) -join ',') -eq $hashes) 'launcher generation is idempotent'

# Bootstrap must not enter any dependency/profile/build mutation path.
function Select-Source { return (Join-Path $script:Root 'source-fixture') }
function Assert-Source { }
function Install-NpmEnvironment { throw 'Bootstrap attempted dependency installation' }
function Install-WebProfile { throw 'Bootstrap attempted profile installation' }
function Build-Chat { throw 'Bootstrap attempted chat build' }
function Build-Workshop { throw 'Bootstrap attempted workshop build' }
function Register-Bundles { throw 'Bootstrap attempted profile registration' }
$script:installed = $false; $script:checked = $false
function Install-Node { $script:installed = $true }
function Check-Installation { $script:checked = $true }
$Mode = 'Bootstrap'
Main
Assert-Test ($script:installed -and $script:checked) 'Bootstrap dispatch installs Node and checks installation'
Assert-Test ((Get-FileHash -LiteralPath $fixtureProfilePath).Hash -eq $profileHash) 'profile contents remain unchanged'
Assert-Test ((Get-FileHash -LiteralPath $desktopEntry).Hash -eq $entryHash) 'Bootstrap retains existing desktop logic'
Assert-Test (-not (Test-Path -LiteralPath (Join-Path $testRoot 'runtime-dev\deployment-selection.json'))) 'Bootstrap does not overwrite prior deployment selection'

# Execute the real launcher with process creation intercepted; never open a window.
$originalPath = $env:PATH
function Start-Process {
    param($FilePath, $ArgumentList, $WorkingDirectory, $WindowStyle)
    $script:observedNode = $env:DSH_DESKTOP_NODE
    $script:observedHome = $env:DSH_HOME
}
foreach ($portable in @($true, $false)) {
    $launchRoot = Join-Path $testRoot ('launcher-' + $portable)
    foreach ($relative in @('runtime-desktop\node_modules\electron\dist\electron.exe','deepseek_harness_desktop\desktop\src\main.cjs','runtime\node_modules\@deepseek-ai\dsh\lib\bin.js','dsh-data\profiles\web\package.json')) {
        $target = Join-Path $launchRoot $relative
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
        [IO.File]::WriteAllText($target, '{}')
    }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-desktop.ps1') -Destination $launchRoot
    if ($portable) {
        New-Item -ItemType Directory -Path (Join-Path $launchRoot 'runtime-node') | Out-Null
        [IO.File]::WriteAllText((Join-Path $launchRoot 'runtime-node\node.exe'), 'not executed: launch intercepted')
        $expectedNode = Join-Path $launchRoot 'runtime-node\node.exe'
    } else {
        $env:PATH = $originalPath
        $expectedNode = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
    }
    $lockFile = Join-Path $launchRoot 'dsh-data\capabilities\writer.lock'
    New-Item -ItemType Directory -Path (Split-Path -Parent $lockFile) | Out-Null
    [IO.File]::WriteAllText($lockFile, ('{"pid":2147483646,"startedAt":"' + [DateTime]::UtcNow.ToString('o') + '"}'))
    & (Join-Path $launchRoot 'start-desktop.ps1')
    Assert-Test ($env:DSH_DESKTOP_NODE -eq $expectedNode) "launcher runtime selection (portable=$portable)"
    Assert-Test ($env:DSH_HOME -eq (Join-Path $launchRoot 'dsh-data')) 'launcher uses same workbench data directory'
    Assert-Test (-not (Test-Path -LiteralPath $lockFile)) 'stale lock handling retained'
    [IO.File]::WriteAllText($lockFile, ('{"pid":' + $PID + ',"startedAt":"' + [DateTime]::UtcNow.ToString('o') + '"}'))
    & (Join-Path $launchRoot 'start-desktop.ps1')
    Assert-Test (Test-Path -LiteralPath $lockFile) 'active process lock retained'
    $env:PATH = $originalPath
}
Write-Host "All Bootstrap tests passed. Isolated evidence: $testRoot"
