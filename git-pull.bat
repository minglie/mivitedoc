@echo off
setlocal

echo ==================================
echo       Git Quick Pull Script
echo ==================================
echo.

:: Check if inside a Git repository
git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Not a Git repository!
    goto :END
)

:: Get current branch name
for /f %%i in ('git branch --show-current') do set branch=%%i
echo Current branch: %branch%
echo.

:: Pull latest changes
echo Pulling latest changes from origin/%branch%...
git pull origin %branch%
if %errorlevel% neq 0 (
    echo Pull failed! There might be conflicts to resolve.
    goto :END
)

echo.
echo Pull successful!
echo.

:END
endlocal
pause
    