// src/routes/api/email/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { getEmailAuthConfig, getEmailSyncConfig } from '$lib/server/email-config';
import { pb } from '$lib/server/pocketbase';
import type { EmailAccountSetup } from '$lib/types/types.email';

// GET /api/email - Get email accounts for user
export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');

		if (!userId) {
			return json(
				{
					success: false,
					error: 'User ID is required'
				},
				{ status: 400 }
			);
		}

		// Get email accounts from PocketBase
		const accounts = await pb.collection('email_accounts').getFullList({
			filter: `userId = "${userId}"`,
			sort: '-created'
		});

		return json({
			success: true,
			data: accounts
		});
	} catch (error) {
		console.error('Failed to fetch email accounts:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch email accounts'
			},
			{ status: 500 }
		);
	}
};

// POST /api/email - Add new email account
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, provider, email, authCode }: EmailAccountSetup & { userId: string } =
			await request.json();

		if (!userId || !provider || !email) {
			return json(
				{
					success: false,
					error: 'Missing required fields'
				},
				{ status: 400 }
			);
		}

		const authConfig = getEmailAuthConfig();
		const syncConfig = getEmailSyncConfig();
		const gmailService = GmailService.createWithConfig(authConfig, syncConfig);

		// Exchange auth code for tokens
		let tokens: { access_token?: string; refresh_token?: string; expiry_date?: number } | undefined;
		if (authCode) {
			tokens = await gmailService.exchangeCodeForTokens(authCode);
		} else {
			// Return auth URL for user to get code
			const authUrl = gmailService.getAuthUrl();
			return json(
				{
					success: false,
					error: 'Authorization required',
					data: { authUrl }
				},
				{ status: 401 }
			);
		}

		if (!tokens?.access_token || !tokens?.refresh_token) {
			return json(
				{
					success: false,
					error: 'Failed to obtain valid tokens'
				},
				{ status: 400 }
			);
		}

		// Create email account record
		const accountData = {
			userId,
			email,
			provider,
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			tokenExpiry: new Date(tokens.expiry_date || Date.now() + 3600000),
			isActive: true,
			lastSyncAt: new Date(),
			syncStatus: 'idle' as const,
			displayName: email
		};

		const account = await pb.collection('email_accounts').create(accountData);

		return json({
			success: true,
			data: account
		});
	} catch (error) {
		console.error('Failed to add email account:', error);
		return json(
			{
				success: false,
				error: 'Failed to add email account'
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

		// Delete account and related data
		await pb.collection('email_accounts').delete(accountId);

		// Also delete related messages and attachments
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
