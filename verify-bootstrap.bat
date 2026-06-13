@echo off
REM LeadEngine Bootstrap Verification Script (Windows)
REM Verifies all Phase 0 setup is complete

setlocal enabledelayedexpansion

echo.
echo 🔍 LeadEngine Bootstrap Verification
echo ====================================
echo.

set FAILED=0

REM Check directories
echo Checking directory structure...
if exist "frontend\" (
    echo [OK] frontend\
) else (
    echo [FAIL] frontend\
    set FAILED=1
)
if exist "backend\" (
    echo [OK] backend\
) else (
    echo [FAIL] backend\
    set FAILED=1
)
if exist "workers\" (
    echo [OK] workers\
) else (
    echo [FAIL] workers\
    set FAILED=1
)
if exist "docs\" (
    echo [OK] docs\
) else (
    echo [FAIL] docs\
    set FAILED=1
)
echo.

REM Check configuration files
echo Checking configuration files...
if exist ".prettierrc" (
    echo [OK] .prettierrc
) else (
    echo [FAIL] .prettierrc
    set FAILED=1
)
if exist ".gitignore" (
    echo [OK] .gitignore
) else (
    echo [FAIL] .gitignore
    set FAILED=1
)
if exist "package.json" (
    echo [OK] package.json
) else (
    echo [FAIL] package.json
    set FAILED=1
)
if exist "docker-compose.yml" (
    echo [OK] docker-compose.yml
) else (
    echo [FAIL] docker-compose.yml
    set FAILED=1
)
echo.

REM Check frontend
echo Checking frontend...
if exist "frontend\package.json" echo [OK] frontend\package.json
if exist "frontend\vite.config.ts" echo [OK] frontend\vite.config.ts
if exist "frontend\src\App.tsx" echo [OK] frontend\src\App.tsx
echo.

REM Check backend
echo Checking backend...
if exist "backend\package.json" echo [OK] backend\package.json
if exist "backend\src\index.ts" echo [OK] backend\src\index.ts
echo.

REM Check workers
echo Checking workers...
if exist "workers\requirements.txt" echo [OK] workers\requirements.txt
if exist "workers\src\worker.py" echo [OK] workers\src\worker.py
echo.

REM Check documentation
echo Checking documentation...
if exist "README.md" echo [OK] README.md
if exist "docs\ARCHITECTURE.md" echo [OK] docs\ARCHITECTURE.md
if exist "CONTRIBUTING.md" echo [OK] CONTRIBUTING.md
echo.

if !FAILED! equ 0 (
    echo ====================================
    echo Phase 0: Bootstrap Complete!
    echo.
    echo Next Steps:
    echo 1. Copy environment files
    echo 2. Install dependencies: npm install
    echo 3. Start Docker: npm run docker:up
    echo 4. Run development servers
    echo.
) else (
    echo Some checks failed. Please verify setup.
)

endlocal
