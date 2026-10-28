# Checks unity/Jcreatepp without Unity (Windows, .NET Framework's csc, C# 5):
#   1. the setup code compiles against Stubs.cs (Unity / CCK API signatures it uses)
#   2. ScriptAnalysis edge cases, and ScriptAnalysis over the real-device kit scripts
#   3. (with -JintDir) the preview code compiles against Stubs.cs + PreviewStubs.cs + the real Jint,
#      and SimHost.cs runs the simulator bundle on the real Jint: the kit scripts give the same
#      result as Node (expected.js), and stops / errors behave as designed (SimHostCheck.cs)
#   4. (with -JintDir) CoreHost.cs runs the block core bundle on the real Jint: every case converts
#      exactly like Node (expected-core.js), parts add the same way, a broken core stops (CoreHostCheck.cs)
# This does not replace a check in Unity: Unity's own APIs are only stubs here.
#
# Usage (from the repository root):
#   powershell -ExecutionPolicy Bypass -File unity\check\check.ps1
#   powershell -ExecutionPolicy Bypass -File unity\check\check.ps1 -JintDir <folder>
# <folder> holds the .NET Framework builds from NuGet: Jint.dll (4.17.0, lib/net462),
# Acornima.dll (1.7.0, lib/net462), System.Memory.dll (4.5.5), System.Buffers.dll (4.5.1),
# System.Numerics.Vectors.dll (4.5.0), System.Runtime.CompilerServices.Unsafe.dll (6.0.0, lib/net461).
param([string]$JintDir)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$fw = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$csc = Join-Path $fw 'csc.exe'
$out = Join-Path $env:TEMP 'jcreatepp-unity-check'
New-Item -ItemType Directory -Force $out | Out-Null

$setup = Get-ChildItem (Join-Path $root 'unity\Jcreatepp\Editor\*.cs') | ForEach-Object FullName
$preview = Get-ChildItem (Join-Path $root 'unity\Jcreatepp\Editor\Preview\*.cs') | ForEach-Object FullName
$core = Get-ChildItem (Join-Path $root 'unity\Jcreatepp\Editor\Core\*.cs') | ForEach-Object FullName
$analysis = Join-Path $root 'unity\Jcreatepp\Editor\ScriptAnalysis.cs'
$stubs = @((Join-Path $PSScriptRoot 'Stubs.cs'), (Join-Path $PSScriptRoot 'PreviewStubs.cs'))

& $csc -nologo -target:library -langversion:5 -warn:4 -codepage:65001 "-out:$out\setup.dll" $stubs $setup
if ($LASTEXITCODE -ne 0) { throw 'setup code does not compile' }
Write-Output 'compile (setup): ok'

& $csc -nologo -langversion:5 -codepage:65001 "-out:$out\edge.exe" (Join-Path $PSScriptRoot 'EdgeCases.cs') $analysis
& "$out\edge.exe"
if ($LASTEXITCODE -ne 0) { throw 'edge cases failed' }
& $csc -nologo -langversion:5 -codepage:65001 "-out:$out\analyze.exe" (Join-Path $PSScriptRoot 'AnalyzeKit.cs') $analysis
& "$out\analyze.exe" (Join-Path $root 'test\realdevice\scripts')

if (-not $JintDir) {
    Write-Output 'preview: skipped (pass -JintDir to compile the preview and run SimHost on the real Jint)'
    return
}

Get-ChildItem (Join-Path $JintDir '*.dll') | Copy-Item -Destination $out -Force
$gac = Join-Path $env:WINDIR 'Microsoft.NET\assembly\GAC_MSIL'
$netstandard = (Get-ChildItem (Join-Path $gac 'netstandard\*\netstandard.dll') | Select-Object -First 1).FullName
$runtime = (Get-ChildItem (Join-Path $gac 'System.Runtime\*\System.Runtime.dll') | Select-Object -First 1).FullName
$refs = @("-r:$out\Jint.dll", "-r:$out\Acornima.dll", "-r:$netstandard", "-r:$runtime", '-r:System.Numerics.dll')

& $csc -nologo -target:library -langversion:5 -warn:4 -codepage:65001 "-out:$out\preview.dll" @refs $stubs $setup $preview $core
if ($LASTEXITCODE -ne 0) { throw 'preview code does not compile' }
Write-Output 'compile (preview): ok'

& $csc -nologo -langversion:5 -codepage:65001 "-out:$out\SimHostCheck.exe" @refs (Join-Path $PSScriptRoot 'SimHostCheck.cs') (Join-Path $root 'unity\Jcreatepp\Editor\Preview\SimHost.cs')
if ($LASTEXITCODE -ne 0) { throw 'SimHostCheck does not compile' }
Copy-Item (Join-Path $PSScriptRoot 'SimHostCheck.exe.config') "$out\SimHostCheck.exe.config" -Force
node (Join-Path $PSScriptRoot 'expected.js') "$out\expected.txt"
& "$out\SimHostCheck.exe" (Join-Path $root 'unity\Jcreatepp\Editor\Preview\Sim\jcreatepp-sim.txt') (Join-Path $root 'test\realdevice\scripts') "$out\expected.txt"
if ($LASTEXITCODE -ne 0) { throw 'SimHost checks failed' }

& $csc -nologo -langversion:5 -codepage:65001 "-out:$out\CoreHostCheck.exe" @refs (Join-Path $PSScriptRoot 'CoreHostCheck.cs') (Join-Path $root 'unity\Jcreatepp\Editor\Core\CoreHost.cs')
if ($LASTEXITCODE -ne 0) { throw 'CoreHostCheck does not compile' }
Copy-Item (Join-Path $PSScriptRoot 'SimHostCheck.exe.config') "$out\CoreHostCheck.exe.config" -Force
node (Join-Path $PSScriptRoot 'expected-core.js') "$out\core-cases"
& "$out\CoreHostCheck.exe" (Join-Path $root 'unity\Jcreatepp\Editor\Core\jcreatepp-core.txt') "$out\core-cases"
if ($LASTEXITCODE -ne 0) { throw 'CoreHost checks failed' }
