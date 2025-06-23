// src/routes/api/posts/+server.ts
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Post, PostWithInteractions, PostAttachment } from '$lib/types/types.posts';
import type { User } from '$lib/types/types';
import { getFileType } from '$lib/utils/fileHandlers';
import { apiTryCatch, pbTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) =>
	apiTryCatch(async () => {
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

		const isAuthenticated = !!locals.user;

		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const parent = url.searchParams.get('parent');

		const tagId = url.searchParams.get('tag');
		const tagIds = url.searchParams.get('tags')?.split(',').filter(Boolean);

		const page = Math.floor(offset / limit) + 1;
console.log(`Fetching posts: limit=${limit}, offset=${offset}, page=${page}, parent=${parent}`);

// First, let's see what's actually in the database WITHOUT any filters
try {
	const allPostsTest = await pb.collection('posts').getList(1, 5, {
		sort: '-created'
		// NO FILTER - see everything
	}) as PBListResult<Post>;
	
	console.log('📊 TOTAL POSTS IN DATABASE:', allPostsTest.totalItems);
	console.log('📊 SAMPLE POSTS (no filter):', allPostsTest.items.map(p => ({
		id: p.id,
		content: p.content?.substring(0, 50),
		parent: p.parent || '(empty/null)',
		user: p.user,
		created: p.created
	})));
	
	// Check what parent values actually exist
	const parentValues = allPostsTest.items.map(p => p.parent);
	console.log('📊 Parent field values found:', parentValues);
	console.log('📊 Empty parent count:', parentValues.filter(p => !p || p === '').length);
	console.log('📊 Non-empty parent count:', parentValues.filter(p => p && p !== '').length);
	
} catch (error) {
	console.error('❌ Error checking database:', error);
}

let filter = '';
if (parent) {
	// Getting comments for a specific post
	filter = `parent = "${parent}"`;
	console.log('🔍 Fetching comments for post:', parent);
} else {
	// Getting main posts (no parent)
	// In PocketBase, null/empty fields can be filtered with:
	filter = 'parent = "" || parent = null';
	console.log('🔍 Fetching main posts (no parent)');
}

// Add tag filters if present
if (tagId) {
	filter += ` && tags ~ "${tagId}"`;
	console.log('🏷️ Added tag filter:', tagId);
} else if (tagIds && tagIds.length > 0) {
	const tagFilters = tagIds.map((tag) => `tags ~ "${tag}"`).join(' && ');
	filter += ` && (${tagFilters})`;
	console.log('🏷️ Added tags filter:', tagIds);
}

console.log('🎯 Final filter:', filter);

// Make the actual query
const postsResult = (await pb.collection('posts').getList(page, limit, {
	filter: filter || undefined, // Don't pass empty string
	sort: '-created'
}) as PBListResult<Post>);

console.log('🎯 FINAL RESULT:', postsResult.totalItems, 'posts found with filter:', filter || '(none)');

		const userIds = [...new Set(postsResult.items.map((post: Post) => post.user))];

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

		const postsWithInteractions: PostWithInteractions[] = postsResult.items.map((post: Post) => {
			const userData = usersMap.get(post.user);
			const attachments = attachmentsMap.get(post.id) || [];

			const tags = post.tags || [];
			const tagCount = post.tagCount || tags.length || 0;

			const upvotedBy = post.upvotedBy || [];
			const downvotedBy = post.downvotedBy || [];
			const repostedBy = post.repostedBy || [];
			const readBy = post.readBy || [];
			const sharedBy = post.sharedBy || [];
			const quotedBy = post.quotedBy || [];
			const commentedBy = post.commentedBy || [];

			const upvote = isAuthenticated && locals.user ? upvotedBy.includes(locals.user.id) : false;
			const downvote =
				isAuthenticated && locals.user ? downvotedBy.includes(locals.user.id) : false;
			const repost = isAuthenticated && locals.user ? repostedBy.includes(locals.user.id) : false;
			const hasRead = isAuthenticated && locals.user ? readBy.includes(locals.user.id) : false;
			const share = isAuthenticated && locals.user ? sharedBy.includes(locals.user.id) : false;
			const quote = isAuthenticated && locals.user ? quotedBy.includes(locals.user.id) : false;

			const readCount = readBy.filter((id) => id !== post.user).length;

			return {
				...post,
				tags,
				tagCount,
				upvote,
				downvote,
				repost,
				hasRead,
				share,
				quote,
				author_name: userData?.name,
				author_username: userData?.username,
				author_avatar: userData?.avatar,
				attachments,

				upvoteCount: post.upvoteCount ?? upvotedBy.length ?? 0,
				downvoteCount: post.downvoteCount ?? downvotedBy.length ?? 0,
				repostCount: post.repostCount ?? repostedBy.length ?? 0,
				readCount: post.readCount ?? readCount ?? 0,
				shareCount: post.shareCount ?? sharedBy.length ?? 0,
				quoteCount: post.quoteCount ?? quotedBy.length ?? 0,
				commentCount: post.commentCount ?? commentedBy.length ?? 0,

				readBy,
				upvotedBy,
				downvotedBy,
				repostedBy,
				sharedBy,
				quotedBy,
				commentedBy
			} as PostWithInteractions;
		});

		const timelineWithReposts: TimelinePost[] = [];

		postsWithInteractions.forEach((post) => {
			timelineWithReposts.push({
				...post,
				isRepost: false
			});

			if (post.repostedBy && post.repostedBy.length > 0) {
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
							created: post.updated || post.created
						});
					}
				});
			}
		});

		timelineWithReposts.sort(
			(a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
		);

		console.log(`Successfully fetched ${timelineWithReposts.length} posts (including reposts)`);

		return {
			success: true,
			posts: timelineWithReposts,
			totalPages: postsResult.totalPages,
			totalItems: timelineWithReposts.length,
			filters: {
				tag: tagId,
				tags: tagIds,
				parent
			}
		};
	}, 'Failed to fetch posts', 500);

