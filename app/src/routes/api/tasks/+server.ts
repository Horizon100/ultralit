// src/routes/api/tasks/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const tasks = await pb.collection('tasks').getList(1, 100, {
            filter: `(createdBy="${locals.user.id}" || project_id="") && status!="archive"`,
            sort: '-created',
            expand: 'createdBy,allocatedAgents,taskTags'
        });

        return json(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tasks';
        return new Response(JSON.stringify({ error: errorMessage }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const data = await request.json();
        
        data.createdBy = locals.user.id;
        
        const task = await pb.collection('tasks').create(data);
        
        return json(task);
    } catch (err) {
        console.error('Error creating task:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to create task';
        return new Response(JSON.stringify({ error: errorMessage }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};