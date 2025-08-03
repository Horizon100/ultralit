// src/routes/api/email/sync/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { getEmailAuthConfig, getEmailSyncConfig } from '$lib/server/email-config';
import { pb } from '$lib/server/pocketbase';
import type { EmailAccount } from '$lib/types/types.email';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { accountId } = await request.json();

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

		if (!account) {
			return json(
				{
					success: false,
					error: 'Account not found'
				},
				{ status: 404 }
			);
		}

		await pb.collection('email_accounts').update(accountId, {
			syncStatus: 'syncing',
			syncError: null
		});

		syncAccountInBackground(accountId);

		return json({
			success: true,
			data: { message: 'Sync started' }
		});
	} catch (error) {
		console.error('Failed to start sync:', error);
		return json(
			{
				success: false,
				error: 'Failed to start sync'
			},
			{ status: 500 }
		);
	}
};

async function syncAccountInBackground(accountId: string) {
	try {
		console.log('🔄 Starting background sync for account:', accountId);

		const accountData = await pb.collection('email_accounts').getOne(accountId);

		const account: EmailAccount = {
			id: accountData.id,
			userId: accountData.userId,
			email: accountData.email,
			provider: accountData.provider,
			accessToken: accountData.accessToken,
			refreshToken: accountData.refreshToken,
			tokenExpiry: new Date(accountData.tokenExpiry),
			isActive: accountData.isActive,
			lastSyncAt: accountData.lastSyncAt ? new Date(accountData.lastSyncAt) : new Date(),
			syncStatus: accountData.syncStatus,
			syncError: accountData.syncError,
			displayName: accountData.displayName,
			created: new Date(accountData.created),
			updated: new Date(accountData.updated)
		};

		const gmailService = GmailService.createWithConfig(getEmailAuthConfig(), getEmailSyncConfig());

		const messages = await gmailService.syncEmails(account);
		console.log(`✅ Synced ${messages.length} messages`);

		let savedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		for (let i = 0; i < messages.length; i++) {
			const message = messages[i];

			try {
				// Check if message already exists
				const existing = await pb
					.collection('email_messages')
					.getFirstListItem(`messageId = "${message.messageId}" && accountId = "${accountId}"`)
					.catch(() => null);

				if (!existing) {
					const truncateText = (text: string | null | undefined, maxLength = 4900): string => {
						if (!text) return '';
						if (text.length <= maxLength) return text;
						return text.substring(0, maxLength) + '\n\n[...truncated]';
					};

					const messageData = {
						accountId,
						messageId: message.messageId,
						threadId: message.threadId,
						subject: message.subject ? message.subject.substring(0, 500) : '(No Subject)',
						from: JSON.stringify(message.from || [{ email: 'unknown' }]),

						to: JSON.stringify(message.to || []),
						cc: JSON.stringify(message.cc || []),
						bcc: JSON.stringify(message.bcc || []),
						replyTo: JSON.stringify(message.replyTo || []),
						date: message.date,
						bodyText: truncateText(message.bodyText, 4900),
						bodyHtml: truncateText(message.bodyHtml, 4900),
						snippet: message.snippet ? message.snippet.substring(0, 500) : '',
						attachments: JSON.stringify(message.attachments || []),
						labels: JSON.stringify(message.labels || []),
						isRead: message.isRead || false,
						isStarred: message.isStarred || false,
						isImportant: message.isImportant || false
					};

					await pb.collection('email_messages').create(messageData);
					savedCount++;
					console.log(`💾 Saved message ${savedCount}: ${message.subject}`);
				} else {
					skippedCount++;
					console.log(`⏭️ Skipping existing message: ${message.subject}`);
				}

				// Rate limiting
				if (i % 5 === 0 && i > 0) {
					await sleep(500);
				} else {
					await sleep(150);
				}
			} catch (saveError: unknown) {
				errorCount++;

				const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error';
				const errorStatus =
					saveError && typeof saveError === 'object' && 'status' in saveError
						? (saveError as { status: number }).status
						: null;

				console.error(`❌ Failed to save message: ${message.subject}`, {
					error: errorMessage,
					status: errorStatus
				});

				if (errorStatus === 400) {
					console.log('⚠️ Validation error - skipping this message permanently');
				} else if (errorStatus === 429) {
					console.log('⏸️ Rate limited: waiting 3 seconds...');
					await sleep(3000);
				}
			}
		}

		console.log(
			`✅ Sync complete: ${savedCount} saved, ${skippedCount} skipped, ${errorCount} errors`
		);

		await pb.collection('email_accounts').update(accountId, {
			syncStatus: 'idle',
			lastSyncAt: new Date()
		});
	} catch (error) {
		console.error('❌ Background sync failed:', error);
		await pb.collection('email_accounts').update(accountId, {
			syncStatus: 'error',
			syncError: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
