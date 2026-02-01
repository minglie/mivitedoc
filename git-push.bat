@echo off
setlocal

echo ==================================
echo       Git Quick Push Script
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

:: Add all changes
echo Adding all changes to staging area...
git add .
if %errorlevel% neq 0 (
    echo Failed to add changes!
    goto :END
)

:: Get commit message
set /p message="Enter commit message (default: Auto commit): "
if "%message%"=="" set message=Auto commit

:: Commit changes
echo Committing changes with message: "%message%"
git commit -m "%message%"
if %errorlevel% neq 0 (
    echo Commit failed! No changes to commit or other errors.
    goto :END
)

:: Push to remote
echo Pushing to origin/%branch%...
git push origin %branch%
if %errorlevel% neq 0 (
    echo Push failed! Check your branch and remote settings.
    goto :END
)

echo.
echo Push successful!
echo.

:END
endlocal
pause
    