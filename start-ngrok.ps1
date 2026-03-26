# ngrok 内网穿透启动脚本
# 用法：.\start-ngrok.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动 ngrok 内网穿透（端口 3000）" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示：" -ForegroundColor Yellow
Write-Host "  1. 启动后，复制显示的 HTTPS 地址（例如：https://abc123.ngrok-free.app）" -ForegroundColor Yellow
Write-Host "  2. 更新 .env.local 中的 NEXT_PUBLIC_APP_URL 为该地址" -ForegroundColor Yellow
Write-Host "  3. 在微信开放平台配置回调域名为该地址的域名部分" -ForegroundColor Yellow
Write-Host "  4. 重启 Next.js 开发服务器" -ForegroundColor Yellow
Write-Host ""
Write-Host "按 Ctrl+C 可停止 ngrok" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 ngrok 是否已安装
$ngrokExists = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokExists) {
    Write-Host "错误：未找到 ngrok 命令" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先安装 ngrok：" -ForegroundColor Yellow
    Write-Host "  1. 访问 https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "  2. 或使用 Chocolatey: choco install ngrok" -ForegroundColor Yellow
    Write-Host "  3. 或使用 Scoop: scoop install ngrok" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "安装后，还需要配置 authtoken：" -ForegroundColor Yellow
    Write-Host "  ngrok config add-authtoken YOUR_AUTHTOKEN" -ForegroundColor Yellow
    Write-Host "  （在 https://dashboard.ngrok.com/get-started/your-authtoken 获取）" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# 启动 ngrok
Write-Host "正在启动 ngrok..." -ForegroundColor Green
ngrok http 3000
