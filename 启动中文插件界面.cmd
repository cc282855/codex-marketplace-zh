@echo off
chcp 65001 >nul
where node.exe >nul 2>&1
if errorlevel 1 (
  echo 未找到 Node.js，无法启动中文插件界面。
  pause
  exit /b 1
)
node.exe "%~dp0codex-cn-stable-launcher.mjs"
pause
