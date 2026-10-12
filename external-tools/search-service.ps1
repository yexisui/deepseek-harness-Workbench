#requires -Version 5.1
[CmdletBinding()]
param([switch]$Check)
$ErrorActionPreference='Stop'
$service=Get-Service -Name 'Everything' -ErrorAction SilentlyContinue
if ($service -and $service.Status -eq 'Running') { Write-Host 'Everything indexing service ready.'; return }
if ($Check) { throw 'Everything indexing service is not running. Run deployment to set up the local file index.' }
$pointer=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'everything/current.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$exe=Join-Path (Join-Path $PSScriptRoot 'everything') $pointer.everything
# The official executable requests UAC itself. Existing service installations are reused.
$argument=if($service){'-start-service'}else{'-install-service'}
Write-Host 'Preparing Everything indexing service. Windows may request administrator approval.'
$process=Start-Process -FilePath $exe -ArgumentList $argument -WindowStyle Hidden -PassThru -Wait
if($process.ExitCode -ne 0){throw 'Everything service setup was cancelled or failed.'}
$service=Get-Service -Name 'Everything' -ErrorAction SilentlyContinue
if(-not $service -or $service.Status -ne 'Running'){throw 'Everything service is not running. Complete Windows approval and run deployment again.'}
Write-Host 'Everything indexing service ready.'
