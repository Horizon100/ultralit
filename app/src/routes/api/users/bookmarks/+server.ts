import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { userId, bookmarks } = await request.json();
        
        // Update user in PocketBase
        await pb.collection('users').update(userId, {
            bookmarks: bookmarks
        });

        return json({ success: true });
    } catch (error) {
        console.error('Error updating bookmarks:', error);
        return json({ success: false, error: error.message }, { status: 500 });
    }
};