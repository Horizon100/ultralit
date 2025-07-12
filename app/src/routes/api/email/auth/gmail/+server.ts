// src/routes/api/email/auth/gmail/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { getEmailAuthConfig, getEmailSyncConfig } from '$lib/server/email-config';

export const GET: RequestHandler = async () => {
	console.log('🔍 Environment check:', {
		GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID
			? `${process.env.GMAIL_CLIENT_ID.substring(0, 10)}...`
			: 'MISSING',
		GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ? 'SET' : 'MISSING',
		GMAIL_REDIRECT_URI: process.env.GMAIL_REDIRECT_URI || 'MISSING'
	});
	try {
		const authConfig = getEmailAuthConfig();
		console.log('📧 Parsed config:', {
			clientId: authConfig.clientId.substring(0, 10) + '...',
			redirectUri: authConfig.redirectUri
		});
		const syncConfig = getEmailSyncConfig();
		const gmailService = GmailService.createWithConfig(authConfig, syncConfig);
		const authUrl = gmailService.getAuthUrl();

		return json({
			success: true,
			data: { authUrl }
		});
	} catch (error) {
		console.error('Failed to get Gmail auth URL:', error);
		return json(
			{
				success: false,
				error: 'Failed to get authorization URL'
			},
			{ status: 500 }
		);
	}
};
