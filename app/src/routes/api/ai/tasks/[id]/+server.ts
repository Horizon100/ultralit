// src/routes/api/tasks/[id]/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Get a specific task
export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log(`Fetching task ${params.id}...`);
        
        try {
            const task = await pb.collection('tasks').getOne(params.id);
            
            // Check if user has access to this task
            if (task.createdBy !== locals.user.id) {
                // If user is not the creator, check project permissions
                if (task.project_id) {
                    const project = await pb.collection('projects').getOne(task.project_id);
                    if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
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
            
            return json(task);
            
    } catch (err) {
        console.error(`Error fetching task ${params.id}:`, err);
        
        if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
            return new Response(JSON.stringify({ 
                error: 'Task not found', 
                details: err instanceof Error ? err.message : 'Unknown error'
            }), { 
                status: 404, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        throw err;
    }
    } catch (error) {
        console.error('Error in GET task handler:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal server error', 
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// Update a task
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log(`Updating task ${params.id}...`);
        
        const data = await request.json();
        console.log('Update data:', data);
        
        // Check if user can update this task
        try {
            const task = await pb.collection('tasks').getOne(params.id);
            console.log('Existing task:', task);
            
            if (task.createdBy !== locals.user.id) {
                // If user is not the creator, check project permissions
                if (task.project_id) {
                    const project = await pb.collection('projects').getOne(task.project_id);
                    if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
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
            
            // Update the task
            console.log('Calling PocketBase update...');
            const updatedTask = await pb.collection('tasks').update(params.id, data);
            console.log('Update successful:', updatedTask);
            
            return json(updatedTask);
            
    } catch (err) {
        console.error(`Error updating task ${params.id}:`, err);
        
        if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
            return new Response(JSON.stringify({ 
                error: 'Task not found', 
                details: err instanceof Error ? err.message : 'Unknown error'
            }), { 
                status: 404, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        throw err;
    }
    } catch (err) {
        console.error(`Error deleting task ${params.id}:`, err);
        
        if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
            return new Response(JSON.stringify({ 
                error: 'Task not found', 
                details: err instanceof Error ? err.message : 'Unknown error'
            }), { 
                status: 404, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        throw err;
    }
};

// Delete a task
export const DELETE: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log(`Deleting task ${params.id}...`);
        
        // Check if user can delete this task
        try {
            const task = await pb.collection('tasks').getOne(params.id);
            
            if (task.createdBy !== locals.user.id) {
                // If user is not the creator, check project permissions
                if (task.project_id) {
                    const project = await pb.collection('projects').getOne(task.project_id);
                    if (project.owner !== locals.user.id) {
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
            
            // Delete the task
            await pb.collection('tasks').delete(params.id);
            
            return json({ success: true });
            
        } catch (err) {
            console.error(`Error deleting task ${params.id}:`, err);
            
            if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
                return new Response(JSON.stringify({ error: 'Task not found', details: (err as any).message }), { 
                    status: 404, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            
            throw err;
        }
    } catch (error) {
        console.error('Error in DELETE task handler:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal server error', 
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};