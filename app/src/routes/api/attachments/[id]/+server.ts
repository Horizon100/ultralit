// src/routes/api/attachments/[id]/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Delete an attachment
export const DELETE: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check if user can delete this attachment
        const attachment = await pb.collection('attachments').getOne(params.id);
        
        if (attachment.createdBy !== locals.user.id) {
            // Check for project or task permissions
            let hasAccess = false;
            
            // Check task permissions if there are attached tasks
            if (attachment.attachedTasks) {
                const taskIds = attachment.attachedTasks.split(',');
                
                for (const taskId of taskIds) {
                    if (!taskId) continue;
                    
                    try {
                        const task = await pb.collection('tasks').getOne(taskId);
                        
                        if (task.createdBy === locals.user.id) {
                            hasAccess = true;
                            break;
                        }
                        
                        // Check project permissions
                        if (task.project_id) {
                            const project = await pb.collection('projects').getOne(task.project_id);
                            if (project.owner === locals.user.id) {
                                hasAccess = true;
                                break;
                            }
                        }
                    } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : 'Unknown error';
                        console.warn(`Could not check task ${taskId}: ${message}`);
                    }
                }
            }
            
            // Check project permissions if there are attached projects
            if (!hasAccess && attachment.attachedProjects) {
                const projectIds = attachment.attachedProjects.split(',');
                
                for (const projectId of projectIds) {
                    if (!projectId) continue;
                    
                    try {
                        const project = await pb.collection('projects').getOne(projectId);
                        if (project.owner === locals.user.id) {
                            hasAccess = true;
                            break;
                        }
                    } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : 'Unknown error';
                        console.warn(`Could not check project ${projectId}: ${message}`);
                    }
                }
            }
            
            if (!hasAccess) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                    status: 403, 
                    headers: { 'Content-Type': 'application/json' } 
                });
            }
        }
        
        // Delete the attachment
        await pb.collection('attachments').delete(params.id);
        
        return json({ success: true });
    } catch (error: unknown) {
        console.error('Error deleting attachment:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};