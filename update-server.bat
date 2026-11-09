@echo off
setlocal EnableDelayedExpansion
title Cap Nhat Phien Ban Moi - Giu Nguyen Database & Tao URL 4G/5G Moi
echo ====================================================================
echo   CAP NHAT PHIEN BAN MOI (KHO THUOC & IN MA QR NHO DAN HOP THUOC)
echo   - GIU NGUYEN 100%% DATABASE CAC LOAI THUOC DA NHAP
echo   - KHOI TAO URL 4G/5G CLOUDFLARE MOI ON DINH (HTTP/2)
echo ====================================================================
echo.
cd /d "%~dp0"

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files\Git\cmd\git.exe" set "PATH=C:\Program Files\Git\cmd;%PATH%"

if exist ".git" (
    echo [0/3] Dang tai code moi nhat tu GitHub ve Server...
    git fetch origin main >nul 2>nul
    git reset --hard origin/main >nul 2>nul
    echo [OK] Da cap nhat code moi nhat tu GitHub.
    echo.
)

echo [1/3] Cau hinh file .env...
(
echo PORT=3000
echo MONGODB_URI=mongodb://127.0.0.1:27017/hospital_qr_medication_db
echo BASE_QR_URL=http://10.120.49.40:3000/q
) > .env
echo [OK] Da cap nhat file .env.

echo.
echo [2/3] Dong bo va cap ma QR rieng cho toan bo thuoc trong Database (GIU NGUYEN 100%% DU LIEU)...
call node src/utils/seeder.js

echo.
echo [3/3] Khoi chay lai Server va tao URL Cloudflare 4G/5G moi...
taskkill /F /IM cloudflared.exe >nul 2>nul
where pm2 >nul 2>nul
if errorlevel 1 (
    taskkill /F /IM node.exe >nul 2>nul
    start "Hospital QR Med Server" cmd /k "node src/app.js"
) else (
    call pm2 delete hospital-qr-med >nul 2>nul
    call pm2 flush >nul 2>nul
    call pm2 start src/app.js --name "hospital-qr-med"
    call pm2 save
    echo.
    echo Dang doi 8 giay de Cloudflare dang ky URL 4G/5G moi...
    timeout /t 8 /nobreak >nul
    call pm2 logs hospital-qr-med --lines 25 --nostream
)

echo.
echo ====================================================================
echo   HOAN TAT! Mo http://10.120.49.40:3000 de xem va bam vao URL 4G/5G moi!
echo ====================================================================
pause
