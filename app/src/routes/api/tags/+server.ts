// src/routes/api/tags/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Get all tags (personal or not associated with projects)
export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check for filter parameter
        const filter = url.searchParams.get('filter');
        let filterString = '';
        
        if (filter === 'createdBy') {
            // Only get tags created by the current user
            filterString = `createdBy="${locals.user.id}"`;
        } else {
            // Get tags created by user or unassigned to projects
            filterString = `createdBy="${locals.user.id}" || taggedProjects=""`;
        }

        // Get tags based on the filter
        const tags = await pb.collection('tags').getList(1, 100, {
            filter: filterString,
            sort: 'name'
        });

        return json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Failed to fetch tags' 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// Create a new tag
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const data = await request.json();
        
        // Set the creator
        data.createdBy = locals.user.id;
        
        // Ensure selected is set
        if (data.selected === undefined) {
            data.selected = false;
        }
        
        // Create the tag
        const tag = await pb.collection('tags').create(data);
        
        return json(tag);
    } catch (error) {
        console.error('Error creating tag:', error);
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Failed to create tag' 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

