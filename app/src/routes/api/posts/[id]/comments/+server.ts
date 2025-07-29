import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Post, PostAttachment, PostWithInteractionsExtended } from '$lib/types/types.posts';


export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const postId = params.id;
		const limit = parseInt(url.searchParams.get('limit') || '40');

		console.log(`Fetching ALL comments for post thread ${postId}`);

		try {
			// STEP 1: Fetch direct comments (replies to the main post)
			const directCommentsResult = await pb.collection('posts').getList(1, limit, {
				filter: `parent = "${postId}"`,
				sort: '-created',
				expand: 'user'
			});

			console.log(`📝 Found ${directCommentsResult.items.length} direct comments`);

			// STEP 2: Fetch nested replies (replies to comments)
			let allComments = [...directCommentsResult.items];
			
			if (directCommentsResult.items.length > 0) {
				const commentIds = directCommentsResult.items.map(c => c.id);
				
				// Fetch all replies to any of the direct comments
				const nestedRepliesResult = await pb.collection('posts').getList(1, 200, {
					filter: commentIds.map(id => `parent = "${id}"`).join(' || '),
					sort: '-created',
					expand: 'user'
				});
				
				console.log(`📝 Found ${nestedRepliesResult.items.length} nested replies`);
				
				// Add nested replies to the full comments array
				allComments = [...allComments, ...nestedRepliesResult.items];
				
				// STEP 3: Handle deeper nesting (replies to replies) if needed
				if (nestedRepliesResult.items.length > 0) {
					const nestedCommentIds = nestedRepliesResult.items.map(c => c.id);
					
					const deepNestedResult = await pb.collection('posts').getList(1, 100, {
						filter: nestedCommentIds.map(id => `parent = "${id}"`).join(' || '),
						sort: '-created',
						expand: 'user'
					});
					
					if (deepNestedResult.items.length > 0) {
						console.log(`📝 Found ${deepNestedResult.items.length} deep nested replies`);
						allComments = [...allComments, ...deepNestedResult.items];
					}
				}
			}

			console.log(`📝 Total comments in thread: ${allComments.length}`);

			// Get attachments for ALL comments
			const allCommentIds = allComments.map((comment) => comment.id);
			const attachmentsMap = new Map<string, PostAttachment[]>();

			if (allCommentIds.length > 0) {
				const attachmentsResult = await pb.collection('posts_attachments').getList(1, 500, {
					filter: allCommentIds.map((id) => `post = "${id}"`).join(' || ')
				});

				(attachmentsResult.items as unknown as PostAttachment[]).forEach(
					(attachment: PostAttachment) => {
						if (!attachmentsMap.has(attachment.post)) {
							attachmentsMap.set(attachment.post, []);
						}
						attachmentsMap.get(attachment.post)?.push(attachment);
					}
				);
			}

			const comments = allComments.map((comment) => ({
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
				expand: comment.expand
			}));

			return json({
				success: true,
				comments,
				totalPages: Math.max(directCommentsResult.totalPages, 1),
				totalItems: allComments.length
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
			const parentPost = await pb.collection('posts').getOne(postId);

			const commentData: Partial<Post> = {
				content: data.content.trim(),
				user: locals.user.id,
				parent: postId,
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
				readCount: 0,
				quotedPost: '',
    			assignedAgents: []
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

			const commentWithUser = await pb.collection('posts').getOne(comment.id, {
				expand: 'user'
			});

			const result: PostWithInteractionsExtended = {
				id: commentWithUser.id,
				content: commentWithUser.content,
				user: commentWithUser.user,
				parent: commentWithUser.parent,
				created: commentWithUser.created,
				updated: commentWithUser.updated,
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
				tagCount: commentWithUser.tagCount || 0,
				tags: commentWithUser.tags || [],
				assignedAgents: commentWithUser.assignedAgents || [],
				children: commentWithUser.children || [],
				quotedPost: commentWithUser.quotedPost || '',
				author_name: commentWithUser.expand?.user?.name,
				author_username: commentWithUser.expand?.user?.username,
				author_avatar: commentWithUser.expand?.user?.avatar,
				upvote: false,
				downvote: false,
				repost: false,
				hasRead: false,
				share: false,
				quote: false,
				preview: false,
				expand: commentWithUser.expand
			};


console.log('Comment creation successful');

// AUTO-REPLY TRIGGERING - Enhanced to support agents on both parent posts AND comments
const autoRepliesCreated = [];

try {
    console.log('🤖 Checking for assigned agents on parent post AND new comment...');
    
    // Check parent post for assigned agents (existing logic)
    const parentPostWithAgents = await pb.collection('posts').getOne(postId);
    
    console.log('🤖 Parent post assigned agents:', {
        hasAssignedAgents: !!parentPostWithAgents.assignedAgents,
        assignedAgents: parentPostWithAgents.assignedAgents,
        assignedAgentCount: parentPostWithAgents.assignedAgents?.length || 0
    });
    
    // Check new comment for assigned agents (new logic)
    const newCommentWithAgents = await pb.collection('posts').getOne(comment.id);
    
    console.log('🤖 New comment assigned agents:', {
        hasAssignedAgents: !!newCommentWithAgents.assignedAgents,
        assignedAgents: newCommentWithAgents.assignedAgents,
        assignedAgentCount: newCommentWithAgents.assignedAgents?.length || 0
    });
    
    // Combine agents from both parent and comment (remove duplicates)
    const parentAgents = parentPostWithAgents.assignedAgents || [];
    const commentAgents = newCommentWithAgents.assignedAgents || [];
    const allAssignedAgents = new Set([...parentAgents, ...commentAgents]);
    
    console.log('🤖 Combined assigned agents:', {
        parentAgents: parentAgents,
        commentAgents: commentAgents,
        combinedAgents: Array.from(allAssignedAgents),
        totalCount: allAssignedAgents.size
    });
    
    if (allAssignedAgents.size > 0) {
        console.log('🤖 Found assigned agents, triggering auto-replies for comment:', comment.id);
        
        for (const agentId of allAssignedAgents) {
            try {
                console.log('🤖 Processing auto-reply for agent:', agentId);
                
                const autoReplyResponse = await fetch(`http://localhost:5173/api/agents/${agentId}/auto-reply`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': request.headers.get('cookie') || ''
                    },
                    body: JSON.stringify({ postId: comment.id })
                });
                
                console.log('🤖 Auto-reply response status:', autoReplyResponse.status);
                
                if (autoReplyResponse.ok) {
                    const autoReplyResult = await autoReplyResponse.json();
                    console.log('🤖 Full auto-reply response:', autoReplyResult);
                    
                    const actualResult = autoReplyResult.data || autoReplyResult;
                    
                    if (actualResult.success && !actualResult.skipped) {
                        let replyId = null;
                        
                        if (actualResult.reply?.id) {
                            replyId = actualResult.reply.id;
                            console.log('🤖 Found reply ID via reply.id:', replyId);
                        }
                        else if (typeof actualResult.reply === 'string') {
                            replyId = actualResult.reply;
                            console.log('🤖 Found reply ID as string:', replyId);
                        }
                        
                        console.log('🤖 Auto-reply created successfully:', replyId);
                        
                        if (replyId) {
                            autoRepliesCreated.push(replyId);
                        } else {
                            console.warn('🤖 Reply created but no ID found in response structure');
                        }
                    } else if (actualResult.skipped) {
                        console.log('🤖 Auto-reply skipped:', actualResult.reason);
                        if (actualResult.existing_reply?.id) {
                            console.log('🤖 Existing reply found:', actualResult.existing_reply.id);
                        }
                    } else {
                        console.error('🤖 Auto-reply failed:', actualResult);
                    }
                } else {
                    const errorText = await autoReplyResponse.text();
                    console.error('🤖 Auto-reply endpoint error:', autoReplyResponse.status, errorText);
                }
                
            } catch (agentError) {
                console.error('🤖 Error calling auto-reply for agent', agentId, ':', agentError);
            }
        }
    } else {
        console.log('🤖 No assigned agents found on parent post or new comment');
    }
} catch (autoReplyError) {
    console.error('🤖 Error in auto-reply process:', autoReplyError);
}

return json({ 
    success: true, 
    comment: result,
    autoRepliesCreated: autoRepliesCreated
});
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