// src/routes/api/posts/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { PostAttachment, Post } from '$lib/types/types.posts';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

function getErrorStatus(error: unknown): number | null {
	if (error && typeof error === 'object' && 'status' in error) {
		return (error as { status: number }).status;
	}
	return null;
}

export const GET: RequestHandler = async ({ params, locals, cookies }) => {
	try {
		if (locals.user && cookies) {
			const authCookie = cookies.get('pb_auth');
			if (authCookie) {
				try {
					const authData = JSON.parse(authCookie);
					pb.authStore.save(authData.token, authData.model);
					console.log('✅ Server authenticated with user session');
				} catch (e) {
					console.error('Failed to parse auth cookie:', e);
				}
			}
		}
		const postId = params.id;
		console.log('Testing post ID:', postId);

		// Test 1: Check if post exists at all
		const posts = await pb.collection('posts').getList(1, 1, {
			filter: `id = "${postId}"`
		});

		console.log('Posts found:', posts.items.length);

		if (posts.items.length === 0) {
			return json({
				error: 'Post not found in database',
				postId,
				totalPosts: await pb
					.collection('posts')
					.getList(1, 1)
					.then((r) => r.totalItems)
			});
		}

		// Test 2: Try to get the post without expansion
		const post = await pb.collection('posts').getOne(postId);
		console.log('Post retrieved:', { id: post.id, user: post.user });

		// Test 3: Try to get the user separately
		let user;
		try {
			user = await pb.collection('users').getOne(post.user);
			console.log('User retrieved:', { id: user.id, username: user.username });
		} catch (error) {
			console.error('Error fetching user:', error);

			const status = getErrorStatus(error);
			if (status === 404 || status === 403 || status === 401) {
				user = {
					id: post.user,
					username: 'user',
					name: 'User',
					avatar: null
				};
				console.log('Using fallback user data for non-authenticated access');
			} else {
				throw error;
			}
		}

		const postAttachments = await pb.collection('posts_attachments').getFullList({
			filter: `post = "${postId}"`
		});
		console.log('Post attachments found:', postAttachments.length);

		console.log('Fetching ALL comments in thread for post:', postId);

		// STEP 1: Get direct comments
		const directComments = await pb.collection('posts').getList(1, 100, {
			filter: `parent = "${postId}"`,
			sort: 'created'
		});

		console.log('Direct comments found:', directComments.items.length);

		// STEP 2: Get nested replies (replies to comments)
		let allComments = [...directComments.items];

		if (directComments.items.length > 0) {
			const directCommentIds = directComments.items.map((c) => c.id);

			// Get replies to any of the direct comments
			const nestedReplies = await pb.collection('posts').getList(1, 200, {
				filter: directCommentIds.map((id) => `parent = "${id}"`).join(' || '),
				sort: 'created'
			});

			console.log('Nested replies found:', nestedReplies.items.length);
			allComments = [...allComments, ...nestedReplies.items];

			// STEP 3: Get deeper nesting if needed (replies to replies)
			if (nestedReplies.items.length > 0) {
				const nestedCommentIds = nestedReplies.items.map((c) => c.id);

				const deepNested = await pb.collection('posts').getList(1, 100, {
					filter: nestedCommentIds.map((id) => `parent = "${id}"`).join(' || '),
					sort: 'created'
				});

				if (deepNested.items.length > 0) {
					console.log('Deep nested replies found:', deepNested.items.length);
					allComments = [...allComments, ...deepNested.items];
				}
			}
		}

		const comments = { items: allComments };
		console.log('Total comments in thread:', comments.items.length);

		const commentUserIds = [...new Set(allComments.map((c) => c.user))];
		const commentUsers = new Map();
		for (const userId of commentUserIds) {
			try {
				const commentUser = await pb.collection('users').getOne(userId);
				commentUsers.set(userId, commentUser);
			} catch (error) {
				console.error('Error fetching comment user:', userId, error);

				const status = getErrorStatus(error);
				if (status === 404 || status === 403 || status === 401) {
					const fallbackUser = {
						id: userId,
						username: 'user',
						name: 'User',
						avatar: null
					};
					commentUsers.set(userId, fallbackUser);
					console.log('Using fallback user data for comment user:', userId);
				} else {
					throw error;
				}
			}
		}

		// Get comment attachments
		const commentIds = comments.items.map((c) => c.id);
		const commentAttachmentsMap = new Map();

		if (commentIds.length > 0) {
			const commentAttachments = await pb.collection('posts_attachments').getFullList({
				filter: commentIds.map((id) => `post = "${id}"`).join(' || ')
			});

			for (const attachment of commentAttachments) {
				if (!commentAttachmentsMap.has(attachment.post)) {
					commentAttachmentsMap.set(attachment.post, []);
				}
				commentAttachmentsMap.get(attachment.post).push(attachment);
			}
		}

		// Check user interactions if authenticated
		const isAuthenticated = !!locals.user;
		const userId = locals.user?.id;

		// Transform comments with all required data
		const transformedComments = comments.items.map((comment) => {
			const commentUser = commentUsers.get(comment.user);
			const upvotedBy = comment.upvotedBy || [];
			const downvotedBy = comment.downvotedBy || [];
			const repostedBy = comment.repostedBy || [];
			const readBy = comment.readBy || [];
			const sharedBy = comment.sharedBy || [];
			const quotedBy = comment.quotedBy || [];

			return {
				...comment,
				// Add expand object for PostCard fallback
				expand: commentUser ? { user: commentUser } : undefined,
				// Set author fields that PostCard expects
				author_name: commentUser?.name,
				author_username: commentUser?.username,
				author_avatar: commentUser?.avatar,
				// Include attachments
				attachments: commentAttachmentsMap.get(comment.id) || [],
				// User interaction states
				upvote: isAuthenticated && userId ? upvotedBy.includes(userId) : false,
				downvote: isAuthenticated && userId ? downvotedBy.includes(userId) : false,
				repost: isAuthenticated && userId ? repostedBy.includes(userId) : false,
				hasRead: isAuthenticated && userId ? readBy.includes(userId) : false,
				share: isAuthenticated && userId ? sharedBy.includes(userId) : false,
				quote: isAuthenticated && userId ? quotedBy.includes(userId) : false,
				preview: false,
				// Interaction counts
				upvoteCount: post.upvoteCount ?? upvotedBy.length ?? 0,
				downvoteCount: post.downvoteCount ?? downvotedBy.length ?? 0,
				repostCount: comment.repostCount || repostedBy.length,
				shareCount: comment.shareCount || sharedBy.length,
				quoteCount: comment.quoteCount || quotedBy.length,
				commentCount: comment.commentCount || 0,
				readCount: comment.readCount || readBy.filter((id: string) => id !== comment.user).length
			};
		});

		// Transform main post with all required data
		const upvotedBy = post.upvotedBy || [];
		const downvotedBy = post.downvotedBy || [];
		const repostedBy = post.repostedBy || [];
		const readBy = post.readBy || [];
		const sharedBy = post.sharedBy || [];
		const quotedBy = post.quotedBy || [];

		const transformedPost = {
			...post,
			// Add expand object for PostCard fallback
			expand: { user },
			// Set author fields that PostCard expects
			author_name: user.name,
			author_username: user.username,
			author_avatar: user.avatar,
			// Include attachments
			attachments: postAttachments,
			// User interaction states
			upvote: isAuthenticated && userId ? upvotedBy.includes(userId) : false,
			downvote: isAuthenticated && userId ? downvotedBy.includes(userId) : false,
			repost: isAuthenticated && userId ? repostedBy.includes(userId) : false,
			hasRead: isAuthenticated && userId ? readBy.includes(userId) : false,
			share: isAuthenticated && userId ? sharedBy.includes(userId) : false,
			quote: isAuthenticated && userId ? quotedBy.includes(userId) : false,
			preview: false,
			// Interaction counts
			upvoteCount: post.upvoteCount || upvotedBy.length,
			downvoteCount: post.downvoteCount || downvotedBy.length,
			repostCount: post.repostCount || repostedBy.length,
			shareCount: post.shareCount || sharedBy.length,
			quoteCount: post.quoteCount || quotedBy.length,
			commentCount: post.commentCount || comments.items.length,
			readCount: post.readCount || readBy.filter((id: string) => id !== post.user).length,
			// Add tags if they exist
			tags: post.tags || [],
			tagCount: post.tagCount || 0
		};

		console.log('✅ Successfully enhanced post data:', {
			postId: transformedPost.id,
			authorName: transformedPost.author_name,
			authorUsername: transformedPost.author_username,
			hasAvatar: !!transformedPost.author_avatar,
			attachmentsCount: transformedPost.attachments.length,
			commentsCount: transformedComments.length
		});

		return json({
			post: transformedPost,
			comments: transformedComments,
			user
		});
	} catch (error: unknown) {
		console.error('Test error:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const errorStack = error instanceof Error ? error.stack : undefined;

		return json(
			{
				error: errorMessage,
				stack: errorStack
			},
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = async ({ params, locals, url, request }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const postId = params.id;
		const userId = locals.user.id;
		const action = url.searchParams.get('action');

		console.log('🔗 PATCH called with:', { postId, userId, action });

		const post = unwrap(await pbTryCatch(pb.collection('posts').getOne<Post>(postId), 'get post'));

		// Handle different actions
		if (action === 'read') {
			const readBy = post.readBy || [];
			let hasRead = readBy.includes(userId);

			if (post.user !== userId && !hasRead) {
				readBy.push(userId);
				hasRead = true;

				const readCountExcludingAuthor = readBy.filter((id) => id !== post.user).length;
				const updatedPost = unwrap(
					await pbTryCatch(
						pb.collection('posts').update(postId, {
							readBy,
							readCount: readCountExcludingAuthor
						}),
						'update read state'
					)
				);

				return json({
					success: true,
					hasRead,
					readCount: updatedPost.readCount
				});
			} else {
				const currentReadCount = readBy.filter((id) => id !== post.user).length;
				return json({
					success: true,
					hasRead: post.user !== userId ? hasRead : false,
					readCount: currentReadCount
				});
			}
		}

		// Handle tag updates (for auto-tagging) - this runs when no action or update-tags action
		if (action === 'update-tags' || !action) {
			try {
				const requestData = await request.json();
				console.log('🔗 Request data received:', requestData);

				// Check if this is a tag update request
				if (requestData.tags !== undefined) {
					console.log('🔗 This is a tag update request');
					console.log('Updating post tags:', { postId, tags: requestData.tags });

					// Verify user has permission to modify this post
					if (post.user !== userId) {
						throw new Error('Unauthorized to modify this post');
					}

					if (!Array.isArray(requestData.tags)) {
						throw new Error('Tags must be an array');
					}

					// Update the post with new tags
					const updatedPost = unwrap(
						await pbTryCatch(
							pb.collection('posts').update(postId, {
								tags: requestData.tags,
								tagCount: requestData.tags.length
							}),
							'update post tags'
						)
					);

					console.log('Successfully updated post tags:', postId);
					console.log('Updated post object:', updatedPost);
					console.log('Updated post tags field:', updatedPost.tags);
					console.log('Updated post tagCount field:', updatedPost.tagCount);

					const response = {
						success: true,
						data: updatedPost
					};

					console.log('Returning response:', response);
					return json(response);
				} else {
					console.log('🔗 Not a tag update request, proceeding to vote handling');
				}
				// Handle assignedAgents updates
				if (requestData.assignedAgents !== undefined) {
					console.log('🔗 This is an assignedAgents update request');
					console.log('Updating post assignedAgents:', {
						postId,
						assignedAgents: requestData.assignedAgents
					});

					if (!Array.isArray(requestData.assignedAgents)) {
						throw new Error('assignedAgents must be an array');
					}

					// Update the post with new assigned agents
					const updatedPost = unwrap(
						await pbTryCatch(
							pb.collection('posts').update(postId, {
								assignedAgents: requestData.assignedAgents
							}),
							'update post assignedAgents'
						)
					);

					console.log('Successfully updated post assignedAgents:', postId);
					console.log('Updated post assignedAgents field:', updatedPost.assignedAgents);

					const response = {
						success: true,
						data: updatedPost
					};

					console.log('Returning assignedAgents update response:', response);
					return json(response);
				}
			} catch (jsonError) {
				console.error('🔗 JSON parsing failed:', jsonError);
				console.log('No JSON body found, treating as vote request');
			}
		}

		// Handle upvote action (default behavior) - only reached if not a tag update
		console.log('🔗 Handling vote action');
		let upvotedBy = post.upvotedBy || [];
		let downvotedBy = post.downvotedBy || [];
		let upvoted = false;

		if (upvotedBy.includes(userId)) {
			// Remove upvote
			upvotedBy = upvotedBy.filter((id) => id !== userId);
		} else {
			// Add upvote and remove any downvote
			upvotedBy.push(userId);
			upvoted = true;
			downvotedBy = downvotedBy.filter((id) => id !== userId);
		}

		const updatedPost = unwrap(
			await pbTryCatch(
				pb.collection('posts').update(postId, {
					upvotedBy,
					downvotedBy,
					upvoteCount: upvotedBy.length,
					downvoteCount: downvotedBy.length
				}),
				'update vote state'
			)
		);

		console.log('🔗 Vote update completed');
		return json({
			success: true,
			upvoted,
			upvoteCount: updatedPost.upvoteCount,
			downvoteCount: updatedPost.downvoteCount,
			upvotedBy: updatedPost.upvotedBy,
			downvotedBy: updatedPost.downvotedBy
		});
	}, 'Failed to update post');

export const DELETE: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const post = unwrap(
			await pbTryCatch(pb.collection('posts').getOne<Post>(params.id), 'get post')
		);

		if (post.user !== locals.user.id) {
			throw new Error('Unauthorized to delete this post');
		}

		// Delete attachments
		const attachments = await pb.collection('posts_attachments').getFullList<PostAttachment>({
			filter: `post = "${params.id}"`
		});
		for (const attachment of attachments) {
			await pbTryCatch(
				pb.collection('posts_attachments').delete(attachment.id),
				'delete attachment'
			);
		}

		// Delete comments
		const comments = await pb.collection('posts').getFullList<Post>({
			filter: `parent = "${params.id}"`
		});
		for (const comment of comments) {
			await pbTryCatch(pb.collection('posts').delete(comment.id), 'delete comment');
		}

		// Delete the post
		await pbTryCatch(pb.collection('posts').delete(params.id), 'delete post');

		return json({ success: true });
	}, 'Failed to delete post');
