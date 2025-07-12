// src/routes/api/email/messages/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { getEmailAuthConfig, getEmailSyncConfig } from '$lib/server/email-config';
import { pb } from '$lib/server/pocketbase';
import type { EmailAddress } from '$lib/types/types.email';

// GET /api/email/messages - Get messages with filtering
export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		console.log('📬 Loading messages for user:', userId);

		if (!userId) {
			return json(
				{
					success: false,
					error: 'User ID is required'
				},
				{ status: 400 }
			);
		}

		// Build filter query for PocketBase
		let filter = `accountId.userId = "${userId}"`;

		const accountId = url.searchParams.get('accountId');
		if (accountId) {
			filter += ` && accountId = "${accountId}"`;
		}

		console.log('🔍 Filter query:', filter);

		// Get messages from PocketBase
		const result = await pb.collection('email_messages').getList(1, 50, {
			filter,
			sort: '-date',
			expand: 'accountId,aiAnalysis'
		});

		console.log(`📨 Found ${result.items.length} messages`);

		const safeJsonParse = (value: any, fallback: any = []) => {
			// If it's already an object/array, return it directly
			if (typeof value === 'object' && value !== null) {
				return value;
			}

			// If it's a string, try to parse it
			if (typeof value === 'string') {
				if (value === '' || value === 'null' || value === 'undefined') {
					return fallback;
				}
				try {
					return JSON.parse(value);
				} catch (error) {
					console.warn('Failed to parse JSON field:', value, error);
					return fallback;
				}
			}

			// For any other type, return fallback
			return fallback;
		};

		const cleanEmailAddress = (emailAddr: any): EmailAddress => {
			if (!emailAddr) return { email: 'unknown' };

			// Handle case where it's already a proper EmailAddress object
			if (typeof emailAddr === 'object' && emailAddr.email) {
				return {
					name: emailAddr.name ? emailAddr.name.replace(/^"|"$/g, '') : undefined,
					email: emailAddr.email || 'unknown'
				};
			}

			// Handle case where it's a string (just email)
			if (typeof emailAddr === 'string') {
				return { email: emailAddr };
			}

			return { email: 'unknown' };
		};

		// Helper function to clean email address arrays
		const cleanEmailAddresses = (emailArray: any): EmailAddress[] => {
			if (!Array.isArray(emailArray)) return [];
			return emailArray.map(cleanEmailAddress);
		};
		// Then in your message parsing:
		const parsedMessages = result.items.map((message, index) => {
			try {
				return {
					...message,
					attachments: safeJsonParse(message.attachments, []),
					to: cleanEmailAddresses(safeJsonParse(message.to, [])),
					cc: cleanEmailAddresses(safeJsonParse(message.cc, [])),
					bcc: cleanEmailAddresses(safeJsonParse(message.bcc, [])),
					replyTo: cleanEmailAddresses(safeJsonParse(message.replyTo, [])),
					labels: safeJsonParse(message.labels, []),
					from: cleanEmailAddress(safeJsonParse(message.from, { email: 'unknown' })),
					date: new Date(message.date),
					created: new Date(message.created),
					updated: new Date(message.updated)
				};
			} catch (error) {
				console.error(`❌ Failed to parse message ${index}:`, error);
				console.error('Message data:', {
					id: message.id,
					subject: message.subject,
					from: message.from,
					to: message.to
				});
				// Return a basic version of the message if parsing fails
				return {
					...message,
					attachments: [],
					to: [],
					cc: [],
					bcc: [],
					replyTo: [],
					labels: [],
					from: { email: 'unknown' },
					date: new Date(message.date),
					created: new Date(message.created),
					updated: new Date(message.updated)
				};
			}
		});
		return json({
			success: true,
			data: parsedMessages,
			pagination: {
				total: result.totalItems,
				page: result.page,
				limit: result.perPage,
				hasMore: result.page < result.totalPages
			}
		});
	} catch (error) {
		console.error('❌ Failed to fetch messages:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch messages'
			},
			{ status: 500 }
		);
	}
};

// POST /api/email/messages - Sync new messages
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { accountId, forceSync = false } = await request.json();

		if (!accountId) {
			return json(
				{
					success: false,
					error: 'Account ID is required'
				},
				{ status: 400 }
			);
		}

		// Get account details
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

		const authConfig = getEmailAuthConfig();
		const syncConfig = getEmailSyncConfig();
		const gmailService = GmailService.createWithConfig(authConfig, syncConfig);
		gmailService.setCredentials(account as any);

		// Sync messages
		const messages = await gmailService.syncEmails(account as any, (progress) => {
			// Could implement WebSocket for real-time progress updates
			console.log(`Sync progress: ${progress}%`);
		});

		// Store messages in PocketBase
		const savedMessages = [];
		for (const message of messages) {
			try {
				// Check if message already exists
				const existing = await pb
					.collection('email_messages')
					.getFirstListItem(`messageId = "${message.messageId}" && accountId = "${accountId}"`)
					.catch(() => null);

				if (!existing || forceSync) {
					const messageData = {
						...message,
						accountId,
						attachments: JSON.stringify(message.attachments),
						to: JSON.stringify(message.to),
						cc: JSON.stringify(message.cc || []),
						bcc: JSON.stringify(message.bcc || []),
						replyTo: JSON.stringify(message.replyTo || []),
						labels: JSON.stringify(message.labels || [])
					};

					const savedMessage = existing
						? await pb.collection('email_messages').update(existing.id, messageData)
						: await pb.collection('email_messages').create(messageData);

					savedMessages.push(savedMessage);
				}
			} catch (error) {
				console.error(`Failed to save message ${message.messageId}:`, error);
			}
		}

		// Update account sync status
		await pb.collection('email_accounts').update(accountId, {
			lastSyncAt: new Date(),
			syncStatus: 'idle'
		});

		return json({
			success: true,
			data: savedMessages
		});
	} catch (error) {
		console.error('Failed to sync messages:', error);

		// Update account sync status to error
		const { accountId } = await request.json().catch(() => ({}));
		if (accountId) {
			await pb
				.collection('email_accounts')
				.update(accountId, {
					syncStatus: 'error',
					syncError: error instanceof Error ? error.message : 'Unknown error'
				})
				.catch(() => {});
		}

		return json(
			{
				success: false,
				error: 'Failed to sync messages'
			},
			{ status: 500 }
		);
	}
};
