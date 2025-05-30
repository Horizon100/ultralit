import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { PostAttachment } from '$lib/types/types.posts';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	function getFileType(mimeType: string): 'image' | 'video' | 'document' | 'audio' | 'archive' | 'spreadsheet' | 'presentation' | 'code' | 'ebook' {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType.includes('pdf')) return 'document';
		if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar') || mimeType.includes('gz')) return 'archive';
		if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv') || mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'spreadsheet';
		if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'presentation';
		if (mimeType.startsWith('text/') && (mimeType.includes('javascript') || mimeType.includes('css') || mimeType.includes('html') || mimeType.includes('xml') || mimeType.includes('json') || mimeType.includes('typescript'))) return 'code';
		if (mimeType.includes('epub') || mimeType.includes('mobi') || mimeType === 'application/x-mobipocket-ebook') return 'ebook';
		return 'document';
	}

	try {
		console.log('=== ATTACHMENT ENDPOINT CALLED ===');
		console.log('Post ID:', params.id);
		console.log('User:', locals.user?.id);

		if (!locals.user) {
			console.log('ERROR: No user authenticated');
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const postId = params.id;
		
		// Verify the post exists
		let post;
		try {
			post = await pb.collection('posts').getOne(postId);
			console.log('Post found:', post.id, 'by user:', post.user);
		} catch (err) {
			console.log('ERROR: Post not found:', err);
			return json({ error: 'Post not found' }, { status: 404 });
		}

		// Check if user owns the post
		if (post.user !== locals.user.id) {
			console.log('ERROR: User does not own post');
			return json({ error: 'Unauthorized to add attachments to this post' }, { status: 403 });
		}

		const formData = await request.formData();
		console.log('Form data entries:');
		for (const [key, value] of formData.entries()) {
			if (value instanceof File) {
				console.log(`${key}: ${value.name} (${value.size} bytes, ${value.type})`);
			} else {
				console.log(`${key}: ${value}`);
			}
		}

		const attachments: PostAttachment[] = [];

		// Process all files from the form data
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('attachment_') && value instanceof File && value.size > 0) {
				try {
					console.log(`Processing attachment: ${value.name}`);

					// Create attachment data
					const attachmentFormData = new FormData();
					attachmentFormData.append('post', postId);
					attachmentFormData.append('file_path', value);
					attachmentFormData.append('file_type', getFileType(value.type));
					attachmentFormData.append('file_size', value.size.toString());
					attachmentFormData.append('original_name', value.name);
					attachmentFormData.append('mime_type', value.type);

					console.log('Creating attachment in posts_attachments collection...');

					// Create attachment in posts_attachments collection
					const attachment = await pb.collection('posts_attachments').create(attachmentFormData) as PostAttachment;
					attachments.push(attachment);
					
					console.log(`SUCCESS: Attachment created with ID: ${attachment.id}`);
				} catch (attachmentError) {
					console.error('ERROR creating attachment:', attachmentError);
					// Continue with other attachments even if one fails
				}
			}
		}

		if (attachments.length === 0) {
			console.log('ERROR: No valid attachments found');
			return json({ error: 'No valid attachments provided' }, { status: 400 });
		}

		console.log(`SUCCESS: Created ${attachments.length} attachments for post ${postId}`);

		return json({
			success: true,
			attachments,
			count: attachments.length
		});

	} catch (error) {
		console.error('ERROR in attachment endpoint:', error);
		const errorMessage = error instanceof Error ? error.message : 'Failed to add attachments';
		return json({ error: errorMessage }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ params }) => {
	try {
		const postId = params.id;

		// Get all attachments for this post
		const attachments = await pb.collection('posts_attachments').getFullList({
			filter: `post = "${postId}"`,
			sort: 'created'
		});

		return json({
			success: true,
			attachments
		});

	} catch (error) {
		console.error('Error fetching attachments:', error);
		const errorMessage = error instanceof Error ? error.message : 'Failed to fetch attachments';
		return json({ error: errorMessage }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const postId = params.id;
		const attachmentId = url.searchParams.get('attachmentId');

		if (!attachmentId) {
			return json({ error: 'Attachment ID is required' }, { status: 400 });
		}

		// Verify the post exists and user has permission
		const post = await pb.collection('posts').getOne(postId);
		if (post.user !== locals.user.id) {
			return json({ error: 'Unauthorized to delete attachments from this post' }, { status: 403 });
		}

		// Delete the attachment
		await pb.collection('posts_attachments').delete(attachmentId);

		console.log(`Attachment ${attachmentId} deleted from post ${postId}`);

		return json({ success: true });

	} catch (error) {
		console.error('Error deleting attachment:', error);
		const errorMessage = error instanceof Error ? error.message : 'Failed to delete attachment';
		return json({ error: errorMessage }, { status: 500 });
	}
};