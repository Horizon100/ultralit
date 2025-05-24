import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

const isDevelopment = process.env.NODE_ENV === 'development';

const rateLimiter = {
	attempts: new Map<string, { count: number; timestamp: number }>(),
	maxAttempts: isDevelopment ? 100 : 10,
	windowMs: isDevelopment ? 15 * 60 * 1000 : 60 * 60 * 1000,
	check(ip: string): boolean {
		const now = Date.now();
		const record = this.attempts.get(ip);

		if (record && now - record.timestamp > this.windowMs) {
			this.attempts.delete(ip);
			return true;
		}

		if (record && record.count >= this.maxAttempts) {
			return false;
		}

		if (record) {
			record.count++;
		} else {
			this.attempts.set(ip, { count: 1, timestamp: now });
		}

		return true;
	}
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	await new Promise((resolve) => setTimeout(resolve, 300));

	const clientIp = getClientAddress();

	// Check rate limit
	if (!rateLimiter.check(clientIp)) {
		console.warn(`Rate limit exceeded for IP: ${clientIp}`);
		return json(
			{
				success: false,
				message: 'Too many validation attempts. Please try again later.'
			},
			{ status: 429 }
		);
	}

	try {
		const { code } = await request.json();

		if (!code) {
			return json(
				{
					success: false,
					message: 'No invitation code provided'
				},
				{ status: 400 }
			);
		}

		try {
			console.log(
				`Invitation code validation attempt: ${code.slice(0, 4)}... from IP: ${clientIp}`
			);

			const invitationCode = await pb
				.collection('invitation_codes')
				.getFirstListItem(`code="${code}" && used=false`);

			return json({
				success: true,
				invitationCode: {
					id: invitationCode.id,
					code: invitationCode.code,
					used: invitationCode.used
				}
			});
		} catch (error) {
			console.log(`Invalid invitation code attempt: ${code.slice(0, 4)}... from IP: ${clientIp}`);
			return json(
				{
					success: false,
					message: 'Invalid or already used invitation code'
				},
				{ status: 404 }
			);
		}
	} catch (error) {
		console.error('Server error validating invitation code:', error);
		return json(
			{
				success: false,
				message: 'Server error processing invitation code'
			},
			{ status: 500 }
		);
	}
};
