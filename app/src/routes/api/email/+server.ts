// src/routes/api/email/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { getEmailAuthConfig, getEmailSyncConfig } from '$lib/server/email-config';
import { pb } from '$lib/server/pocketbase';
import type { EmailAccountSetup } from '$lib/types/types.email';
import type { Credentials } from 'google-auth-library';

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
		let tokens: Credentials | undefined;
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

		// Safely extract token values, handling null values
		const accessToken = tokens?.access_token || null;
		const refreshToken = tokens?.refresh_token || null;
		const expiryDate = tokens?.expiry_date || null;

		if (!accessToken || !refreshToken) {
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
			accessToken,
			refreshToken,
			tokenExpiry: new Date(expiryDate || Date.now() + 3600000),
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
