@echo off
setlocal
title TagStore Quick Start

echo ===================================
echo  TagStore Quick Start Script
echo ===================================
echo.
echo IMPORTANT: Please ensure you run this script from the project root directory
echo            where the package.json file is located (Tag-Store).
echo.

echo Checking prerequisites...
echo -----------------------------------

REM Check for Node.js
echo Checking for Node.js...
where node > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not found in your system PATH.
    echo Please install Node.js from https://nodejs.org/ and ensure it's added to your PATH.
    goto Fail
) else (
    for /f "tokens=* usebackq" %%v in (`node -v`) do set NODE_VERSION=%%v
    echo [OK] Node.js found (Version: %NODE_VERSION%)
)

REM Check for npm
echo Checking for npm...
where npm > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed or not found in your system PATH.
    echo npm usually comes with Node.js. Try reinstalling Node.js from https://nodejs.org/
    goto Fail
) else (
    for /f "tokens=* usebackq" %%v in (`npm -v`) do set NPM_VERSION=%%v
    echo [OK] npm found (Version: %NPM_VERSION%)
)

REM Check if node_modules exists (basic check for dependencies installed)
echo Checking for installed dependencies (node_modules folder)...
if not exist ".\node_modules" (
    echo [WARNING] node_modules folder not found.
    echo It seems dependencies are not installed. Please run 'npm install' first.
    echo Attempting to run 'npm install' automatically...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] 'npm install' failed. Please check the errors above and fix them.
        goto Fail
    ) else (
        echo [OK] 'npm install' completed successfully.
    )
) else (
    echo [OK] node_modules folder found.
)

echo -----------------------------------
echo All prerequisites seem to be met.
echo.

echo Starting the Vite development server (npm run dev)...
echo To stop the server, press Ctrl+C in this window.
echo.

REM Run the development server
npm run dev

REM The script will likely stay here until the server is stopped (Ctrl+C)
echo.
echo Development server process finished or was stopped.
goto End

:Fail
echo.
echo Script aborted due to errors.

:End
echo.
echo Script finished. Press any key to close this window.
endlocal
pause > nul 