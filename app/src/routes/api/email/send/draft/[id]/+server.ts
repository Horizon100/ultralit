// PUT /api/email/send/draft - Save email draft
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

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const { accountId, to, cc, bcc, subject, body, isHtml = false, draftId } = await request.json();

		if (!accountId) {
			return json(
				{
					success: false,
					error: 'Account ID is required'
				} satisfies EmailApiResponse,
				{ status: 400 }
			);
		}

		const draftData = {
			accountId,
			to: JSON.stringify(Array.isArray(to) ? to : [to]),
			cc: JSON.stringify(cc ? (Array.isArray(cc) ? cc : [cc]) : []),
			bcc: JSON.stringify(bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : []),
			subject: subject || '',
			body: body || '',
			isHtml,
			lastModified: new Date()
		};

		let savedDraft;
		if (draftId) {
			savedDraft = await pb.collection('email_drafts').update(draftId, draftData);
		} else {
			savedDraft = await pb.collection('email_drafts').create(draftData);
		}

		return json({
			success: true,
			data: savedDraft
		} satisfies EmailApiResponse);
	} catch (error) {
		console.error('Failed to save email draft:', error);
		return json(
			{
				success: false,
				error: 'Failed to save email draft'
			} satisfies EmailApiResponse,
			{ status: 500 }
		);
	}
};
