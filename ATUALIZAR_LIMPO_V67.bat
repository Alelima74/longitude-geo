@echo off
echo ==========================================
echo Longitude Geo Intelligence - V67 Enterprise
echo Atualizacao limpa
echo ==========================================

set DEST=D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14

echo.
echo Limpando arquivos principais antigos...
if exist "%DEST%\src" rmdir /S /Q "%DEST%\src"
if exist "%DEST%\public" rmdir /S /Q "%DEST%\public"
if exist "%DEST%\dist" rmdir /S /Q "%DEST%\dist"

echo.
echo Copiando V67 Enterprise...
xcopy "%~dp0*" "%DEST%\" /E /Y /I

cd /d "%DEST%"

echo.
echo Instalando dependencias...
call npm install

echo.
echo Gerando build...
call npm run build

echo.
echo Iniciando sistema...
call npm run dev
