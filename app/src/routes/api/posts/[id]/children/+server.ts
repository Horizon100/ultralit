import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

// Define interfaces for better type safety
interface PostChild {
	id: string;
	user: string;
	parent?: string;
	content?: string;
	created: string;
	upvotedBy?: string[];
	downvotedBy?: string[];
	repostedBy?: string[];
	readBy?: string[];
	childrenIds?: string[];
	commentCount: number;
	upvote: boolean;
	downvote: boolean;
	repost: boolean;
	hasRead: boolean;
	author_name?: string;
	author_username?: string;
	author_avatar?: string;
	children: PostChild[];
}

interface UserData {
	id: string;
	username: string;
	name: string;
	avatar?: string;
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		// Check authentication
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const postId = params.id;
		if (!postId) {
			return new Response(JSON.stringify({ error: 'Post ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const limit = parseInt(url.searchParams.get('limit') || '20');
		const depth = parseInt(url.searchParams.get('depth') || '1');

		console.log(`Fetching children for post ${postId} with depth ${depth}`);

		// Get post to verify it exists
		await pb.collection('posts').getOne(postId);

		// Define a recursive function to fetch children with proper return type
		async function fetchChildrenRecursive(
			parentId: string,
			currentDepth: number
		): Promise<PostChild[]> {
			if (currentDepth > depth) return [];

			// Fetch direct children
			const childrenResult = await pb.collection('posts').getList(1, limit, {
				filter: `parent = "${parentId}"`,
				sort: '-created'
			});

			// Get unique user IDs
			const userIds = [
				...new Set(
					childrenResult.items.map((child: Record<string, unknown>) => child.user as string)
				)
			];

			// Batch fetch user data
			const usersMap = new Map<string, UserData>();
			if (userIds.length > 0) {
				const usersResult = await pb.collection('users').getList(1, userIds.length, {
					filter: userIds.map((id) => `id = "${id}"`).join(' || '),
					fields: 'id,username,name,avatar'
				});

				usersResult.items.forEach((user: Record<string, unknown>) => {
					const userData = user as unknown as UserData;
					usersMap.set(userData.id, userData);
				});
			}

			// Process each child
			const children: PostChild[] = await Promise.all(
				childrenResult.items.map(async (child: Record<string, unknown>): Promise<PostChild> => {
					const userData = usersMap.get(child.user as string);

					// Check if user has interacted with this post
					const upvote = (child.upvotedBy as string[])?.includes(locals.user!.id) || false;
					const downvote = (child.downvotedBy as string[])?.includes(locals.user!.id) || false;
					const repost = (child.repostedBy as string[])?.includes(locals.user!.id) || false;
					const hasRead = (child.readBy as string[])?.includes(locals.user!.id) || false;

					// Recursively fetch child's children if needed
					let subChildren: PostChild[] = [];
					if (
						currentDepth < depth &&
						((child.childrenIds as string[])?.length > 0 || (child.commentCount as number) > 0)
					) {
						subChildren = await fetchChildrenRecursive(child.id as string, currentDepth + 1);
					}

					return {
						...(child as Omit<
							PostChild,
							| 'upvote'
							| 'downvote'
							| 'repost'
							| 'hasRead'
							| 'author_name'
							| 'author_username'
							| 'author_avatar'
							| 'children'
						>),
						upvote,
						downvote,
						repost,
						hasRead,
						author_name: userData?.name,
						author_username: userData?.username,
						author_avatar: userData?.avatar,
						children: subChildren
					};
				})
			);

			return children;
		}

		// Start the recursive fetch
		const children = await fetchChildrenRecursive(postId, 1);

		return json({
			success: true,
			children
		});
	} catch (error: unknown) {
		console.error('Error fetching post children:', error);

		if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
			return new Response(JSON.stringify({ error: 'Post not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
