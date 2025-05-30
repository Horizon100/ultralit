import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Post, PostAttachment } from '$lib/types/types.posts';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	// Helper function to determine file type - moved inside
	function getFileType(mimeType: string): 'image' | 'video' | 'document' | 'audio' | 'archive' | 'spreadsheet' | 'presentation' | 'code' | 'ebook' {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType.includes('pdf')) return 'document';
		if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
		if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet';
		if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
		if (mimeType.includes('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'code';
		return 'document';
	}

	// Helper function to update the quoted post - moved inside
	async function updateQuotedPost(quotedPost: Post, userId: string) {
		const quotedBy = quotedPost.quotedBy || [];
		const hasQuoted = quotedBy.includes(userId);

		if (!hasQuoted) {
			const updatedQuotedBy = [...quotedBy, userId];
			const quoteCount = (quotedPost.quoteCount || 0) + 1;

			await pb.collection('posts').update(quotedPost.id, {
				quotedBy: updatedQuotedBy,
				quoteCount: quoteCount
			});
		}
	}

	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const quotedPostId = params.id;
		const userId = locals.user.id;
		const formData = await request.formData();
		const content = formData.get('content') as string;

		if (!content?.trim()) {
			return json({ error: 'Content is required' }, { status: 400 });
		}

		console.log(`Creating quote post for ${quotedPostId} by user ${userId}`);

		// Get the quoted post to increment quote count
		const quotedPost = await pb.collection('posts').getOne(quotedPostId) as Post;

		// Create the new quote post data with all required fields
		const postData: Partial<Post> = {
			content: content.trim(),
			user: userId,
			quotedPost: quotedPostId,
			parent: '', // Quote posts are top-level posts
			children: [],
			upvotedBy: [],
			downvotedBy: [],
			repostedBy: [],
			commentedBy: [],
			sharedBy: [],
			quotedBy: [],
			readBy: [],
			upvoteCount: 0,
			downvoteCount: 0,
			repostCount: 0,
			commentCount: 0,
			shareCount: 0,
			quoteCount: 0,
			readCount: 0
		};

		// Create the post first
		const newPost = await pb.collection('posts').create(postData) as Post;
		console.log(`Quote post created with ID: ${newPost.id}`);

		// Handle attachments if any
		const attachments: PostAttachment[] = [];
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('attachment_') && value instanceof File && value.size > 0) {
				try {
					console.log(`Processing attachment: ${value.name}`);

					const attachmentData = new FormData();
					attachmentData.append('post', newPost.id);
					attachmentData.append('file_path', value);
					attachmentData.append('file_type', getFileType(value.type));
					attachmentData.append('file_size', value.size.toString());
					attachmentData.append('original_name', value.name);
					attachmentData.append('mime_type', value.type);

					// Use correct collection name: posts_attachments
					const attachment = await pb.collection('posts_attachments').create(attachmentData) as PostAttachment;
					attachments.push(attachment);
					console.log(`Attachment created with ID: ${attachment.id}`);
				} catch (attachmentError) {
					console.error('Error creating attachment:', attachmentError);
					// Continue with post creation even if attachment fails
				}
			}
		}

		// Update the quoted post's quote count and quotedBy array
		await updateQuotedPost(quotedPost, userId);

		// Fetch the complete post with user data
		const postWithUser = await pb.collection('posts').getOne(newPost.id, {
			expand: 'user'
		});

		// Get user data for response
		const userData = postWithUser.expand?.user;

		const result = {
			...postWithUser,
			attachments,
			author_name: userData?.name,
			author_username: userData?.username,
			author_avatar: userData?.avatar,
			// Add interaction status
			upvote: false,
			downvote: false,
			repost: false,
			hasRead: false,
			share: false,
			quote: false,
			preview: false,
			expand: postWithUser.expand
		};

		console.log('Quote post creation successful');

		return json({
			success: true,
			post: result,
			quoteCount: (quotedPost.quoteCount || 0) + 1,
			quotedBy: [...(quotedPost.quotedBy || []), userId]
		});

	} catch (error) {
		console.error('Error creating quote post:', error);
		const errorMessage = error instanceof Error ? error.message : 'Failed to create quote post';
		return json({ error: errorMessage }, { status: 500 });
	}
};