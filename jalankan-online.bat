@echo off
REM ============================================================
REM  Bejo Stiker POS - Jalankan aplikasi + akses dari internet
REM  Klik dua kali file ini untuk memulai.
REM ============================================================
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0jalankan-online.ps1"
