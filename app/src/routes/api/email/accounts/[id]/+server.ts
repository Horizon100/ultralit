// src/routes/api/email/accounts/[id]/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';

// GET /api/email/accounts/[id] - Get specific email account
export const GET: RequestHandler = async ({ params }) => {
	try {
		const accountId = params.id;

		if (!accountId) {
			return json(
				{
					success: false,
					error: 'Account ID is required'
				},
				{ status: 400 }
			);
		}

		const account = await pb.collection('email_accounts').getOne(accountId);

		return json({
			success: true,
			data: account
		});
	} catch (error) {
		console.error('Failed to fetch email account:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch email account'
			},
			{ status: 500 }
		);
	}
};

// PUT /api/email/accounts/[id] - Update email account
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const accountId = params.id;
		const updates = await request.json();

		if (!accountId) {
			return json(
				{
					success: false,
					error: 'Account ID is required'
				},
				{ status: 400 }
			);
		}

		const account = await pb.collection('email_accounts').update(accountId, updates);

		return json({
			success: true,
			data: account
		});
	} catch (error) {
		console.error('Failed to update email account:', error);
		return json(
			{
				success: false,
				error: 'Failed to update email account'
			},
			{ status: 500 }
		);
	}
};

// DELETE /api/email/accounts/[id] - Delete email account
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const accountId = params.id;

		if (!accountId) {
			return json(
				{
					success: false,
					error: 'Account ID is required'
				},
				{ status: 400 }
			);
		}

		await pb.collection('email_accounts').delete(accountId);

		// Also delete related messages
		await pb.collection('email_messages').delete(`accountId = "${accountId}"`);

		return json({
			success: true
		});
	} catch (error) {
		console.error('Failed to delete email account:', error);
		return json(
			{
				success: false,
				error: 'Failed to delete email account'
			},
			{ status: 500 }
		);
	}
};
