// src/scripts/audit-env.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../..');

// Improved patterns to match SvelteKit's env usage patterns
const ENV_PATTERNS = [
	/import\.meta\.env\.([A-Za-z0-9_]+)/g, // import.meta.env.VITE_*
	/process\.env\.([A-Za-z0-9_]+)/g, // process.env.*
	/\$env\/([a-z]+)\/([A-Za-z0-9_]+)/g, // $env/*/VARIABLE
	/env\.([A-Za-z0-9_]+)/g, // env.VARIABLE (if using an env object)
	/PUBLIC_([A-Za-z0-9_]+)/g, // PUBLIC_* variables
	/VITE_([A-Za-z0-9_]+)/g, // VITE_* variables
	/env:([A-Za-z0-9_]+)/g, // env:VARIABLE (in YAML or similar)
	/["']?([A-Za-z0-9_]+)["']?\s*:\s*process\.env\.([A-Za-z0-9_]+)/g // { API_KEY: process.env.API_KEY }
];

// Find all environment variable references in your code
function findEnvReferences() {
	const envRefs = new Set<string>();
	const fileTypes = ['.js', '.ts', '.svelte', '.json', '.cjs', '.mjs'];

	// Recursive function to scan directories
	function scanDir(dir: string) {
		const files = fs.readdirSync(dir, { withFileTypes: true });

		for (const file of files) {
			const fullPath = path.join(dir, file.name);

			if (file.isDirectory() && file.name !== 'node_modules' && file.name !== '.svelte-kit') {
				scanDir(fullPath);
			} else if (file.isFile() && fileTypes.includes(path.extname(file.name))) {
				const content = fs.readFileSync(fullPath, 'utf8');

				// Apply all regex patterns
				for (const pattern of ENV_PATTERNS) {
					const matches = content.matchAll(pattern);
					for (const match of matches) {
						if (match[1]) envRefs.add(match[1]);
						if (match[2]) envRefs.add(match[2]); // For patterns that have two capture groups
					}
				}

				// Special check for SvelteKit's standard $env imports
				if (content.includes('$env/static/public') || content.includes('$env/static/private')) {
					const importMatches = [
						...content.matchAll(/from\s+['"]?\$env\/static\/(?:public|private)['"]?\s*;?\s*$/gm),
						...content.matchAll(
							/import\s+{\s*([^}]+)\s*}\s+from\s+['"]?\$env\/static\/(?:public|private)['"]?/g
						)
					];

					for (const match of importMatches) {
						if (match[1]) {
							const vars = match[1].split(',').map((v) => v.trim());
							vars.forEach((v) => {
								if (v) envRefs.add(v);
							});
						}
					}
				}
			}
		}
	}

	scanDir(path.join(rootDir, 'src'));
	return Array.from(envRefs).sort();
}

// Check which env vars are defined in various files
function checkDefinedEnvVars() {
	const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];

	const definedVars: Record<string, string[]> = {};

	for (const file of envFiles) {
		const filePath = path.join(rootDir, file);
		if (fs.existsSync(filePath)) {
			definedVars[file] = [];
			const content = fs.readFileSync(filePath, 'utf8');
			const lines = content.split('\n');

			for (const line of lines) {
				if (line.trim() && !line.startsWith('#')) {
					const match = line.match(/^([A-Za-z0-9_]+)=/);
					if (match && match[1]) {
						definedVars[file].push(match[1]);
					}
				}
			}
		}
	}

	return definedVars;
}

// Check Vite config for env prefixes
function checkViteConfig() {
	const configFiles = ['vite.config.js', 'vite.config.ts', 'svelte.config.js'];

	for (const file of configFiles) {
		const filePath = path.join(rootDir, file);
		if (fs.existsSync(filePath)) {
			const content = fs.readFileSync(filePath, 'utf8');

			// Look for envPrefix settings
			const envPrefixMatch = content.match(/envPrefix\s*:\s*['"]([^'"]+)['"]/);
			if (envPrefixMatch && envPrefixMatch[1]) {
				console.log(`\nCustom environment variable prefix found in ${file}: ${envPrefixMatch[1]}`);
				console.log('Make sure your .env files use this prefix for client-side variables.');
			}
		}
	}
}

// Main audit function
function auditEnvVars() {
	const referencedVars = findEnvReferences();
	const definedVars = checkDefinedEnvVars();

	console.log('=== ENVIRONMENT VARIABLES AUDIT ===\n');

	console.log('Environment Variables Referenced in Code:');
	if (referencedVars.length > 0) {
		console.log(referencedVars.join('\n'));
	} else {
		console.log('No environment variables found in code.');
	}
	console.log('\n');

	console.log('Environment Variables Defined in Files:');
	if (Object.keys(definedVars).length > 0) {
		Object.entries(definedVars).forEach(([file, vars]) => {
			console.log(`\n${file}:`);
			if (vars.length > 0) {
				console.log(vars.join('\n'));
			} else {
				console.log('(File exists but no variables defined)');
			}
		});
	} else {
		console.log('No .env files found.');
	}

	// Check Vite config
	checkViteConfig();

	console.log('\n=== POTENTIAL ISSUES ===');

	// Find vars referenced but not defined anywhere
	const allDefinedVars = new Set<string>();
	Object.values(definedVars).forEach((vars) => {
		vars.forEach((v) => allDefinedVars.add(v));
	});

	const undefinedVars = referencedVars.filter((v) => !allDefinedVars.has(v));
	if (undefinedVars.length > 0) {
		console.log('\nReferenced but not defined in any .env file:');
		console.log(undefinedVars.join('\n'));
	}

	// Find vars defined in dev but not prod
	if (definedVars['.env.development'] && definedVars['.env.production']) {
		const devOnly = definedVars['.env.development'].filter(
			(v) => !definedVars['.env.production'].includes(v)
		);

		if (devOnly.length > 0) {
			console.log('\nDefined in development but not in production:');
			console.log(devOnly.join('\n'));
		}
	}

	// If no issues found
	if (
		undefinedVars.length === 0 &&
		(!definedVars['.env.development'] ||
			!definedVars['.env.production'] ||
			!definedVars['.env.development'].filter((v) => !definedVars['.env.production'].includes(v))
				.length)
	) {
		console.log('\nNo issues found!');
	}
}

auditEnvVars();
