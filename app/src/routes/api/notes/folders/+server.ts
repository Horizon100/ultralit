// src/routes/api/notes/folders/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch notes folders for the current user
        const folders = await pb.collection('notes_folders').getFullList({
            filter: `createdBy="${locals.user.id}"`,
            sort: 'order,created'
        });

        return json({ success: true, folders });
    } catch (error) {
        console.error('Error fetching folders:', error);
        return json(
            { success: false, error: 'Failed to fetch folders' },
            { status: 500 }
        );
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const data = await request.json();
        
        // Validate required fields
        if (!data.title) {
            return json(
                { success: false, error: 'Title is required' },
                { status: 400 }
            );
        }

        // Create folder
        const folder = await pb.collection('notes_folders').create({
            title: data.title,
            order: data.order || 0,
            parentId: data.parentId || null,
            createdBy: locals.user.id
        });

        return json({ success: true, folder });
    } catch (error) {
        console.error('Error creating folder:', error);
        return json(
            { success: false, error: 'Failed to create folder' },
            { status: 500 }
        );
    }
};

export const PUT: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const data = await request.json();
        const { id, ...updateData } = data;
        
        if (!id) {
            return json(
                { success: false, error: 'Folder ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership
        const existingFolder = await pb.collection('notes_folders').getOne(id);
        if (existingFolder.createdBy !== locals.user.id) {
            return json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        // Update folder
        const folder = await pb.collection('notes_folders').update(id, updateData);

        return json({ success: true, folder });
    } catch (error) {
        console.error('Error updating folder:', error);
        return json(
            { success: false, error: 'Failed to update folder' },
            { status: 500 }
        );
    }
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
    if (!locals.user) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const id = url.searchParams.get('id');
        
        if (!id) {
            return json(
                { success: false, error: 'Folder ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership
        const folder = await pb.collection('notes_folders').getOne(id);
        if (folder.createdBy !== locals.user.id) {
            return json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        // Check for child notes
        const childNotes = await pb.collection('notes').getList(1, 1, {
            filter: `folder="${id}"`
        });

        if (childNotes.totalItems > 0) {
            return json(
                { success: false, error: 'Cannot delete folder with notes. Move notes first.' },
                { status: 400 }
            );
        }

        // Delete folder
        await pb.collection('notes_folders').delete(id);

        return json({ success: true });
    } catch (error) {
        console.error('Error deleting folder:', error);
        return json(
            { success: false, error: 'Failed to delete folder' },
            { status: 500 }
        );
    }
};