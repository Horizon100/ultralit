// src/routes/api/projects/[id]/tags/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Get all tags for a specific project
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

        // Get all tags for this project - use taggedProjects field
        const tags = await pb.collection('tags').getList(1, 100, {
            filter: `taggedProjects~"${params.id}"`,
            sort: 'name'
        });

        return json(tags);
    } catch (error: unknown) {
        console.error('Error fetching project tags:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch project tags';
        return new Response(JSON.stringify({ error: message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// Create a new tag in this project
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
        
        // Set the creator
        data.createdBy = locals.user.id;
        
        // Set the project relation in taggedProjects
        data.taggedProjects = params.id;
        
        // Create the tag
        const tag = await pb.collection('tags').create(data);
        
        return json(tag);
    } catch (error: unknown) {
        console.error('Error creating project tag:', error);
        const message = error instanceof Error ? error.message : 'Failed to create project tag';
        return new Response(JSON.stringify({ error: message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};