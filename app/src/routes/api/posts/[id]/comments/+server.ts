import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Post, PostAttachment, PostWithInteractionsExtended } from '$lib/types/types.posts';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const postId = params.id;
		const limit = parseInt(url.searchParams.get('limit') || '20');

		console.log(`Fetching comments for post ${postId}`);

		try {
			// Fetch comments with user expansion
			const commentsResult = await pb.collection('posts').getList(1, limit, {
				filter: `parent = "${postId}"`,
				sort: '-created',
				expand: 'user'
			});

			// Get attachments for comments
			const commentIds = commentsResult.items.map((comment) => comment.id);
			const attachmentsMap = new Map<string, PostAttachment[]>();

			if (commentIds.length > 0) {
				const attachmentsResult = await pb.collection('posts_attachments').getList(1, 500, {
					filter: commentIds.map((id) => `post = "${id}"`).join(' || ')
				});

				// Type assertion via unknown since RecordModel doesn't overlap with PostAttachment
				(attachmentsResult.items as unknown as PostAttachment[]).forEach((attachment: PostAttachment) => {
					if (!attachmentsMap.has(attachment.post)) {
						attachmentsMap.set(attachment.post, []);
					}
					attachmentsMap.get(attachment.post)?.push(attachment);
				});
			}

			const comments = commentsResult.items.map((comment) => ({
				...comment,
				author_name: comment.expand?.user?.name,
				author_username: comment.expand?.user?.username,
				author_avatar: comment.expand?.user?.avatar,
				attachments: attachmentsMap.get(comment.id) || [],
				// Add interaction status for authenticated users
				upvote: locals.user ? comment.upvotedBy?.includes(locals.user.id) || false : false,
				downvote: locals.user ? comment.downvotedBy?.includes(locals.user.id) || false : false,
				repost: locals.user ? comment.repostedBy?.includes(locals.user.id) || false : false,
				hasRead: locals.user ? comment.readBy?.includes(locals.user.id) || false : false,
				share: false,
				quote: false,
				preview: false,
				// Add expand data for PostCard compatibility
				expand: comment.expand
			}));

			return json({
				success: true,
				comments,
				totalPages: commentsResult.totalPages,
				totalItems: commentsResult.totalItems
			});
		} catch (err: unknown) {
			console.error(`Error fetching comments for post ${postId}:`, err);
			throw err instanceof Error ? err : new Error('Unknown error');
		}
	} catch (err: unknown) {
		console.error('Error in GET comment handler:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

// POST new comment
export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const postId = params.id;
		const data = await request.json();

		if (!data.content || !data.content.trim()) {
			return new Response(JSON.stringify({ error: 'Comment content is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		console.log(`Creating comment for post ${postId} by user ${locals.user.id}`);

		try {
			// Verify the parent post exists
			const parentPost = await pb.collection('posts').getOne(postId);
			
			// Create the comment with ALL required fields from Post interface
			const commentData: Partial<Post> = {
				content: data.content.trim(),
				user: locals.user.id,
				parent: postId,
				// Initialize all array fields as empty arrays
				children: [],
				upvotedBy: [],
				downvotedBy: [],
				repostedBy: [],
				commentedBy: [],
				sharedBy: [],
				quotedBy: [],
				readBy: [],
				// Initialize all count fields as 0
				upvoteCount: 0,
				downvoteCount: 0,
				repostCount: 0,
				commentCount: 0,
				shareCount: 0,
				quoteCount: 0,
				readCount: 0,
				// Initialize quotedPost as empty string
				quotedPost: ''
			};

			const comment = await pb.collection('posts').create(commentData);
			console.log(`Comment created with ID: ${comment.id}`);

			// Update parent post
			const children = parentPost.children || [];
			if (!children.includes(comment.id)) {
				children.push(comment.id);
			}

			const commentedBy = parentPost.commentedBy || [];
			if (!commentedBy.includes(locals.user.id)) {
				commentedBy.push(locals.user.id);
			}

			await pb.collection('posts').update(postId, {
				children,
				commentedBy,
				commentCount: (parentPost.commentCount || 0) + 1
			});

			console.log(`Updated parent post ${postId} with new comment`);

			// Fetch the comment with user data for response
			const commentWithUser = await pb.collection('posts').getOne(comment.id, {
				expand: 'user'
			});

			// Create a complete PostWithInteractionsExtended object
			const result: PostWithInteractionsExtended = {
				// Spread the comment data first to get all required Post fields
				id: commentWithUser.id,
				content: commentWithUser.content,
				user: commentWithUser.user,
				parent: commentWithUser.parent,
				created: commentWithUser.created,
				updated: commentWithUser.updated,
				// Ensure all Post fields are present
				attachments: [],
				upvotedBy: commentWithUser.upvotedBy || [],
				downvotedBy: commentWithUser.downvotedBy || [],
				repostedBy: commentWithUser.repostedBy || [],
				commentedBy: commentWithUser.commentedBy || [],
				sharedBy: commentWithUser.sharedBy || [],
				quotedBy: commentWithUser.quotedBy || [],
				readBy: commentWithUser.readBy || [],
				upvoteCount: commentWithUser.upvoteCount || 0,
				downvoteCount: commentWithUser.downvoteCount || 0,
				repostCount: commentWithUser.repostCount || 0,
				commentCount: commentWithUser.commentCount || 0,
				shareCount: commentWithUser.shareCount || 0,
				quoteCount: commentWithUser.quoteCount || 0,
				readCount: commentWithUser.readCount || 0,
				children: commentWithUser.children || [],
				quotedPost: commentWithUser.quotedPost || '',
				// Author fields from expanded user
				author_name: commentWithUser.expand?.user?.name,
				author_username: commentWithUser.expand?.user?.username,
				author_avatar: commentWithUser.expand?.user?.avatar,
				// Interaction status (all false for new comment)
				upvote: false,
				downvote: false,
				repost: false,
				hasRead: false,
				share: false,
				quote: false,
				preview: false,
				// Add expand data
				expand: commentWithUser.expand
			};

			console.log('Comment creation successful');
			return json({ success: true, comment: result });
		} catch (err) {
			console.error(`Error creating comment for post ${postId}:`, err);
			throw err;
		}
	} catch (err: unknown) {
		console.error('Error in POST comment handler:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: message
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};