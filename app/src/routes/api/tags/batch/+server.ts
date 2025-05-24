// src/routes/api/tasks/batch/+server.ts
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
        
        /*
         * Fetch tasks by ID with access control
         * First, get all tasks by ID
         */
        const tasks = await pb.collection('tasks').getList(1, idArray.length, {
            filter: idArray.map(id => `id="${id}"`).join(' || '),
            expand: 'project_id'
        });
        
        // Filter tasks to only include those the user has access to
        const accessibleTasks = tasks.items.filter(task => {
            // User is the creator
            if (task.createdBy === locals.user!.id) return true;
            
            // Check project access if task belongs to a project
            if (task.project_id && task.expand?.project_id) {
                const project = task.expand.project_id;
                return project.owner === locals.user!.id || 
                    (project.collaborators && project.collaborators.includes(locals.user!.id));
            }
                    
            return false;
        });
        
        return json({
            ...tasks,
            items: accessibleTasks
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Internal server error' 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};