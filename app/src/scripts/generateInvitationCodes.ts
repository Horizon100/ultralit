import PocketBase from 'pocketbase';
import { nanoid } from 'nanoid';
import readline from 'readline';

// Configuration
const CODE_LENGTH = 12;
const COUNT = process.argv[2] ? parseInt(process.argv[2]) : 10;

/**
 * Create readline interface for user input
 */
function createPrompt() {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
}

/**
 * Prompt for PocketBase URL
 */
async function getPocketBaseUrl(): Promise<string> {
	const defaultUrl = process.env.VITE_POCKETBASE_URL || 'http://172.104.188.44:80';
	const rl = createPrompt();

	return new Promise((resolve) => {
		rl.question(`PocketBase URL [${defaultUrl}]: `, (input) => {
			rl.close();
			resolve(input.trim() || defaultUrl);
		});
	});
}

/**
 * Prompt for user credentials with admin role
 */
async function getUserCredentials(): Promise<{ email: string; password: string }> {
	const rl = createPrompt();

	console.log('Enter credentials for a user with admin role:');
	return new Promise((resolve) => {
		rl.question('Email: ', (email) => {
			rl.question('Password: ', (password) => {
				rl.close();
				resolve({ email, password });
			});
		});
	});
}

/**
 * Generate a secure invitation code
 */
function generateInvitationCode(): string {
	return nanoid(CODE_LENGTH);
}

/**
 * Generate multiple invitation codes
 */
function generateInvitationCodes(count: number): string[] {
	return Array.from({ length: count }, () => generateInvitationCode());
}

/**
 * Create invitation codes in database
 */
async function createInvitationCodes(pb: PocketBase, count: number) {
	const codes = generateInvitationCodes(count);
	const results = [];

	for (const code of codes) {
		try {
			const data = await pb.collection('invitation_codes').create({
				code,
				used: false,
				createdAt: new Date().toISOString()
			});

			results.push(data);
		} catch (error) {
			console.error(
				'Error creating invitation code:',
				error instanceof Error ? error.message : error
			);
		}
	}

	return { codes, results };
}

async function main() {
	try {
		// Get PocketBase URL
		const baseUrl = await getPocketBaseUrl();
		console.log(`Using PocketBase URL: ${baseUrl}`);

		// Initialize PocketBase
		const pb = new PocketBase(baseUrl);

		// Get user credentials (user with admin role)
		const { email, password } = await getUserCredentials();

		if (!email || !password) {
			console.error('User credentials are required');
			process.exit(1);
		}

		// Authenticate as a user (not as PocketBase admin)
		try {
			console.log('Authenticating as user with admin role...');
			await pb.collection('users').authWithPassword(email, password);

			// Check if user has admin role
			const user = pb.authStore.model;
			if (!user || user.role !== 'admin') {
				console.error('The authenticated user does not have admin role. Access will be denied.');
				console.error('Current user role:', user?.role || 'unknown');
				process.exit(1);
			}

			console.log('Authentication successful. User has admin role.');
		} catch (error) {
			console.error(
				'Authentication failed:',
				error instanceof Error ? error.message : String(error)
			);
			if (error && typeof error === 'object' && 'status' in error && error.status === 400) {
				console.error('Invalid credentials or user does not exist.');
			}
			process.exit(1);
		}

		// Generate and store invitation codes
		console.log(`Generating ${COUNT} invitation codes...`);
		const { codes, results } = await createInvitationCodes(pb, COUNT);

		if (results.length === 0) {
			console.error('Failed to create any invitation codes. Check permissions.');
			process.exit(1);
		}

		console.log('Generated invitation codes:');
		codes.forEach((code) => console.log(` - ${code}`));
		console.log(`\n${results.length} codes have been saved to the database.`);
	} catch (error) {
		console.error(
			'Error generating invitation codes:',
			error instanceof Error ? error.message : String(error)
		);
		if (error && typeof error === 'object' && 'data' in error) {
			console.error('Error details:', error.data);
		}
		process.exit(1);
	}
}

main();
