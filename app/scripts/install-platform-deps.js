// scripts/install-platform-deps.js
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

function installPlatformDependencies() {
	const platform = os.platform();
	const arch = os.arch();

	console.log(`🔍 Detected platform: ${platform}-${arch}`);

	// Platform-specific esbuild packages
	const esbuildPackages = {
		'darwin-arm64': '@esbuild/darwin-arm64@0.21.5',
		'darwin-x64': '@esbuild/darwin-x64@0.21.5',
		'linux-x64': '@esbuild/linux-x64@0.21.5',
		'linux-arm64': '@esbuild/linux-arm64@0.21.5',
		'win32-x64': '@esbuild/win32-x64@0.21.5',
		'win32-ia32': '@esbuild/win32-ia32@0.21.5',
		'win32-arm64': '@esbuild/win32-arm64@0.21.5'
	};

	const platformKey = `${platform}-${arch}`;
	const requiredPackage = esbuildPackages[platformKey];

	if (!requiredPackage) {
		console.log(`⚠️  No specific esbuild package for ${platformKey}, using generic esbuild`);
		return;
	}

	try {
		// Check if the correct package is already installed
		const nodeModulesPath = path.join(process.cwd(), 'node_modules', requiredPackage.split('@')[1]);

		if (!fs.existsSync(nodeModulesPath)) {
			console.log(`📦 Installing ${requiredPackage}...`);
			execSync(`yarn add ${requiredPackage}`, { stdio: 'inherit' });
			console.log(`✅ Successfully installed ${requiredPackage}`);
		} else {
			console.log(`✅ ${requiredPackage} already installed`);
		}

		// Clean up wrong platform packages
		Object.entries(esbuildPackages).forEach(([key, pkg]) => {
			if (key !== platformKey) {
				const wrongPlatformPath = path.join(process.cwd(), 'node_modules', pkg.split('@')[1]);
				if (fs.existsSync(wrongPlatformPath)) {
					console.log(`🗑️  Removing wrong platform package: ${pkg.split('@')[1]}`);
					fs.rmSync(wrongPlatformPath, { recursive: true, force: true });
				}
			}
		});
	} catch (error) {
		console.error(`❌ Error installing platform dependencies:`, error.message);
	}
}

// Only run if this script is executed directly
if (require.main === module) {
	installPlatformDependencies();
}

module.exports = { installPlatformDependencies };
