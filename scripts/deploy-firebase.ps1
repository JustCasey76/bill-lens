# Deploy to Firebase from a Linux container (avoids Windows symlink error).
# Requires: Docker, and FIREBASE_TOKEN from "npx firebase-tools login:ci"
# Usage: $env:FIREBASE_TOKEN = "your-token"; .\scripts\deploy-firebase.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$token = $env:FIREBASE_TOKEN
if (-not $token) {
    Write-Host "Set FIREBASE_TOKEN first. Run: npx firebase-tools login:ci" -ForegroundColor Red
    Write-Host "Then: `$env:FIREBASE_TOKEN = 'paste-token-here'; .\scripts\deploy-firebase.ps1" -ForegroundColor Yellow
    exit 1
}

Push-Location $projectRoot
try {
    Write-Host "Building and deploying from Linux container..." -ForegroundColor Cyan
    docker run --rm `
        -v "${projectRoot}:/app" `
        -w /app `
        -e FIREBASE_TOKEN=$token `
        -e DATABASE_URL="postgresql://postgres:password@localhost:5432/billlens" `
        -e REDIS_URL="redis://localhost:6379" `
        node:20-slim bash -c "npm ci && npx prisma generate && npx firebase-tools deploy"
    if ($LASTEXITCODE -eq 0) { Write-Host "Deploy complete. Site: https://bill-lens.web.app" -ForegroundColor Green }
    else { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
