import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

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

export const POST: RequestHandler = async ({ request, getClientAddress }) =>
	apiTryCatch(async () => {
		await new Promise((resolve) => setTimeout(resolve, 300));

		const clientIp = getClientAddress();

		if (!rateLimiter.check(clientIp)) {
			console.warn(`Rate limit exceeded for IP: ${clientIp}`);
			throw new Error('Too many validation attempts. Please try again later.');
		}

		const { code } = await request.json();

		if (!code) {
			throw new Error('No invitation code provided');
		}

		console.log(`Invitation code validation attempt: ${code.slice(0, 4)}... from IP: ${clientIp}`);

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
	}, 'Server error processing invitation code');
