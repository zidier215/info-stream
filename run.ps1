# InfoStream 一键构建、部署与全景审计脚本 (PowerShell 版)
# 对应 bash 版本: ./run.sh
param (
    [switch]$Audit,
    [switch]$Push,
    [switch]$SkipPrefetch
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== InfoStream: Starting Build & Deploy Pipeline ===" -ForegroundColor Cyan

# 1. 预取数据快照并打包静态产物到 public/
if (-not $SkipPrefetch) {
    Write-Host "=== Step 1/3: Prefetching initial feed snapshots ===" -ForegroundColor Yellow
    node prefetch.mjs
} else {
    Write-Host "=== Step 1/3: Skipping prefetch (using existing data/ snapshots) ===" -ForegroundColor DarkGray
}

Write-Host "=== Step 2/3: Building static artifacts to public/ ===" -ForegroundColor Yellow
node build.mjs

if (-not (Test-Path "public/index.html")) {
    Write-Error "Error: Build output public/index.html not found!"
    exit 1
}
Write-Host "Build succeeded. Artifacts verified in public/." -ForegroundColor Green

# 2. 定位 Wrangler CLI 并部署至 Cloudflare Pages
Write-Host "=== Step 3/3: Deploying to Cloudflare Pages (project: info-stream, branch: main) ===" -ForegroundColor Yellow
$wrangler = $null
if (Test-Path "./node_modules/wrangler/bin/wrangler.js") {
    $wrangler = "./node_modules/wrangler/bin/wrangler.js"
} elseif (Test-Path "d:/techminds-site/node_modules/wrangler/bin/wrangler.js") {
    $wrangler = "d:/techminds-site/node_modules/wrangler/bin/wrangler.js"
}

if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match "^\s*([^#=]+)=(.+)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

if ($wrangler) {
    node $wrangler pages deploy public --project-name info-stream --branch main --commit-dirty=true
} else {
    cmd.exe /c "npx wrangler pages deploy public --project-name info-stream --branch main --commit-dirty=true"
}

# 可选：执行线上真实 HTTP 深度审计
if ($Audit -or $env:AUDIT -eq "1") {
    if (Test-Path "live_audit.mjs") {
        Write-Host "=== Running post-deploy live HTTP audit ===" -ForegroundColor Cyan
        node live_audit.mjs
    }
}

# 可选：Git 推送（自动规避失效本地代理）
if ($Push) {
    Write-Host "=== Pushing git commits ===" -ForegroundColor Cyan
    git -c http.proxy= -c https.proxy= push
}

Write-Host "=== Deployment completed successfully! ===" -ForegroundColor Green

