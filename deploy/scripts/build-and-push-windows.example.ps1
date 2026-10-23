param (
    [Parameter(Mandatory=$true)][string]$AliyunUsername
)
$ErrorActionPreference = 'Stop'
$Registry = "registry.example.com"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$ComposeFile = Join-Path $ProjectRoot 'deploy/compose/docker-compose.build.yml'
docker login --username=$AliyunUsername $Registry
if ($LASTEXITCODE -ne 0) { throw 'Docker login failed' }
docker compose --project-directory $ProjectRoot -f $ComposeFile build
if ($LASTEXITCODE -ne 0) { throw 'Docker build failed' }
docker compose --project-directory $ProjectRoot -f $ComposeFile push
if ($LASTEXITCODE -ne 0) { throw 'Docker push failed' }
Write-Host 'Build and push completed.'
