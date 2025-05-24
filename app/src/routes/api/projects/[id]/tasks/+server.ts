// src/routes/api/projects/[id]/tasks/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Get all tasks for a specific project
export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check if user has access to this project
        const project = await pb.collection('projects').getOne(params.id);
        
        if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 403, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Get all tasks for this project
        const tasks = await pb.collection('tasks').getList(1, 100, {
            filter: `project_id="${params.id}" && status!="archive"`,
            sort: '-created',
            expand: 'createdBy,allocatedAgents'
        });

        return json(tasks);
    } catch (error) {
        console.error('Error fetching project tasks:', error);
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Failed to fetch project tasks'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// Create a new task in this project
export const POST: RequestHandler = async ({ params, request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check if user has access to this project
        const project = await pb.collection('projects').getOne(params.id);
        
        if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 403, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const data = await request.json();
        
        // Ensure project_id and createdBy are set
        data.project_id = params.id;
        data.createdBy = locals.user.id;
        
        // Create the task
        const task = await pb.collection('tasks').create(data);
        
        // Update project's tasks reference (if needed)
        if (project.threads && !project.threads.includes(task.id)) {
            project.threads.push(task.id);
            await pb.collection('projects').update(params.id, { threads: project.threads });
        }
        
        return json(task);
    } catch (error) {
        console.error('Error creating project task:', error);
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Failed to create project task'
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};