// src/lib/features/email/utils/gmailService.ts

import { gmail_v1, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { simpleParser } from 'mailparser';
import type { ParsedMail } from 'mailparser';

import fs from 'fs/promises';
import path from 'path';
import { EmailService } from './emailUtils';
import type {
	EmailAccount,
	EmailMessage,
	EmailAttachment,
	EmailAuthConfig,
	EmailSyncConfig
} from '$lib/types/types.email';

export class GmailService extends EmailService {
	private syncConfig: EmailSyncConfig;

	constructor(config: EmailAuthConfig, syncConfig: EmailSyncConfig) {
		super(config);
		this.syncConfig = syncConfig;
	}

	/**
	 * Sync emails from Gmail account
	 */
	async syncEmails(
		account: EmailAccount,
		callback?: (progress: number) => void
	): Promise<EmailMessage[]> {
		try {
			// Refresh token if needed
			account = await this.refreshTokenIfNeeded(account);
			this.setCredentials(account);

			// Get messages from the last sync or configured history days
			const query = this.buildSyncQuery(account);
			const messages = await this.listMessages(query, this.syncConfig.batchSize);

			const syncedMessages: EmailMessage[] = [];
			let processed = 0;

			for (const message of messages) {
				try {
					const fullMessage = await this.getMessage(message.id || '');
					const parsedMessage = await this.parseGmailMessage(fullMessage);
					parsedMessage.accountId = account.id;

					// Download attachments if configured
					if (this.syncConfig.downloadAttachments && parsedMessage.attachments.length > 0) {
						parsedMessage.attachments = await this.downloadMessageAttachments(
							parsedMessage.messageId,
							parsedMessage.attachments
						);
					}

					syncedMessages.push(parsedMessage);
					processed++;

					// Report progress
					if (callback) {
						callback(Math.round((processed / messages.length) * 100));
					}

					// Respect rate limits
					await this.sleep(100);
				} catch (error) {
					console.error(`Failed to sync message ${message.id}:`, error);
				}
			}

			return syncedMessages;
		} catch (error) {
			console.error('Gmail sync failed:', error);
			throw error;
		}
	}

	/**
	 * Build sync query based on account settings
	 */
	private buildSyncQuery(account: EmailAccount): string {
		const queries: string[] = [];

		// Get emails from the last configured days
		const fromDate = new Date();
		fromDate.setDate(fromDate.getDate() - this.syncConfig.maxHistoryDays);
		queries.push(`after:${Math.floor(fromDate.getTime() / 1000)}`);

		// Exclude spam and trash
		queries.push('-in:spam');
		queries.push('-in:trash');

		return queries.join(' ');
	}

	/**
	 * Download all attachments for a message
	 */
	private async downloadMessageAttachments(
		messageId: string,
		attachments: EmailAttachment[]
	): Promise<EmailAttachment[]> {
		const downloadedAttachments: EmailAttachment[] = [];

		for (const attachment of attachments) {
			try {
				const attachmentData = await this.downloadAttachment(messageId, attachment.attachmentId);

				// Create storage directory
				const storageDir = path.join(process.cwd(), 'storage', 'attachments', messageId);
				await fs.mkdir(storageDir, { recursive: true });

				// Generate unique filename to avoid conflicts
				const timestamp = Date.now();
				const extension = EmailService.getFileExtension(attachment.mimeType);
				const filename = `${attachment.filename}_${timestamp}.${extension}`;
				const filePath = path.join(storageDir, filename);

				// Save attachment to disk
				await fs.writeFile(filePath, attachmentData);

				downloadedAttachments.push({
					...attachment,
					localPath: filePath,
					downloadUrl: `/api/email/attachments/${messageId}/${filename}`
				});
			} catch (error) {
				console.error(`Failed to download attachment ${attachment.filename}:`, error);
				// Include attachment without local path
				downloadedAttachments.push(attachment);
			}
		}

		return downloadedAttachments;
	}

	/**
	 * Send email via Gmail
	 */
	async sendEmail(
		account: EmailAccount,
		to: string[],
		subject: string,
		body: string,
		isHtml: boolean = false,
		attachments?: { filename: string; data: Buffer; mimeType: string }[]
	): Promise<void> {
		account = await this.refreshTokenIfNeeded(account);
		this.setCredentials(account);

		let email = '';

		// Build email headers
		email += `To: ${to.join(', ')}\r\n`;
		email += `Subject: ${subject}\r\n`;
		email += `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8\r\n`;
		email += '\r\n';
		email += body;

		// Encode email in base64url
		const encodedEmail = Buffer.from(email).toString('base64url');

		await this.gmail.users.messages.send({
			userId: 'me',
			requestBody: {
				raw: encodedEmail
			}
		});
	}

	/**
	 * Reply to an email
	 */
	async replyToEmail(
		account: EmailAccount,
		originalMessage: EmailMessage,
		replyBody: string,
		isHtml: boolean = false
	): Promise<void> {
		const subject = originalMessage.subject.startsWith('Re:')
			? originalMessage.subject
			: `Re: ${originalMessage.subject}`;

		await this.sendEmail(account, [originalMessage.from.email], subject, replyBody, isHtml);
	}

	/**
	 * Mark message as read/unread
	 */
	async markAsRead(messageId: string, isRead: boolean = true): Promise<void> {
		const labelToAdd = isRead ? [] : ['UNREAD'];
		const labelToRemove = isRead ? ['UNREAD'] : [];

		await this.gmail.users.messages.modify({
			userId: 'me',
			id: messageId,
			requestBody: {
				addLabelIds: labelToAdd,
				removeLabelIds: labelToRemove
			}
		});
	}

	/**
	 * Star/unstar message
	 */
	async starMessage(messageId: string, isStarred: boolean = true): Promise<void> {
		const labelToAdd = isStarred ? ['STARRED'] : [];
		const labelToRemove = isStarred ? [] : ['STARRED'];

		await this.gmail.users.messages.modify({
			userId: 'me',
			id: messageId,
			requestBody: {
				addLabelIds: labelToAdd,
				removeLabelIds: labelToRemove
			}
		});
	}

	/**
	 * Delete message (move to trash)
	 */
	async deleteMessage(messageId: string): Promise<void> {
		await this.gmail.users.messages.trash({
			userId: 'me',
			id: messageId
		});
	}

	/**
	 * Get Gmail labels
	 */
	async getLabels(): Promise<gmail_v1.Schema$Label[]> {
		const response = await this.gmail.users.labels.list({
			userId: 'me'
		});
		return response.data.labels || [];
	}

	/**
	 * Create Gmail label
	 */
	async createLabel(name: string, color?: string): Promise<gmail_v1.Schema$Label> {
		const response = await this.gmail.users.labels.create({
			userId: 'me',
			requestBody: {
				name,
				labelListVisibility: 'labelShow',
				messageListVisibility: 'show',
				...(color && {
					color: {
						backgroundColor: color,
						textColor: '#ffffff'
					}
				})
			}
		});
		return response.data;
	}

	/**
	 * Apply label to message
	 */
	async applyLabel(messageId: string, labelId: string): Promise<void> {
		await this.gmail.users.messages.modify({
			userId: 'me',
			id: messageId,
			requestBody: {
				addLabelIds: [labelId]
			}
		});
	}

	/**
	 * Search emails with advanced query
	 */
	async searchEmails(query: string, maxResults: number = 50): Promise<EmailMessage[]> {
		const messages = await this.listMessages(query, maxResults);
		const searchResults: EmailMessage[] = [];

		for (const message of messages) {
			try {
				const fullMessage = await this.getMessage(message.id || '');
				const parsedMessage = await this.parseGmailMessage(fullMessage);
				searchResults.push(parsedMessage);

				// Small delay to respect rate limits
				await this.sleep(50);
			} catch (error) {
				console.error(`Failed to fetch message ${message.id}:`, error);
			}
		}

		return searchResults;
	}

	/**
	 * Get email thread
	 */
	async getThread(threadId: string): Promise<EmailMessage[]> {
		const response = await this.gmail.users.threads.get({
			userId: 'me',
			id: threadId,
			format: 'full'
		});

		const threadMessages: EmailMessage[] = [];

		if (response.data.messages) {
			for (const message of response.data.messages) {
				try {
					const parsedMessage = await this.parseGmailMessage(message);
					threadMessages.push(parsedMessage);
				} catch (error) {
					console.error(`Failed to parse thread message:`, error);
				}
			}
		}

		return threadMessages.sort((a, b) => a.date.getTime() - b.date.getTime());
	}

	/**
	 * Get user profile information
	 */
	async getUserProfile(): Promise<gmail_v1.Schema$Profile> {
		const response = await this.gmail.users.getProfile({
			userId: 'me'
		});
		return response.data;
	}

	/**
	 * Watch for new emails (push notifications)
	 */
	async watchEmails(topicName: string): Promise<void> {
		await this.gmail.users.watch({
			userId: 'me',
			requestBody: {
				topicName,
				labelIds: ['INBOX']
			}
		});
	}

	/**
	 * Stop watching for emails
	 */
	async stopWatching(): Promise<void> {
		await this.gmail.users.stop({
			userId: 'me'
		});
	}

	/**
	 * Get message raw content (useful for advanced parsing)
	 */
	async getMessageRaw(messageId: string): Promise<string> {
		const response = await this.gmail.users.messages.get({
			userId: 'me',
			id: messageId,
			format: 'raw'
		});

		if (!response.data.raw) {
			throw new Error('No raw message data found');
		}

		return Buffer.from(response.data.raw, 'base64url').toString();
	}

	/**
	 * Parse raw email using mailparser
	 */
	async parseRawEmail(rawEmail: string): Promise<ParsedMail> {
		return await simpleParser(rawEmail);
	}

	/**
	 * Batch operations for multiple messages
	 */
	async batchModifyMessages(
		messageIds: string[],
		addLabels: string[] = [],
		removeLabels: string[] = []
	): Promise<void> {
		// Gmail API supports batch requests, but for simplicity, we'll do sequential
		for (const messageId of messageIds) {
			try {
				await this.gmail.users.messages.modify({
					userId: 'me',
					id: messageId,
					requestBody: {
						addLabelIds: addLabels,
						removeLabelIds: removeLabels
					}
				});

				// Small delay to respect rate limits
				await this.sleep(100);
			} catch (error) {
				console.error(`Failed to modify message ${messageId}:`, error);
			}
		}
	}

	/**
	 * Get email statistics
	 */
	async getEmailStats(): Promise<{
		totalMessages: number;
		unreadMessages: number;
		sentMessages: number;
		draftMessages: number;
	}> {
		const [total, unread, sent, drafts] = await Promise.all([
			this.listMessages('', 1),
			this.listMessages('is:unread', 1),
			this.listMessages('in:sent', 1),
			this.listMessages('in:drafts', 1)
		]);

		return {
			totalMessages: total.length,
			unreadMessages: unread.length,
			sentMessages: sent.length,
			draftMessages: drafts.length
		};
	}

	/**
	 * Export emails to JSON
	 */
	async exportEmails(query: string = '', limit: number = 1000): Promise<EmailMessage[]> {
		const messages = await this.searchEmails(query, limit);
		return messages;
	}

	/**
	 * Utility function to sleep
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Validate Gmail scopes
	 */
	static getRequiredScopes(): string[] {
		return [
			'https://www.googleapis.com/auth/gmail.readonly',
			'https://www.googleapis.com/auth/gmail.send',
			'https://www.googleapis.com/auth/gmail.modify',
			'https://www.googleapis.com/auth/gmail.compose',
			'https://www.googleapis.com/auth/userinfo.email',
			'https://www.googleapis.com/auth/userinfo.profile'
		];
	}

	/**
	 * Create Gmail service instance with provided config
	 */
	static createWithConfig(authConfig: EmailAuthConfig, syncConfig: EmailSyncConfig): GmailService {
		return new GmailService(authConfig, syncConfig);
	}
}
