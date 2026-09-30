@echo off
title Perbarui Media - Belajar Yuk
echo.
echo Memperbarui daftar suara dan gambar...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Perbarui-Media.ps1"
echo.
pause
