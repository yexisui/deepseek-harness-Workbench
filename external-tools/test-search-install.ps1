#requires -Version 5.1
param([Parameter(Mandatory=$true)][string]$CacheDirectory)
$ErrorActionPreference='Stop'
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('dsh-search-install-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
foreach($name in @('install.ps1','tools.json','everything-LICENSE.txt','es-LICENSE.txt')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $testRoot }
$installer=Join-Path $testRoot 'install.ps1'
function Expect-Failure([scriptblock]$Action,[string]$Pattern){try{& $Action}catch{if($_.Exception.Message -notmatch $Pattern){throw};return};throw "Expected failure: $Pattern"}
$before=@(Get-ChildItem -LiteralPath $testRoot -File -Recurse).Count
Expect-Failure { & $installer -Check -Only everything,es -SkipService } 'Missing external tool'
if(@(Get-ChildItem -LiteralPath $testRoot -File -Recurse).Count -ne $before){throw 'Missing Check wrote files'}
$downloads=Join-Path $testRoot 'downloads';New-Item -ItemType Directory -Path $downloads | Out-Null
$manifest=Get-Content -LiteralPath (Join-Path $testRoot 'tools.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($tool in $manifest.tools | Where-Object id -in everything,es){Copy-Item -LiteralPath (Join-Path $CacheDirectory $tool.archive) -Destination $downloads}
& $installer -Only everything,es -SkipService
$exe=Get-ChildItem -LiteralPath $testRoot -Filter es.exe -Recurse | Select-Object -First 1
$stamp=$exe.LastWriteTimeUtc
$pointer=Join-Path $testRoot 'es/current.json';$hash=(Get-FileHash -LiteralPath $pointer).Hash
& $installer -Check -Only everything,es -SkipService
if((Get-FileHash -LiteralPath $pointer).Hash -ne $hash){throw 'Check modified pointer'}
& $installer -Only everything,es -SkipService
if((Get-Item -LiteralPath $exe.FullName).LastWriteTimeUtc -ne $stamp){throw 'Reuse replaced executable'}
# Only this isolated fixture is removed; the missing executable must be repaired from the verified cache.
Remove-Item -LiteralPath $exe.FullName
Expect-Failure { & $installer -Check -Only everything,es -SkipService } 'Missing external tool'
& $installer -Only everything,es -SkipService
& $installer -Check -Only everything,es -SkipService
Write-Host 'PASS fresh install, reuse, read-only checks and missing program repair.'
Write-Host "Evidence: $testRoot"
