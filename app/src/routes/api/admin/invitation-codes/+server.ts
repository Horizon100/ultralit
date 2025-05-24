import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import {
	createInvitationCodes,
	getUnusedInvitationCodes,
	getUsedInvitationCodes
} from '$lib/server/utils/invitationCodesAdmin';

// GET: Retrieve invitation codes (used or unused)
export const GET: RequestHandler = async ({ url, request, locals }) => {
	// Check if user is admin
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	/*
	 * Verify admin token (implement proper admin validation)
	 * This is a placeholder - implement your actual admin validation
	 */
	const token = authHeader.split('Bearer ')[1];
	const isAdmin = await validateAdminToken(token);

	if (!isAdmin) {
		return json({ error: 'Forbidden - Admin access required' }, { status: 403 });
	}

	// Get query parameters
	const status = url.searchParams.get('status') || 'unused';

	try {
		let codes;
		if (status === 'used') {
			codes = await getUsedInvitationCodes(pb);
		} else {
			codes = await getUnusedInvitationCodes(pb);
		}

		return json({ codes });
	} catch (error) {
		console.error('Error fetching invitation codes:', error);
		return json({ error: 'Failed to fetch invitation codes' }, { status: 500 });
	}
};

// POST: Create new invitation codes
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check if user is admin
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	/*
	 * Verify admin token (implement proper admin validation)
	 * This is a placeholder - implement your actual admin validation
	 */
	const token = authHeader.split('Bearer ')[1];
	const isAdmin = await validateAdminToken(token);

	if (!isAdmin) {
		return json({ error: 'Forbidden - Admin access required' }, { status: 403 });
	}

	try {
		const data = await request.json();
		const count = data.count || 10;

		// Validate count is reasonable
		if (count < 1 || count > 100) {
			return json({ error: 'Count must be between 1 and 100' }, { status: 400 });
		}

		// Generate codes
		const codes = await createInvitationCodes(pb, count);

		return json({
			message: `Successfully generated ${codes.length} invitation codes`,
			codes
		});
	} catch (error) {
		console.error('Error generating invitation codes:', error);
		return json({ error: 'Failed to generate invitation codes' }, { status: 500 });
	}
};

/*
 * Helper function to validate admin token
 * Replace this with your actual admin validation logic
 */
async function validateAdminToken(token: string): Promise<boolean> {
	try {
		/*
		 * This is a placeholder - implement your actual admin validation
		 * For example, verify the token against your admin authentication system
		 * or check if the user has admin role in your database
		 */

		/*
		 * Example implementation:
		 * const result = await pb.admins.authWithToken(token);
		 * return !!result;
		 */

		// For now, just return false to be safe
		return false;
	} catch (error) {
		console.error('Error validating admin token:', error);
		return false;
	}
}
