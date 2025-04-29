// src/routes/api/tasks/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Get all tasks (personal or unassigned to projects)
export const GET: RequestHandler = async ({ locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Get tasks where user is creator or there's no project assigned
        const tasks = await pb.collection('tasks').getList(1, 100, {
            filter: `(createdBy="${locals.user.id}" || project_id="") && status!="archive"`,
            sort: '-created',
            expand: 'createdBy,allocatedAgents,taskTags'
        });

        return json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// Create a new task
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const data = await request.json();
        
        // Ensure createdBy is set
        data.createdBy = locals.user.id;
        
        // Create the task
        const task = await pb.collection('tasks').create(data);
        
        return json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};