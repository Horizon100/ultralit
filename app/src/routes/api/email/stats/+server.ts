// src/routes/api/email/stats/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { pb } from '$lib/server/pocketbase';
import type {
	EmailAccount,
	EmailMessage,
	EmailApiResponse,
	EmailAccountSetup
} from '$lib/types/types.email';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');

		if (!userId) {
			return json<EmailApiResponse>(
				{
					success: false,
					error: 'User ID is required'
				},
				{ status: 400 }
			);
		}

		// Get email statistics
		const [totalMessages, unreadMessages, todayMessages] = await Promise.all([
			pb
				.collection('email_messages')
				.getList(1, 1, {
					filter: `accountId.userId = "${userId}"`,
					totalItems: true
				})
				.then((r) => r.totalItems),

			pb
				.collection('email_messages')
				.getList(1, 1, {
					filter: `accountId.userId = "${userId}" && isRead = false`,
					totalItems: true
				})
				.then((r) => r.totalItems),

			pb
				.collection('email_messages')
				.getList(1, 1, {
					filter: `accountId.userId = "${userId}" && date >= "${new Date().toISOString().split('T')[0]}"`,
					totalItems: true
				})
				.then((r) => r.totalItems)
		]);

		// Get top senders
		const messages = await pb.collection('email_messages').getFullList({
			filter: `accountId.userId = "${userId}"`,
			fields: 'from'
		});

		const senderCounts = messages.reduce(
			(acc, msg) => {
				const email = msg.from?.email;
				if (email) {
					acc[email] = (acc[email] || 0) + 1;
				}
				return acc;
			},
			{} as Record<string, number>
		);

		const topSenders = Object.entries(senderCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([email, count]) => ({ email, count }));

		const stats = {
			totalMessages,
			unreadMessages,
			todayMessages,
			weekMessages: 0, // You can calculate this
			monthMessages: 0, // You can calculate this
			avgResponseTime: 0, // You can calculate this
			topSenders
		};

		return json<EmailApiResponse>({
			success: true,
			data: stats
		});
	} catch (error) {
		console.error('Failed to get email stats:', error);
		return json<EmailApiResponse>(
			{
				success: false,
				error: 'Failed to get email stats'
			},
			{ status: 500 }
		);
	}
};
