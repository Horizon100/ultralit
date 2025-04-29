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
        return new Response(JSON.stringify({ error: error.message }), { 
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
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// src/routes/api/tags/[id]/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Update a tag
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check if user can update this tag
        const tag = await pb.collection('tags').getOne(params.id);
        
        if (tag.createdBy !== locals.user.id) {
            // Check if user has access to any of the projects tagged
            if (tag.taggedProjects) {
                // If the tag is related to projects, check if user has permissions
                // on any of those projects
                const projectIds = tag.taggedProjects.split(',');
                let hasAccess = false;
                
                for (const projectId of projectIds) {
                    if (!projectId) continue;
                    
                    try {
                        const project = await pb.collection('projects').getOne(projectId);
                        if (project.owner === locals.user.id || 
                            (project.collaborators && project.collaborators.includes(locals.user.id))) {
                            hasAccess = true;
                            break;
                        }
                    } catch (err) {
                        console.warn(`Could not check project ${projectId}: ${err.message}`);
                    }
                }
                
                if (!hasAccess) {
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
        
        const data = await request.json();
        
        // Update the tag
        const updatedTag = await pb.collection('tags').update(params.id, data);
        
        return json(updatedTag);
    } catch (error) {
        console.error('Error updating tag:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// Delete a tag
export const DELETE: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check if user can delete this tag
        const tag = await pb.collection('tags').getOne(params.id);
        
        if (tag.createdBy !== locals.user.id) {
            // Check if user has access to any of the projects tagged
            if (tag.taggedProjects) {
                // If the tag is related to projects, check if user has permissions
                // on any of those projects
                const projectIds = tag.taggedProjects.split(',');
                let hasOwnerAccess = false;
                
                for (const projectId of projectIds) {
                    if (!projectId) continue;
                    
                    try {
                        const project = await pb.collection('projects').getOne(projectId);
                        if (project.owner === locals.user.id) {
                            hasOwnerAccess = true;
                            break;
                        }
                    } catch (err) {
                        console.warn(`Could not check project ${projectId}: ${err.message}`);
                    }
                }
                
                if (!hasOwnerAccess) {
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
        
        // Delete the tag
        await pb.collection('tags').delete(params.id);
        
        return json({ success: true });
    } catch (error) {
        console.error('Error deleting tag:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};