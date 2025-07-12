// src/lib/server/email-config.ts
import { env } from '$env/dynamic/private';
import type { EmailAuthConfig, EmailSyncConfig } from '$lib/types/types.email';

export const getEmailAuthConfig = (): EmailAuthConfig => {
	const clientId = env.GMAIL_CLIENT_ID || '';
	const clientSecret = env.GMAIL_CLIENT_SECRET || '';
	const redirectUri = env.GMAIL_REDIRECT_URI || 'http://localhost:5173/auth/gmail/callback';

	console.log('🔍 Loading Gmail config:', {
		clientId: clientId ? `${clientId.substring(0, 10)}...` : 'EMPTY',
		clientSecret: clientSecret ? 'SET' : 'EMPTY',
		redirectUri
	});

	return {
		clientId,
		clientSecret,
		redirectUri,
		scopes: [
			'https://www.googleapis.com/auth/gmail.readonly',
			'https://www.googleapis.com/auth/gmail.send',
			'https://www.googleapis.com/auth/gmail.modify',
			'https://www.googleapis.com/auth/gmail.compose',
			'https://www.googleapis.com/auth/userinfo.email',
			'https://www.googleapis.com/auth/userinfo.profile'
		]
	};
};

export const getEmailSyncConfig = (): EmailSyncConfig => {
	return {
		batchSize: parseInt(env.EMAIL_BATCH_SIZE || '50'),
		syncInterval: parseInt(env.EMAIL_SYNC_INTERVAL || '15'),
		maxHistoryDays: parseInt(env.EMAIL_MAX_HISTORY_DAYS || '30'),
		downloadAttachments: env.EMAIL_DOWNLOAD_ATTACHMENTS === 'true',
		processWithAI: env.EMAIL_PROCESS_WITH_AI === 'true'
	};
};
