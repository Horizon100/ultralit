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
            
            let errorMessage = 'Unknown error occurred';
            let statusCode = 500;
            
            if (err instanceof Error) {
                errorMessage = err.message;
                
                if ('status' in err && typeof err.status === 'number') {
                    statusCode = err.status;
                }
            }
            
            if (statusCode === 404) {
                return new Response(JSON.stringify({ 
                    error: 'Task not found', 
                    details: errorMessage 
                }), { 
                    status: 404, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            
            if (err instanceof Error) {
                throw err;
            } else {
                throw new Error(errorMessage);
            }
        }
    } catch (error) {
        console.error('Error in GET task handler:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        return new Response(JSON.stringify({ 
            error: 'Internal server error', 
            message: errorMessage,
            stack: errorStack
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

/*
 * Update a task
 */
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
        console.log('Update data:', JSON.stringify(data, null, 2));
        
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
            
            // Validate status if provided
            const validStatuses = ['backlog', 'todo', 'inprogress', 'focus', 'done', 'hold', 'postpone', 'cancel', 'review', 'delegate', 'archive'];
            if (data.status && !validStatuses.includes(data.status)) {
                console.error('Invalid status value:', data.status);
                return new Response(JSON.stringify({ 
                    error: 'Invalid status value', 
                    provided: data.status,
                    validStatuses
                }), { 
                    status: 400, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            
            // Update the task
            console.log('Calling PocketBase update...');
            const updatedTask = await pb.collection('tasks').update(params.id, data);
            console.log('Update successful:', updatedTask);
            
            return json(updatedTask);
            
        } catch (err) {
            console.error(`Error updating task ${params.id}:`, err);
            
            let errorMessage = 'Unknown error occurred';
            let statusCode = 500;
            let errorData: unknown = undefined;
            
            if (err instanceof Error) {
                errorMessage = err.message;
                
                if ('data' in err) {
                    errorData = err.data;
                    console.error('Error details:', errorData);
                }
                
                if ('status' in err && typeof err.status === 'number') {
                    statusCode = err.status;
                }
            }
            
            console.error('Error details:', errorData || err);
            
            if (statusCode === 404) {
                return new Response(JSON.stringify({ 
                    error: 'Task not found', 
                    details: errorMessage 
                }), { 
                    status: 404, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            
            if (errorData) {
                return new Response(JSON.stringify({ 
                    error: 'Validation error', 
                    details: errorData 
                }), { 
                    status: 400, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            
            if (err instanceof Error) {
                throw err;
            } else {
                throw new Error(errorMessage);
            }
        }
    } catch (error) {
        console.error('Error in PATCH task handler:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        return new Response(JSON.stringify({ 
            error: 'Internal server error', 
            message: errorMessage,
            stack: errorStack
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log(`Deleting task ${params.id}...`);
        
        try {
            const task = await pb.collection('tasks').getOne(params.id);
            
            if (task.createdBy !== locals.user.id) {
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
                return new Response(JSON.stringify({ 
                    error: 'Task not found', 
                    details: err instanceof Error ? err.message : 'Task not found'
                }), { 
                    status: 404, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
            throw err;
        }
    } catch (error) {
        console.error('Error in DELETE task handler:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        return new Response(JSON.stringify({ 
            error: 'Internal server error', 
            message: errorMessage,
            stack: errorStack
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};