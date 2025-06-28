import { type RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { Post, PostAttachment } from '$lib/types/types.posts';
import { getFileType } from '$lib/utils/fileHandlers';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { request, params, locals } = event;

		if (!locals.user) {
			throw new Error('Unauthorized');
		}

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

		const quotedPostId = params.id;
		if (!quotedPostId) {
			throw new Error('Missing post id param');
		}
		const userId = locals.user.id;
		const formData = await request.formData();
		const content = formData.get('content') as string;

		if (!content?.trim()) {
			throw new Error('Content is required');
		}

		console.log(`Creating quote post for ${quotedPostId} by user ${userId}`);

		const quotedPost = (await pb.collection('posts').getOne(quotedPostId)) as Post;

		const postData: Partial<Post> = {
			content: content.trim(),
			user: userId,
			quotedPost: quotedPostId,
			parent: '',
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

		const newPost = (await pb.collection('posts').create(postData)) as Post;
		console.log(`Quote post created with ID: ${newPost.id}`);

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

					const attachment = (await pb
						.collection('posts_attachments')
						.create(attachmentData)) as PostAttachment;
					attachments.push(attachment);
					console.log(`Attachment created with ID: ${attachment.id}`);
				} catch (attachmentError) {
					console.error('Error creating attachment:', attachmentError);
				}
			}
		}

		await updateQuotedPost(quotedPost, userId);

		const postWithUser = await pb.collection('posts').getOne(newPost.id, {
			expand: 'user'
		});

		const userData = postWithUser.expand?.user;

		const result = {
			...postWithUser,
			attachments,
			author_name: userData?.name,
			author_username: userData?.username,
			author_avatar: userData?.avatar,
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

		return {
			success: true,
			post: result,
			quoteCount: (quotedPost.quoteCount || 0) + 1,
			quotedBy: [...(quotedPost.quotedBy || []), userId]
		};
	}, 'Failed to create quote post');
