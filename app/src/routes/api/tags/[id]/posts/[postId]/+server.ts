import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { Tag } from '$lib/types/types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const DELETE: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const tagId = params.id;
			const postId = params.postId;

			if (!tagId || !postId) {
				throw new Error('Tag ID and Post ID are required');
			}

			console.log('Removing post from tag:', { tagId, postId });

			const tag = (await pb.collection('tags').getOne(tagId)) as Tag;

			if (tag.createdBy !== locals.user.id) {
				throw new Error('Unauthorized to modify this tag');
			}

			const taggedPosts = tag.taggedPosts || [];
			const updatedTaggedPosts = taggedPosts.filter((id) => id !== postId);

			if (updatedTaggedPosts.length !== taggedPosts.length) {
				const updatedTag = (await pb.collection('tags').update(tagId, {
					taggedPosts: updatedTaggedPosts
				})) as Tag;

				console.log('Successfully removed post from tag:', { tagId, postId });
				return {
					success: true,
					message: 'Post removed from tag',
					tag: updatedTag
				};
			} else {
				console.log('Post was not tagged:', { tagId, postId });
				return {
					success: true,
					message: 'Post was not associated with this tag',
					tag
				};
			}
		},
		'Failed to remove post from tag',
		500
	);
