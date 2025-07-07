@echo off
REM scripts/setup-dev.bat
REM Windows development setup script

echo 🚀 Setting up development environment for Windows...

REM Detect architecture
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set ARCH=x64
) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    set ARCH=arm64
) else (
    set ARCH=ia32
)

echo 📱 Platform: win32-%ARCH%

REM Backup yarn.lock
if exist yarn.lock (
    copy yarn.lock yarn.lock.win32
    echo 💾 Backed up yarn.lock to yarn.lock.win32
)

REM Install dependencies
echo 📦 Installing dependencies...
call yarn install

REM Install platform-specific esbuild
if "%ARCH%"=="x64" (
    echo 🪟 Installing esbuild for Windows x64...
    call yarn add @esbuild/win32-x64@0.21.5
) else if "%ARCH%"=="arm64" (
    echo 🪟 Installing esbuild for Windows ARM64...
    call yarn add @esbuild/win32-arm64@0.21.5
) else (
    echo 🪟 Installing esbuild for Windows 32-bit...
    call yarn add @esbuild/win32-ia32@0.21.5
)

echo ✅ Development environment setup complete!
echo 💡 Run 'yarn dev' to start the development server

REM scripts/dev-windows.bat
@echo off
echo 🪟 Starting development on Windows...
set NODE_ENV=development
call yarn install --check-files

REM Check and install correct esbuild version
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    if not exist "node_modules/@esbuild/win32-x64" (
        call yarn add @esbuild/win32-x64@0.21.5
    )
) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    if not exist "node_modules/@esbuild/win32-arm64" (
        call yarn add @esbuild/win32-arm64@0.21.5
    )
) else (
    if not exist "node_modules/@esbuild/win32-ia32" (
        call yarn add @esbuild/win32-ia32@0.21.5
    )
)

call yarn dev

REM scripts/sync-from-other-platform.bat
@echo off
echo 🔄 Syncing changes from other platforms...
call git pull origin main
call yarn install --check-files

REM Remove other platform packages
call yarn remove @esbuild/darwin-arm64 @esbuild/darwin-x64 @esbuild/linux-x64 @esbuild/linux-arm64 2>nul

REM Install Windows-specific packages
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    call yarn add @esbuild/win32-x64@0.21.5
) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    call yarn add @esbuild/win32-arm64@0.21.5
) else (
    call yarn add @esbuild/win32-ia32@0.21.5
)

echo ✅ Sync complete. Run 'scripts\dev-windows.bat' to start development

REM PowerShell version: scripts/setup-dev.ps1
# PowerShell script for Windows
Write-Host "🚀 Setting up development environment for Windows..." -ForegroundColor Green

# Detect architecture
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "AMD64") { "x64" } 
        elseif ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } 
        else { "ia32" }

Write-Host "📱 Platform: win32-$arch" -ForegroundColor Cyan

# Backup yarn.lock
if (Test-Path "yarn.lock") {
    Copy-Item "yarn.lock" "yarn.lock.win32"
    Write-Host "💾 Backed up yarn.lock to yarn.lock.win32" -ForegroundColor Yellow
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
yarn install

# Install platform-specific esbuild
switch ($arch) {
    "x64" {
        Write-Host "🪟 Installing esbuild for Windows x64..." -ForegroundColor Magenta
        yarn add "@esbuild/win32-x64@0.21.5"
    }
    "arm64" {
        Write-Host "🪟 Installing esbuild for Windows ARM64..." -ForegroundColor Magenta
        yarn add "@esbuild/win32-arm64@0.21.5"
    }
    "ia32" {
        Write-Host "🪟 Installing esbuild for Windows 32-bit..." -ForegroundColor Magenta
        yarn add "@esbuild/win32-ia32@0.21.5"
    }
}

Write-Host "✅ Development environment setup complete!" -ForegroundColor Green
Write-Host "💡 Run 'yarn dev' to start the development server" -ForegroundColor White