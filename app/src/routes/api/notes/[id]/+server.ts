// src/routes/api/notes/[id]/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = params;
        
        if (!id) {
            return json(
                { success: false, error: 'Note ID is required' },
                { status: 400 }
            );
        }

        // Fetch note with expanded relations
        const note = await pb.collection('notes').getOne(id, {
            expand: 'createdBy,attachments'
        });

        // Verify ownership
        if (note.createdBy !== locals.user.id) {
            return json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        return json({ success: true, note });
    } catch (error: unknown) {
        console.error('Error fetching note:', error);
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
            return json(
                { success: false, error: 'Note not found' },
                { status: 404 }
            );
        }
        return json(
            { success: false, error: 'Failed to fetch note' },
            { status: 500 }
        );
    }
};