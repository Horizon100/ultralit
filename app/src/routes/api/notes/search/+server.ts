// src/routes/api/notes/search/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.user) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const searchTerm = url.searchParams.get('q');
        
        if (!searchTerm) {
            return json(
                { success: false, error: 'Search term is required' },
                { status: 400 }
            );
        }

        // Search notes by title and content for the current user
        const notes = await pb.collection('notes').getFullList({
            filter: `createdBy="${locals.user.id}" && (title ~ "${searchTerm}" || content ~ "${searchTerm}")`,
            sort: '-created',
            expand: 'createdBy,attachments'
        });

        return json({ success: true, notes });
    } catch (error) {
        console.error('Error searching notes:', error);
        return json(
            { success: false, error: 'Failed to search notes' },
            { status: 500 }
        );
    }
};