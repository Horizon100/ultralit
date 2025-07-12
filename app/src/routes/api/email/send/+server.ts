// src/routes/api/email/send/+server.ts

import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { getEmailAuthConfig, getEmailSyncConfig } from '$lib/server/email-config';
// POST /api/email/send - Send email
export const POST: RequestHandler = async ({ request }) => {
	try {
		const {
			accountId,
			to,
			cc,
			bcc,
			subject,
			body,
			isHtml = false,
			attachments = [],
			replyToMessageId,
			priority = 'normal'
		} = await request.json();

		if (!accountId || !to || !subject || !body) {
			return json(
				{
					success: false,
					error: 'Missing required fields: accountId, to, subject, body'
				},
				{ status: 400 }
			);
		}

		// Get account
		const account = await pb.collection('email_accounts').getOne(accountId);

		if (!account) {
			return json(
				{
					success: false,
					error: 'Email account not found'
				},
				{ status: 404 }
			);
		}

		if (!account.isActive) {
			return json(
				{
					success: false,
					error: 'Email account is not active'
				},
				{ status: 403 }
			);
		}

		// Validate email addresses
		const validateEmail = (email: string) => {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			return emailRegex.test(email);
		};

		const toEmails = Array.isArray(to) ? to : [to];
		const ccEmails = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
		const bccEmails = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

		// Validate all email addresses
		const allEmails = [...toEmails, ...ccEmails, ...bccEmails];
		for (const email of allEmails) {
			if (!validateEmail(email)) {
				return json(
					{
						success: false,
						error: `Invalid email address: ${email}`
					},
					{ status: 400 }
				);
			}
		}

		let sentMessageId: string;

		if (account.provider === 'gmail') {
			// Send via Gmail API
			const authConfig = getEmailAuthConfig();
			const syncConfig = getEmailSyncConfig();
			const gmailService = GmailService.createWithConfig(authConfig, syncConfig);

			// Refresh token if needed
			const refreshedAccount = await gmailService.refreshTokenIfNeeded(account as any);
			if (refreshedAccount.accessToken !== account.accessToken) {
				// Update token in database
				await pb.collection('email_accounts').update(accountId, {
					accessToken: refreshedAccount.accessToken,
					tokenExpiry: refreshedAccount.tokenExpiry
				});
			}

			gmailService.setCredentials(refreshedAccount);

			// Handle reply context
			let emailSubject = subject;
			let emailBody = body;

			if (replyToMessageId) {
				try {
					const originalMessage = await pb.collection('email_messages').getOne(replyToMessageId);
					if (!originalMessage.subject.toLowerCase().startsWith('re:')) {
						emailSubject = `Re: ${originalMessage.subject}`;
					}

					// Add original message context if HTML
					if (isHtml) {
						emailBody += `
              <br><br>
              <div style="border-left: 3px solid #ccc; padding-left: 15px; margin-top: 20px;">
                <p><strong>On ${new Date(originalMessage.date).toLocaleString()}, ${originalMessage.from.name || originalMessage.from.email} wrote:</strong></p>
                <div>${originalMessage.bodyHtml || originalMessage.bodyText}</div>
              </div>
            `;
					} else {
						emailBody += `\n\n---\nOn ${new Date(originalMessage.date).toLocaleString()}, ${originalMessage.from.name || originalMessage.from.email} wrote:\n${originalMessage.bodyText}\n`;
					}
				} catch (error) {
					console.warn('Could not load original message for reply context:', error);
				}
			}

			// Process attachments if any
			const processedAttachments = [];
			if (attachments && attachments.length > 0) {
				for (const attachment of attachments) {
					// Assuming attachment is { filename, data (base64), mimeType }
					const attachmentBuffer = Buffer.from(attachment.data, 'base64');
					processedAttachments.push({
						filename: attachment.filename,
						data: attachmentBuffer,
						mimeType: attachment.mimeType
					});
				}
			}

			// Send email via Gmail
			await gmailService.sendEmail(
				refreshedAccount as any,
				toEmails,
				subject,
				body,
				isHtml,
				processedAttachments
			);

			sentMessageId = `gmail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		} else {
			// Handle other providers (SMTP, Outlook, etc.)
			return json(
				{
					success: false,
					error: 'Provider not yet supported for sending'
				},
				{ status: 501 }
			);
		}

		// Log sent email in database
		try {
			const sentEmailData = {
				accountId,
				messageId: sentMessageId,
				threadId: replyToMessageId ? `thread_${replyToMessageId}` : `thread_${sentMessageId}`,
				subject: subject,
				from: {
					email: account.email,
					name: account.displayName || account.email
				},
				to: toEmails.map((email) => ({ email })),
				cc: ccEmails.map((email) => ({ email })),
				bcc: bccEmails.map((email) => ({ email })),
				date: new Date(),
				bodyText: isHtml ? '' : body,
				bodyHtml: isHtml ? body : '',
				snippet: body.substring(0, 200),
				attachments: attachments || [],
				labels: ['SENT'],
				isRead: true,
				isStarred: false,
				isImportant: priority === 'high' || priority === 'urgent',
				isSent: true,
				priority
			};

			await pb.collection('email_messages').create({
				...sentEmailData,
				from: JSON.stringify(sentEmailData.from),
				to: JSON.stringify(sentEmailData.to),
				cc: JSON.stringify(sentEmailData.cc),
				bcc: JSON.stringify(sentEmailData.bcc),
				attachments: JSON.stringify(sentEmailData.attachments),
				labels: JSON.stringify(sentEmailData.labels)
			});
		} catch (dbError) {
			console.warn('Failed to log sent email in database:', dbError);
			// Don't fail the request since email was sent successfully
		}

		return json({
			success: true,
			data: {
				messageId: sentMessageId,
				message: 'Email sent successfully',
				recipients: {
					to: toEmails,
					cc: ccEmails,
					bcc: bccEmails
				}
			}
		});
	} catch (error) {
		console.error('Failed to send email:', error);

		// Provide more specific error messages
		let errorMessage = 'Failed to send email';
		if (error instanceof Error) {
			if (error.message.includes('invalid_grant')) {
				errorMessage = 'Email account authentication expired. Please reconnect your account.';
			} else if (error.message.includes('quotaExceeded')) {
				errorMessage = 'Email sending quota exceeded. Please try again later.';
			} else if (error.message.includes('userRateLimitExceeded')) {
				errorMessage = 'Too many emails sent. Please wait before sending more.';
			} else if (error.message.includes('forbidden')) {
				errorMessage = 'Permission denied. Check your email account permissions.';
			}
		}

		return json(
			{
				success: false,
				error: errorMessage
			},
			{ status: 500 }
		);
	}
};
