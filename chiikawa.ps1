<#
.SYNOPSIS
  OhMyChiikawa desktop pet launcher for Windows PowerShell.
.DESCRIPTION
  Launches the OhMyChiikawa desktop pet via Electron. Supports all commands
  and options available in chiikawa.js.
.PARAMETER Command
  Optional command: start (default), pets, pack, version, help.
.PARAMETER Pet
  Which pet to show (usagi or chiikawa). Default: usagi.
.PARAMETER Size
  On-screen size: tiny, small, medium, or large. Default: medium.
.EXAMPLE
  .\chiikawa.ps1
  .\chiikawa.ps1 --size small
  .\chiikawa.ps1 -p usagi -s large
  .\chiikawa.ps1 pets
  .\chiikawa.ps1 version
#>

param(
    [Parameter(Position = 0)]
    [string]$Command,

    [string]$Pet,
    [Alias('p')]
    [string]$PetAlias,

    [string]$Size,
    [Alias('s')]
    [string]$SizeAlias
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$args = @()

if ($Command -and $Command -ne 'start') {
    $args += $Command
}

if ($PetAlias) { $args += '--pet=' + $PetAlias }
elseif ($Pet) { $args += '--pet=' + $Pet }

if ($SizeAlias) { $args += '--size=' + $SizeAlias }
elseif ($Size) { $args += '--size=' + $Size }

$nodeScript = Join-Path $scriptDir 'chiikawa.js'
$proc = Start-Process -FilePath 'node' -ArgumentList ($nodeScript, $args) -NoNewWindow -Wait -PassThru
exit $proc.ExitCode
