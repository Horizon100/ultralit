// src/routes/api/threads/batch/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Get IDs from query params
        const ids = url.searchParams.get('ids');
        
        if (!ids) {
            return new Response(JSON.stringify({ error: 'No IDs provided' }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        // Split and filter out empty strings
        const idArray = ids.split(',').filter(Boolean);
        
        if (idArray.length === 0) {
            return json({ items: [] });
        }
        
        // Assuming threads are part of projects, fetch threads by ID with access control
        const threads = await pb.collection('threads').getList(1, idArray.length, {
            filter: idArray.map(id => `id="${id}"`).join(' || '),
            expand: 'project_id'
        });
        
        const userId = locals.user.id;

        // Filter threads to only include those the user has access to
        const accessibleThreads = threads.items.filter(thread => {
            // User is the creator/owner
            if (thread.user === userId) return true;
            
            // Check project access if thread belongs to a project
            if (thread.project_id && thread.expand?.project_id) {
                const project = thread.expand.project_id;
                return project.owner === userId ||
                    (project.collaborators && project.collaborators.includes(userId));
            }
            
            return false;
        });
        
        return json({
            ...threads,
            items: accessibleThreads
        });
    } catch (error) {
        console.error('Error fetching threads batch:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return new Response(JSON.stringify({ error: errorMessage }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};