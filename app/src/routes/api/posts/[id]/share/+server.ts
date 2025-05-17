import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const postId = params.id;
        const userId = locals.user.id;

        // Get the current post
        const post = await pb.collection('posts').getOne(postId);
        
        const sharedBy = post.sharedBy || [];
        const hasShared = sharedBy.includes(userId);
        
        // Only increment if user hasn't already shared
        if (!hasShared) {
            const updatedSharedBy = [...sharedBy, userId];
            const shareCount = (post.shareCount || 0) + 1;
            
            // Update the post
            const updatedPost = await pb.collection('posts').update(postId, {
                sharedBy: updatedSharedBy,
                shareCount: shareCount
            });

            return json({
                success: true,
                shareCount: shareCount,
                sharedBy: updatedSharedBy,
                alreadyShared: false
            });
        } else {
            // User already shared, just return current state
            return json({
                success: true,
                shareCount: post.shareCount || 0,
                sharedBy: sharedBy,
                alreadyShared: true
            });
        }
    } catch (error) {
        console.error('Error sharing post:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to share post';
        return json({ error: errorMessage }, { status: 500 });
    }
};