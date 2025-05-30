import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Post, PostWithInteractions, PostAttachment } from '$lib/types/types.posts';
import type { User } from '$lib/types/types';


export const GET: RequestHandler = async ({ url, locals }) => {
	interface PBListResult<T> {
	items: T[];
	totalPages: number;
	totalItems: number;
	page: number;
	perPage: number;
}

interface TimelinePost extends PostWithInteractions {
	isRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
}
	try {
		// Modified: Allow both authenticated and guest users to view posts
		const isAuthenticated = !!locals.user;

		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const parent = url.searchParams.get('parent');

		// Calculate page number from offset
		const page = Math.floor(offset / limit) + 1;

		console.log(`Fetching posts: limit=${limit}, offset=${offset}, page=${page}, parent=${parent}`);

		// Build filter for parent posts or child posts
		let filter = '';
		if (parent) {
			// Fetch child posts (comments) of a specific parent
			filter = `parent = "${parent}"`;
		} else {
			// Fetch only top-level posts (no parent) - check for empty string and null
			filter = 'parent = "" || parent = null';
		}

		// Fetch posts without expand
		const postsResult = (await pb.collection('posts').getList(page, limit, {
			filter,
			sort: '-created'
		})) as PBListResult<Post>;

		// Get unique user IDs from posts
		const userIds = [...new Set(postsResult.items.map((post: Post) => post.user))];

		// Batch fetch user data
		const usersMap = new Map<string, User>();
		if (userIds.length > 0) {
			const usersResult = (await pb.collection('users').getList(1, userIds.length, {
				filter: userIds.map((id) => `id = "${id}"`).join(' || '),
				fields: 'id,username,name,avatar'
			})) as PBListResult<User>;

			usersResult.items.forEach((user: User) => {
				usersMap.set(user.id, user);
			});
		}

		// Get attachments for all posts
		const postIds = postsResult.items.map((post: Post) => post.id);
		const attachmentsMap = new Map<string, PostAttachment[]>();

		if (postIds.length > 0) {
			const attachmentsResult = (await pb.collection('posts_attachments').getList(1, 500, {
				filter: postIds.map((id) => `post = "${id}"`).join(' || ')
			})) as PBListResult<PostAttachment>;

			attachmentsResult.items.forEach((attachment: PostAttachment) => {
				if (!attachmentsMap.has(attachment.post)) {
					attachmentsMap.set(attachment.post, []);
				}
				const attachmentsList = attachmentsMap.get(attachment.post);
				if (attachmentsList) {
					attachmentsList.push(attachment);
				}
			});
		}

		// Transform posts and add interaction status
		const postsWithInteractions: PostWithInteractions[] = postsResult.items.map((post: Post) => {
			const userData = usersMap.get(post.user);
			const attachments = attachmentsMap.get(post.id) || [];

			// Check if user has interacted with this post (only if authenticated)
			const upvote = isAuthenticated && locals.user ? post.upvotedBy?.includes(locals.user.id) || false : false;
			const downvote = isAuthenticated && locals.user
				? post.downvotedBy?.includes(locals.user.id) || false
				: false;
			const repost = isAuthenticated && locals.user ? post.repostedBy?.includes(locals.user.id) || false : false;
			const hasRead = isAuthenticated && locals.user ? post.readBy?.includes(locals.user.id) || false : false;
			return {
				...post,
				upvote,
				downvote,
				repost,
				hasRead,
				share: false,
				quote: false,
				author_name: userData?.name,
				author_username: userData?.username,
				author_avatar: userData?.avatar,
				attachments
			} as PostWithInteractions;
		});

		const timelineWithReposts: TimelinePost[] = [];

		postsWithInteractions.forEach((post) => {
			// Add the original post
			timelineWithReposts.push({
				...post,
				isRepost: false
			});

			// Add repost entries for each user who reposted this post
			if (post.repostedBy && post.repostedBy.length > 0) {
				// Get reposter user data
				const reposters = post.repostedBy.map((userId) => usersMap.get(userId)).filter(Boolean);

				reposters.forEach((reposter) => {
					if (reposter) {
						timelineWithReposts.push({
							...post,
							id: `repost_${post.id}_${reposter.id}`,
							isRepost: true,
							originalPostId: post.id,
							repostedBy_id: reposter.id,
							repostedBy_username: reposter.username,
							repostedBy_name: reposter.name,
							repostedBy_avatar: reposter.avatar,
							created: post.updated || post.created // Use repost time if available
						});
					}
				});
			}
		});

		// Sort by created/updated time to maintain chronological order
		timelineWithReposts.sort(
			(a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
		);

		console.log(`Successfully fetched ${timelineWithReposts.length} posts (including reposts)`);

		return json({
			success: true,
			posts: timelineWithReposts, // Use enhanced timeline
			totalPages: postsResult.totalPages,
			totalItems: timelineWithReposts.length
		});
	} catch (error: unknown) {
		console.error('Error fetching posts:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const errorStack = error instanceof Error ? error.stack : undefined;

		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: errorMessage,
				stack: errorStack
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		console.log('Creating new post...');

		const formData = await request.formData();
		const content = formData.get('content') as string;
		const user = formData.get('user') as string;
		const parent = (formData.get('parent') as string) || '';

		if (!content || !content.trim()) {
			return new Response(JSON.stringify({ error: 'Content is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Verify user authorization
		if (user !== locals.user.id) {
			return new Response(
				JSON.stringify({ error: 'Unauthorized to create post for another user' }),
				{
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		try {
			// Create the post with proper field names
			const postData: Partial<Post> = {
				content: content.trim(),
				user: locals.user.id,
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
				quotedPost: ''
			};

			// Only set parent if it's not empty
			if (parent && parent.trim()) {
				postData.parent = parent.trim();
			}

			const newPost = (await pb.collection('posts').create(postData)) as Post;

			console.log(`Post created with ID: ${newPost.id}`);

			// If this is a comment (has parent), update the parent's children array
			if (parent && parent.trim()) {
				try {
					const parentPost = (await pb.collection('posts').getOne(parent)) as Post;
					const children = parentPost.children || [];
					const commentedBy = parentPost.commentedBy || [];

					// Add to children if not already there
					if (!children.includes(newPost.id)) {
						children.push(newPost.id);
					}

					// Add user to commentedBy if not already there
					if (!commentedBy.includes(locals.user.id)) {
						commentedBy.push(locals.user.id);
					}

					// Update parent post with new child and increment comment count
					await pb.collection('posts').update(parent, {
						children,
						commentedBy,
						commentCount: (parentPost.commentCount || 0) + 1
					});

					console.log(`Updated parent post ${parent} with new child ${newPost.id}`);
				} catch (parentError) {
					console.error('Error updating parent post:', parentError);
					// Don't fail the creation if parent update fails
				}
			}

			// Handle attachments if any
			const attachments: PostAttachment[] = [];
			for (const [key, file] of formData.entries()) {
				if (key.startsWith('attachment_') && file instanceof File) {
					try {
						console.log(`Processing attachment: ${file.name}`);

						// Create attachment in the posts_attachments collection
						const attachmentFormData = new FormData();
						attachmentFormData.append('post', newPost.id);
						attachmentFormData.append('file_path', file); // This will be handled by PocketBase
						attachmentFormData.append('file_type', getFileType(file.type));
						attachmentFormData.append('file_size', file.size.toString());
						attachmentFormData.append('original_name', file.name);
						attachmentFormData.append('mime_type', file.type);

						// Create in the posts_attachments collection
						const attachment = (await pb
							.collection('posts_attachments')
							.create(attachmentFormData)) as PostAttachment;
						attachments.push(attachment);
						console.log(`Attachment created with ID: ${attachment.id}`);
					} catch (attachmentError) {
						console.error('Error creating attachment:', attachmentError);
						// Continue with post creation even if attachment fails
					}
				}
			}

			// Fetch user data for the response
			const userData = (await pb.collection('users').getOne(locals.user.id, {
				fields: 'id,username,name,avatar'
			})) as User;

			const result: PostWithInteractions = {
				...newPost,
				upvote: false,
				downvote: false,
				repost: false,
				preview: false,
				hasRead: false,
				share: false,
				quote: false,
				author_name: userData.name,
				author_username: userData.username,
				author_avatar: userData.avatar,
				attachments
			};

			console.log('Post creation successful');
			return json(result);
		} catch (err: unknown) {
			console.error('Error in post creation process:', err);

			if (err && typeof err === 'object' && 'data' in err) {
				return new Response(
					JSON.stringify({
						error: 'Validation error',
						details: (err as { data: unknown }).data
					}),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			throw err;
		}
	} catch (error: unknown) {
		console.error('Error in POST handler:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const errorStack = error instanceof Error ? error.stack : undefined;

		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: errorMessage,
				stack: errorStack
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

function getFileType(
	mimeType: string
):
	| 'image'
	| 'video'
	| 'document'
	| 'audio'
	| 'archive'
	| 'spreadsheet'
	| 'presentation'
	| 'code'
	| 'ebook' {
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType.startsWith('audio/')) return 'audio';

	// Archive files
	if (
		mimeType.includes('zip') ||
		mimeType.includes('rar') ||
		mimeType.includes('7z') ||
		mimeType.includes('tar') ||
		mimeType.includes('gz')
	)
		return 'archive';

	// Spreadsheet files
	if (
		mimeType.includes('spreadsheet') ||
		mimeType.includes('excel') ||
		mimeType.includes('csv') ||
		mimeType === 'application/vnd.ms-excel' ||
		mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	)
		return 'spreadsheet';

	// Presentation files
	if (
		mimeType.includes('presentation') ||
		mimeType.includes('powerpoint') ||
		mimeType === 'application/vnd.ms-powerpoint' ||
		mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	)
		return 'presentation';

	// Code files
	if (
		mimeType.startsWith('text/') &&
		(mimeType.includes('javascript') ||
			mimeType.includes('css') ||
			mimeType.includes('html') ||
			mimeType.includes('xml') ||
			mimeType.includes('json') ||
			mimeType.includes('typescript'))
	)
		return 'code';

	// Ebook files
	if (
		mimeType.includes('epub') ||
		mimeType.includes('mobi') ||
		mimeType === 'application/x-mobipocket-ebook'
	)
		return 'ebook';

	// Default to document for everything else (PDF, Word, etc.)
	return 'document';
}
