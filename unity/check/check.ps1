# Checks unity/Jcreatepp without Unity (Windows, .NET Framework's csc, C# 5):
#   1. the extension compiles against Stubs.cs (Unity / CCK API signatures it uses)
#   2. ScriptAnalysis edge cases (API names in strings / comments, escaped quotes)
#   3. ScriptAnalysis over the real-device kit scripts (prints one line per script)
# This does not replace a check in Unity: it catches typos and type errors only.
# Usage (from the repository root): powershell -ExecutionPolicy Bypass -File unity\check\check.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$out = Join-Path $env:TEMP 'jcreatepp-unity-check'
New-Item -ItemType Directory -Force $out | Out-Null

$editor = Get-ChildItem (Join-Path $root 'unity\Jcreatepp\Editor\*.cs') | ForEach-Object FullName
$analysis = Join-Path $root 'unity\Jcreatepp\Editor\ScriptAnalysis.cs'

& $csc -nologo -target:library -langversion:5 -warn:4 -codepage:65001 "-out:$out\check.dll" (Join-Path $PSScriptRoot 'Stubs.cs') $editor
if ($LASTEXITCODE -ne 0) { throw 'extension does not compile' }
Write-Output 'compile: ok'

& $csc -nologo -langversion:5 -codepage:65001 "-out:$out\edge.exe" (Join-Path $PSScriptRoot 'EdgeCases.cs') $analysis
& "$out\edge.exe"
if ($LASTEXITCODE -ne 0) { throw 'edge cases failed' }

& $csc -nologo -langversion:5 -codepage:65001 "-out:$out\analyze.exe" (Join-Path $PSScriptRoot 'AnalyzeKit.cs') $analysis
& "$out\analyze.exe" (Join-Path $root 'test\realdevice\scripts')
