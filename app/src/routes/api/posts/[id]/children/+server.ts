import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { PostChild } from '$lib/types/types.posts';

interface UserData {
	id: string;
	username: string;
	name: string;
	avatar?: string;
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
	return apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const postId = params.id;
			if (!postId) {
				throw new Error('Post ID is required');
			}

			const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
			const depth = parseInt(url.searchParams.get('depth') ?? '1', 10);

			console.log(`Fetching children for post ${postId} with depth ${depth}`);

			// Verify post exists
			await pb.collection('posts').getOne(postId);

			async function fetchChildrenRecursive(
				parentId: string,
				currentDepth: number
			): Promise<PostChild[]> {
				if (currentDepth > depth) return [];

				const childrenResult = await pb.collection('posts').getList(1, limit, {
					filter: `parent = "${parentId}"`,
					sort: '-created'
				});

				const userIds = [...new Set(childrenResult.items.map((child) => child.user as string))];

				const usersMap = new Map<string, UserData>();
				if (userIds.length > 0) {
					const usersResult = await pb.collection('users').getList(1, userIds.length, {
						filter: userIds.map((id) => `id = "${id}"`).join(' || '),
						fields: 'id,username,name,avatar'
					});

					for (const user of usersResult.items) {
						const userData = user as unknown as UserData;
						usersMap.set(userData.id, userData);
					}
				}

				const children: PostChild[] = [];
				for (const child of childrenResult.items) {
					const userData = usersMap.get(child.user as string);
					const userId = locals.user?.id;

					const upvote =
						Array.isArray(child.upvotedBy) && userId ? child.upvotedBy.includes(userId) : false;
					const downvote =
						Array.isArray(child.downvotedBy) && userId ? child.downvotedBy.includes(userId) : false;
					const repost =
						Array.isArray(child.repostedBy) && userId ? child.repostedBy.includes(userId) : false;
					const hasRead =
						Array.isArray(child.readBy) && userId ? child.readBy.includes(userId) : false;

					let subChildren: PostChild[] = [];
					if (
						currentDepth < depth &&
						((Array.isArray(child.childrenIds) && child.childrenIds.length > 0) ||
							(typeof child.commentCount === 'number' && child.commentCount > 0))
					) {
						subChildren = await fetchChildrenRecursive(child.id as string, currentDepth + 1);
					}

					children.push({
						id: child.id,
						user: child.user,
						parent: child.parent,
						content: child.content,
						created: child.created,
						upvotedBy: child.upvotedBy,
						downvotedBy: child.downvotedBy,
						repostedBy: child.repostedBy,
						readBy: child.readBy,
						childrenIds: child.childrenIds,
						commentCount: child.commentCount ?? 0,
						upvote,
						downvote,
						repost,
						hasRead,
						author_name: userData?.name,
						author_username: userData?.username,
						author_avatar: userData?.avatar,
						children: subChildren
					});
				}

				return children;
			}

			const children = await fetchChildrenRecursive(postId, 1);

			return {
				success: true,
				children
			};
		},
		'Failed to fetch post children',
		500
	);
};
