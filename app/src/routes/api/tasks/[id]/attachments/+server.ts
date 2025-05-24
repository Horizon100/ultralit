// src/routes/api/tasks/[id]/attachments/+server.ts
import { json, error } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Get all attachments for a specific task
export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check if user has access to this task
        const task = await pb.collection('tasks').getOne(params.id);
        
        if (task.createdBy !== locals.user.id) {
            // If task is in a project, check project permissions
            if (task.project_id) {
                const project = await pb.collection('projects').getOne(task.project_id);
                if (project.owner !== locals.user.id && 
                    !project.collaborators.includes(locals.user.id)) {
                    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                        status: 403, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
            } else {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                    status: 403, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
        }

        // Get all attachments for this task
        const attachments = await pb.collection('attachments').getList(1, 100, {
            filter: `attachedTasks~"${params.id}"`,
            sort: '-created'
        });

        // Add URLs to attachments
        const items = attachments.items.map(attachment => ({
            ...attachment,
            url: pb.getFileUrl(attachment, attachment.file)
        }));

        return json({
            ...attachments,
            items
        });
    } catch (err) {
        console.error('Error fetching task attachments:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch task attachments';
        throw error(500, errorMessage);
    }
};
