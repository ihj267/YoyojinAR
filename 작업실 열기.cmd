@echo off
chcp 65001 >nul
if not exist "C:\Users\ihj26\Documents\Codex\2026-09-14\plugin-computer-use-openai-bundled-x20-2\outputs\YoyojinAR-next\workspace_server.py" (
  echo 작업실 파일을 찾을 수 없습니다. 안내 파일의 작업실 경로를 확인해 주세요.
  pause
  exit /b 1
)
powershell.exe -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath 'C:\Users\ihj26\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -ArgumentList @('C:\Users\ihj26\Documents\Codex\2026-09-14\plugin-computer-use-openai-bundled-x20-2\outputs\YoyojinAR-next\workspace_server.py','--open','editor')"
