// src/routes/api/email/accounts/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { getEmailAuthConfig, getEmailSyncConfig } from '$lib/server/email-config';

// GET /api/email/accounts - Get all email accounts for user
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
// Add this POST method after your GET method
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, provider, email, authCode } = await request.json();

		if (!userId || !provider || !email) {
			return json(
				{
					success: false,
					error: 'Missing required fields: userId, provider, email'
				},
				{ status: 400 }
			);
		}

		if (!authCode) {
			return json(
				{
					success: false,
					error: 'Authorization code is required'
				},
				{ status: 400 }
			);
		}

		// Exchange auth code for tokens
		const gmailService = GmailService.createWithConfig(getEmailAuthConfig(), getEmailSyncConfig());

		let tokens;
		try {
			tokens = await gmailService.exchangeCodeForTokens(authCode);
		} catch (error) {
			console.error('Token exchange failed:', error);
			return json(
				{
					success: false,
					error: 'Invalid authorization code'
				},
				{ status: 400 }
			);
		}

		if (!tokens.access_token || !tokens.refresh_token) {
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
			syncStatus: 'idle'
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
