@echo off
chcp 65001 >nul
echo ========================================
echo  启动 ngrok 内网穿透（端口 3000）
echo ========================================
echo.
echo 提示：
echo   1. 启动后，复制显示的 HTTPS 地址（例如：https://abc123.ngrok-free.app）
echo   2. 更新 .env.local 中的 NEXT_PUBLIC_APP_URL 为该地址
echo   3. 在微信开放平台配置回调域名为该地址的域名部分
echo   4. 重启 Next.js 开发服务器
echo.
echo 按 Ctrl+C 可停止 ngrok
echo.
echo ========================================
echo.

ngrok http 3000

pause
