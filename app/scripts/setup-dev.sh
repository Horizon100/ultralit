#!/bin/bash

# scripts/setup-dev.sh
# Cross-platform development setup script

echo "🚀 Setting up development environment..."

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="darwin"
    ARCH=$(uname -m)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
    ARCH=$(uname -m)
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    PLATFORM="win32"
    # For Windows, detect architecture differently
    if [[ "$PROCESSOR_ARCHITECTURE" == "AMD64" ]] || [[ "$PROCESSOR_ARCHITEW6432" == "AMD64" ]]; then
        ARCH="x64"
    elif [[ "$PROCESSOR_ARCHITECTURE" == "ARM64" ]]; then
        ARCH="arm64"
    else
        ARCH="ia32"
    fi
else
    echo "❌ Unsupported platform: $OSTYPE"
    exit 1
fi

echo "📱 Platform: $PLATFORM-$ARCH"

# Create platform-specific yarn.lock backup
if [ -f "yarn.lock" ]; then
    cp yarn.lock "yarn.lock.$PLATFORM"
    echo "💾 Backed up yarn.lock to yarn.lock.$PLATFORM"
fi

# Install dependencies
echo "📦 Installing dependencies..."
yarn install

# Install platform-specific esbuild
case "$PLATFORM-$ARCH" in
    "darwin-arm64")
        echo "🍎 Installing esbuild for macOS ARM64..."
        yarn add @esbuild/darwin-arm64@0.21.5
        ;;
    "darwin-x86_64")
        echo "🍎 Installing esbuild for macOS x64..."
        yarn add @esbuild/darwin-x64@0.21.5
        ;;
    "linux-x86_64")
        echo "🐧 Installing esbuild for Linux x64..."
        yarn add @esbuild/linux-x64@0.21.5
        ;;
    "linux-aarch64")
        echo "🐧 Installing esbuild for Linux ARM64..."
        yarn add @esbuild/linux-arm64@0.21.5
        ;;
    "win32-x64")
        echo "🪟 Installing esbuild for Windows x64..."
        yarn add @esbuild/win32-x64@0.21.5
        ;;
    "win32-arm64")
        echo "🪟 Installing esbuild for Windows ARM64..."
        yarn add @esbuild/win32-arm64@0.21.5
        ;;
    "win32-ia32")
        echo "🪟 Installing esbuild for Windows 32-bit..."
        yarn add @esbuild/win32-ia32@0.21.5
        ;;
    *)
        echo "⚠️  Unknown architecture: $ARCH, using generic esbuild"
        ;;
esac

echo "✅ Development environment setup complete!"
echo "💡 Run 'yarn dev' to start the development server"

# For your specific case, create separate scripts:

# scripts/dev-mac.sh
#!/bin/bash
echo "🍎 Starting development on macOS..."
export NODE_ENV=development
yarn install --check-files
if [ ! -d "node_modules/@esbuild/darwin-arm64" ]; then
    yarn add @esbuild/darwin-arm64@0.21.5
fi
yarn dev

# scripts/dev-linux.sh  
#!/bin/bash
echo "🐧 Starting development on Linux..."
export NODE_ENV=development
yarn install --check-files
if [ ! -d "node_modules/@esbuild/linux-x64" ]; then
    yarn add @esbuild/linux-x64@0.21.5
fi
yarn dev

# scripts/sync-from-mac.sh
#!/bin/bash
echo "🔄 Syncing changes from macOS..."
git pull origin main
yarn install --check-files
# Remove macOS-specific packages
yarn remove @esbuild/darwin-arm64 2>/dev/null || true
# Install Linux-specific packages
yarn add @esbuild/linux-x64@0.21.5
echo "✅ Sync complete. Run './scripts/dev-linux.sh' to start development"

# scripts/sync-to-mac.sh
#!/bin/bash
echo "🔄 Preparing changes for macOS..."
git add .
git commit -m "Update from Linux