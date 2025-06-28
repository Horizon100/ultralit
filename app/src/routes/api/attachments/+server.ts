import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const formData = await request.formData();
		formData.append('createdBy', locals.user.id);

		const attachmentResult = await pbTryCatch(
			pb.collection('attachments').create(formData),
			'create attachment'
		);
		const attachment = unwrap(attachmentResult);

		const fileUrl = pb.getFileUrl(attachment, attachment.file);

		return {
			id: attachment.id,
			fileName: attachment.fileName,
			file: attachment.file,
			url: fileUrl,
			note: attachment.note || ''
		};
	}, 'Failed to upload attachment');
