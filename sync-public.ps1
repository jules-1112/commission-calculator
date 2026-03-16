$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicDir = Join-Path $projectRoot 'public'
$assetsDir = Join-Path $projectRoot 'assets'

$filesToCopy = @(
  'index.html',
  'signup.html',
  'forgot.html',
  'reset.html',
  'style.css',
  'styles.css',
  'main.js',
  'auth.js'
)

New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

foreach ($file in $filesToCopy) {
  Copy-Item -Path (Join-Path $projectRoot $file) -Destination (Join-Path $publicDir $file) -Force
}

if (Test-Path $assetsDir) {
  Copy-Item -Path $assetsDir -Destination $publicDir -Recurse -Force
}

Write-Host "Synced site files to $publicDir"
