@echo off
title SIM-BAT - Gestion BTP
cd /d "%~dp0"
echo.
echo  ============================================
echo    SIM-BAT - Gestion d'entreprise BTP
echo  ============================================
echo.
echo  Demarrage du serveur... (ne fermez pas cette fenetre)
echo  L'application va s'ouvrir dans votre navigateur.
echo.
start /b cmd /c "timeout /t 4 >nul && start http://localhost:4000"
call npm start
pause
