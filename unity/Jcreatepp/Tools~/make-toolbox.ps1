# Makes Editor/Blocks/jcreatepp-toolbox.json (the block editor's palette) from the Web editor's
# src/toolbox.ts, so Unity shows the same categories and starting values.
# toolbox.ts is one plain object literal; it is run in the bundled Jint and written as JSON.
# Run again whenever src/toolbox.ts changes (PowerShell 7: pwsh).
#
#   pwsh -File Tools~/make-toolbox.ps1 -Toolbox <Jcreatepp repository>/src/toolbox.ts
param([Parameter(Mandatory = $true)][string]$Toolbox)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$plugins = Join-Path $root 'Editor/Preview/Plugins'
foreach ($dll in 'System.Runtime.CompilerServices.Unsafe.dll', 'Acornima.dll', 'Jint.dll') {
    Add-Type -Path (Join-Path $plugins $dll)
}

$source = [IO.File]::ReadAllText((Resolve-Path $Toolbox))
$marker = 'export const toolbox = '
if (-not $source.Contains($marker)) { throw "toolbox.ts no longer starts its object with '$marker'; update this script" }
$script = $source.Replace($marker, 'var toolbox = ') + "`n;JSON.stringify(toolbox, null, 2);"
$json = (New-Object Jint.Engine).Evaluate($script).ToString()

$out = Join-Path $root 'Editor/Blocks/jcreatepp-toolbox.json'
[IO.File]::WriteAllText($out, $json + "`n", (New-Object Text.UTF8Encoding $false))
Write-Output "wrote $out"
