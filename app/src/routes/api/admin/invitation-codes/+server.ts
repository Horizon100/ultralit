import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, validateAdminToken } from '$lib/server/pocketbase'; // or '$lib/server/pocketbase'
import {
	createInvitationCodes,
	getUnusedInvitationCodes,
	getUsedInvitationCodes
} from '$lib/server/utils/invitationCodesAdmin';
import { apiTryCatch } from '$lib/utils/errorUtils';

// GET: Retrieve invitation codes (used or unused)
export const GET: RequestHandler = async ({ url, request, locals }) =>
	apiTryCatch(async () => {
		// Check if user is admin
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			throw new Error('Unauthorized');
		}

		const token = authHeader.split('Bearer ')[1];
		const isAdmin = await validateAdminToken(token);

		if (!isAdmin) {
			throw new Error('Forbidden - Admin access required');
		}

		// Get query parameters
		const status = url.searchParams.get('status') || 'unused';

		let codes;
		if (status === 'used') {
			codes = await getUsedInvitationCodes(pb);
		} else {
			codes = await getUnusedInvitationCodes(pb);
		}

		return { codes };
	}, 'Failed to fetch invitation codes');

// POST: Create new invitation codes
export const POST: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		// Check if user is admin
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			throw new Error('Unauthorized');
		}

		const token = authHeader.split('Bearer ')[1];
		const isAdmin = await validateAdminToken(token);

		if (!isAdmin) {
			throw new Error('Forbidden - Admin access required');
		}

		const data = await request.json();
		const count = data.count || 10;

		// Validate count is reasonable
		if (count < 1 || count > 100) {
			throw new Error('Count must be between 1 and 100');
		}

		// Generate codes
		const codes = await createInvitationCodes(pb, count);

		return {
			message: `Successfully generated ${codes.length} invitation codes`,
			codes
		};
	}, 'Failed to generate invitation codes');
