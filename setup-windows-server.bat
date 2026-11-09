@echo off
setlocal EnableDelayedExpansion
title Deploy Hospital QR Med Server (10.120.49.40 - LAN + 4G/5G)
echo ====================================================================
echo   CAI DAT VA CAP NHAT SERVER QR CODE KHO THUOC (10.120.49.40)
echo   - Giu nguyen 100%% Database cac loai thuoc da nhap
echo   - Tu dong tao URL 4G/5G Public HTTPS moi on dinh
echo ====================================================================
echo.
cd /d "%~dp0"

REM Bo sung duong dan Node.js mac dinh vao PATH khi chay Run as Administrator
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%APPDATA%\npm;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
    echo [THONG BAO] May chu chua co Node.js. Dang tu dong tai va cai dat Node.js v20 LTS...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '%TEMP%\nodejs-lts.msi'"
    if exist "%TEMP%\nodejs-lts.msi" (
        echo Dang cai dat Node.js LTS ^(vui long doi 1-2 phut^)...
        msiexec /i "%TEMP%\nodejs-lts.msi" /qn /norestart
        set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
    )
)

echo [OK] Da nhan dien Node.js phien ban:
node -v

net start MongoDB >nul 2>nul
echo [OK] Da kiem tra dich vu MongoDB.

echo.
echo [1/4] Dang mo cong TCP 3000 tren Windows Firewall...
netsh advfirewall firewall delete rule name="Hospital QR Med Server (TCP 3000)" >nul 2>nul
netsh advfirewall firewall add rule name="Hospital QR Med Server (TCP 3000)" dir=in action=allow protocol=TCP localport=3000
echo [OK] Da mo cong TCP 3000.

echo.
echo [2/4] Dang kiem tra thu vien Node.js (npm install)...
call npm install

echo.
echo [3/4] Dang cap ma QR cho cac thuoc trong Database (Giu nguyen 100%% thuoc da nhap)...
call node src/utils/seeder.js --if-empty

echo.
echo [4/4] Dang khoi chay Server tren PM2 va tao URL 4G/5G moi...
taskkill /F /IM cloudflared.exe >nul 2>nul
call npm install -g pm2
call pm2 delete hospital-qr-med >nul 2>nul
call pm2 flush >nul 2>nul
call pm2 start src/app.js --name "hospital-qr-med"
call pm2 save

echo.
echo ====================================================================
echo   HOAN TAT! SERVER DA CHAY VA GIU NGUYEN DU LIEU KHO THUOC!
echo   - Truy cap Mang Noi Bo (LAN): http://10.120.49.40:3000
echo   - Cong Quan Tri Kho Thuoc   : http://10.120.49.40:3000/admin
echo   - Mo http://10.120.49.40:3000 de xem Link 4G/5G Public HTTPS!
echo ====================================================================
echo Dang hien thi Log de ban xem ngay Link 4G/5G (Bam Ctrl+C de thoat xem log, server van chay ngam):
timeout /t 8 /nobreak >nul
call pm2 logs hospital-qr-med --lines 25
pause
