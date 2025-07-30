// src/lib/features/email/utils/emailUtils.ts

import { gmail_v1, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { simpleParser } from 'mailparser';
import { htmlToText } from 'html-to-text';
import CryptoJS from 'crypto-js';
import type {
	EmailMessage,
	EmailAttachment,
	EmailAddress,
	EmailAccount,
	EmailAuthConfig
} from '$lib/types/types.email';

export class EmailService {
	private oauth2Client: OAuth2Client;
	protected gmail: gmail_v1.Gmail; // Changed from private to protected

	constructor(private config: EmailAuthConfig) {
		this.oauth2Client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
		this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
	}

	/**
	 * Get Gmail authorization URL
	 */
	getAuthUrl(): string {
		return this.oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: this.config.scopes,
			prompt: 'consent'
		});
	}

	/**
	 * Exchange authorization code for tokens
	 */
	async exchangeCodeForTokens(code: string) {
		try {
			// Use getToken instead of getAccessToken for authorization code
			const { tokens } = await this.oauth2Client.getToken(code);
			return tokens;
		} catch (error) {
			console.error('Token exchange error:', error);
			throw new Error(`Failed to exchange authorization code: ${error}`);
		}
	}
	/**
	 * Set credentials for authenticated requests
	 */
	setCredentials(account: EmailAccount) {
		// Convert tokenExpiry to Date if it's a string
		const tokenExpiry =
			typeof account.tokenExpiry === 'string' ? new Date(account.tokenExpiry) : account.tokenExpiry;

		this.oauth2Client.setCredentials({
			access_token: account.accessToken,
			refresh_token: account.refreshToken,
			expiry_date: tokenExpiry.getTime()
		});
	}

	/**
	 * Refresh access token if needed
	 */
	async refreshTokenIfNeeded(account: EmailAccount): Promise<EmailAccount> {
		if (new Date() >= account.tokenExpiry) {
			this.oauth2Client.setCredentials({
				refresh_token: account.refreshToken
			});

			const { credentials } = await this.oauth2Client.refreshAccessToken();

			return {
				...account,
				accessToken: credentials.access_token || '',
				tokenExpiry: new Date(credentials.expiry_date || Date.now())
			};
		}
		return account;
	}

	/**
	 * List messages from Gmail
	 */
	async listMessages(query?: string, maxResults: number = 50): Promise<gmail_v1.Schema$Message[]> {
		const response = await this.gmail.users.messages.list({
			userId: 'me',
			q: query,
			maxResults
		});

		return response.data.messages || [];
	}

	/**
	 * Get full message details
	 */
	async getMessage(messageId: string): Promise<gmail_v1.Schema$Message> {
		const response = await this.gmail.users.messages.get({
			userId: 'me',
			id: messageId,
			format: 'full'
		});

		return response.data;
	}

	/**
	 * Download attachment
	 */
	async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
		const response = await this.gmail.users.messages.attachments.get({
			userId: 'me',
			messageId,
			id: attachmentId
		});

		if (!response.data.data) {
			throw new Error('No attachment data found');
		}

		return Buffer.from(response.data.data, 'base64url');
	}

	/**
	 * Parse Gmail message to EmailMessage format
	 */
	async parseGmailMessage(gmailMessage: gmail_v1.Schema$Message): Promise<EmailMessage> {
		const headers = gmailMessage.payload?.headers || [];
		const getHeader = (name: string) =>
			headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;

		const message: EmailMessage = {
			id: '', // Will be set by PocketBase
			accountId: '', // Will be set by caller
			messageId: gmailMessage.id || '',
			threadId: gmailMessage.threadId || '',
			subject: getHeader('Subject') || '(No Subject)',
			from: this.parseEmailAddress(getHeader('From') || ''),
			to: this.parseEmailAddresses(getHeader('To') || ''),
			cc: this.parseEmailAddresses(getHeader('Cc') || ''),
			bcc: this.parseEmailAddresses(getHeader('Bcc') || ''),
			replyTo: this.parseEmailAddresses(getHeader('Reply-To') || ''),
			date: new Date(getHeader('Date') || Date.now()),
			bodyText: '',
			bodyHtml: '',
			snippet: gmailMessage.snippet || '',
			attachments: [],
			labels: gmailMessage.labelIds || [],
			isRead: !gmailMessage.labelIds?.includes('UNREAD'),
			isStarred: gmailMessage.labelIds?.includes('STARRED') || false,
			isImportant: gmailMessage.labelIds?.includes('IMPORTANT') || false,
			created: new Date(),
			updated: new Date()
		};

		// Extract body content
		const { bodyText, bodyHtml } = this.extractBodyContent(gmailMessage.payload);
		message.bodyText = bodyText;
		message.bodyHtml = bodyHtml;

		// Extract attachments
		message.attachments = this.extractAttachments(gmailMessage.payload);

		return message;
	}

	/**
	 * Extract body content from Gmail payload
	 */
	private extractBodyContent(payload: gmail_v1.Schema$MessagePart | undefined): {
		bodyText: string;
		bodyHtml: string;
	} {
		let bodyText = '';
		let bodyHtml = '';

		if (!payload) return { bodyText, bodyHtml };

		if (payload.parts) {
			// Multipart message
			for (const part of payload.parts) {
				if (part.mimeType === 'text/plain' && part.body?.data) {
					bodyText += Buffer.from(part.body.data, 'base64url').toString();
				} else if (part.mimeType === 'text/html' && part.body?.data) {
					bodyHtml += Buffer.from(part.body.data, 'base64url').toString();
				} else if (part.parts) {
					// Nested parts
					const nested = this.extractBodyContent(part);
					bodyText += nested.bodyText;
					bodyHtml += nested.bodyHtml;
				}
			}
		} else if (payload.body?.data) {
			// Simple message
			const content = Buffer.from(payload.body.data, 'base64url').toString();
			if (payload.mimeType === 'text/plain') {
				bodyText = content;
			} else if (payload.mimeType === 'text/html') {
				bodyHtml = content;
			}
		}

		// Convert HTML to text if only HTML is available
		if (!bodyText && bodyHtml) {
			bodyText = htmlToText(bodyHtml, {
				wordwrap: 130,
				ignoreHref: true,
				ignoreImage: true
			});
		}

		return { bodyText, bodyHtml };
	}

	/**
	 * Extract attachments from Gmail payload
	 */
	private extractAttachments(payload: gmail_v1.Schema$MessagePart | undefined): EmailAttachment[] {
		const attachments: EmailAttachment[] = [];

		if (!payload) return attachments;

		const processPart = (part: gmail_v1.Schema$MessagePart) => {
			if (part.filename && part.body?.attachmentId) {
				const contentIdHeader = part.headers?.find((h) => h.name === 'Content-ID');

				attachments.push({
					id: '', // Will be set by PocketBase
					filename: part.filename,
					mimeType: part.mimeType || 'application/octet-stream',
					size: part.body.size || 0,
					attachmentId: part.body.attachmentId,
					contentId: contentIdHeader?.value || undefined, // Fixed null handling
					isInline:
						part.headers?.some(
							(h) => h.name === 'Content-Disposition' && h.value?.includes('inline')
						) || false
				});
			}

			if (part.parts) {
				part.parts.forEach(processPart);
			}
		};

		if (payload.parts) {
			payload.parts.forEach(processPart);
		}

		return attachments;
	}

	/**
	 * Parse single email address
	 */
	private parseEmailAddress(addressString: string): EmailAddress {
		// Handle empty or invalid address strings
		if (!addressString || addressString.trim() === '') {
			return { email: 'unknown@domain.com' };
		}

		// Try to match "Name <email@domain.com>" or just "email@domain.com"
		const match = addressString.match(/^(.+)\s+<(.+)>$|^(.+)$/);
		if (match) {
			if (match[2]) {
				// Format: "Name <email@domain.com>"
				const name = match[1].trim().replace(/^"|"$/g, ''); // Remove quotes
				const email = match[2].trim();
				return { name: name || undefined, email: email || 'unknown@domain.com' };
			} else {
				// Format: "email@domain.com" or just a name
				const emailOrName = match[3].trim();
				// Check if it looks like an email
				if (emailOrName.includes('@')) {
					return { email: emailOrName };
				} else {
					// It's probably just a name without email
					return { name: emailOrName, email: 'unknown@domain.com' };
				}
			}
		}
		return { email: 'unknown@domain.com' };
	}
	/**
	 * Parse multiple email addresses
	 */
	private parseEmailAddresses(addressString: string): EmailAddress[] {
		if (!addressString || addressString.trim() === '') return [];

		return addressString
			.split(',')
			.map((addr) => addr.trim())
			.filter((addr) => addr.length > 0) // Remove empty addresses
			.map((addr) => this.parseEmailAddress(addr));
	}

	/**
	 * Encrypt sensitive data
	 */
	static encrypt(text: string, key: string): string {
		return CryptoJS.AES.encrypt(text, key).toString();
	}

	/**
	 * Decrypt sensitive data
	 */
	static decrypt(ciphertext: string, key: string): string {
		const bytes = CryptoJS.AES.decrypt(ciphertext, key);
		return bytes.toString(CryptoJS.enc.Utf8);
	}

	/**
	 * Generate secure random string
	 */
	static generateSecureKey(length: number = 32): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Validate email address
	 */
	static isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	/**
	 * Format file size
	 */
	static formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	/**
	 * Get file extension from mime type
	 */
	static getFileExtension(mimeType: string): string {
		const mimeMap: { [key: string]: string } = {
			'application/pdf': 'pdf',
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/gif': 'gif',
			'text/plain': 'txt',
			'application/zip': 'zip',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
		};
		return mimeMap[mimeType] || 'bin';
	}
}
