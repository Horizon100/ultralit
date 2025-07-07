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
    *)
        echo "⚠️  Unknown architecture: $ARCH, using generic esbuild"
        ;;
esac

echo "✅ Development environment setup complete!"
echo "💡 Run 'yarn dev' to start the development server"