export const POST: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { request, locals } = event;
		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		console.log('Creating new post...');

		const formData = await request.formData();
		const content = formData.get('content') as string;
		const user = formData.get('user') as string;
		const parent = (formData.get('parent') as string) || '';

		if (!content || !content.trim()) {
			throw new Error('Content is required');
		}

		if (user !== locals.user.id) {
			throw new Error('Unauthorized to create post for another user');
		}

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
			tags: [],
			upvoteCount: 0,
			downvoteCount: 0,
			repostCount: 0,
			commentCount: 0,
			shareCount: 0,
			tagCount: 0,
			quoteCount: 0,
			readCount: 0,
			quotedPost: ''
		};

		if (parent && parent.trim()) {
			postData.parent = parent.trim();
		}

		const newPost = (await pb.collection('posts').create(postData)) as Post;

		console.log(`Post created with ID: ${newPost.id}`);

		if (parent && parent.trim()) {
			try {
				const parentPost = (await pb.collection('posts').getOne(parent)) as Post;
				const children = parentPost.children || [];
				const commentedBy = parentPost.commentedBy || [];

				if (!children.includes(newPost.id)) children.push(newPost.id);
				if (!commentedBy.includes(locals.user.id)) commentedBy.push(locals.user.id);

				await pb.collection('posts').update(parent, {
					children,
					commentedBy,
					commentCount: (parentPost.commentCount || 0) + 1
				});

				console.log(`Updated parent post ${parent} with new child ${newPost.id}`);
			} catch (parentError) {
				console.error('Error updating parent post:', parentError);
			}
		}

		const attachments: PostAttachment[] = [];
		for (const [key, file] of formData.entries()) {
			if (key.startsWith('attachment_') && file instanceof File) {
				try {
					console.log(`Processing attachment: ${file.name}`);

					const attachmentFormData = new FormData();
					attachmentFormData.append('post', newPost.id);
					attachmentFormData.append('file_path', file);
					attachmentFormData.append('file_type', getFileType(file.type));
					attachmentFormData.append('file_size', file.size.toString());
					attachmentFormData.append('original_name', file.name);
					attachmentFormData.append('mime_type', file.type);

					const attachment = (await pb
						.collection('posts_attachments')
						.create(attachmentFormData)) as PostAttachment;
					attachments.push(attachment);
					console.log(`Attachment created with ID: ${attachment.id}`);
				} catch (attachmentError) {
					console.error('Error creating attachment:', attachmentError);
				}
			}
		}

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
		return result;
	}, 'Failed to create post', 400);

export const PATCH: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const data = await request.json();
		const { id, postId, tags } = data;
		
		// Use id or postId (handle both for compatibility)
		const targetPostId = id || postId;
		
		if (!targetPostId) {
			throw new Error('Post ID is required');
		}

		if (!Array.isArray(tags)) {
			throw new Error('Tags must be an array');
		}

		console.log('Updating post tags:', { postId: targetPostId, tags });

		// Get the current post to verify ownership
		const currentPostResult = await pbTryCatch(
			pb.collection('posts').getOne(targetPostId),
			'fetch current post'
		);

		if (!currentPostResult.success) {
			throw new Error('Post not found');
		}

		const currentPost = currentPostResult.data;

		// Verify user has permission to modify this post
		if (currentPost.user !== locals.user.id) {
			throw new Error('Unauthorized to modify this post');
		}

		// Update the post with tags
		const updateData = {
			tags: tags,
			tagCount: tags.length
		};

		const updateResult = await pbTryCatch(
			pb.collection('posts').update(targetPostId, updateData),
			'update post with tags'
		);

		if (!updateResult.success) {
			throw new Error(updateResult.error);
		}

		const updatedPost = updateResult.data;
		console.log('Successfully updated post with tags:', updatedPost.id);

		return json({ 
			success: true, 
			data: updatedPost 
		});
	}, 'Failed to update post tags');