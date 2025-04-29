// src/routes/api/attachments/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Upload a new attachment
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Parse the multipart form data
        const formData = await request.formData();
        
        // Ensure createdBy is set
        formData.append('createdBy', locals.user.id);
        
        // Create the attachment record
        const attachment = await pb.collection('attachments').create(formData);
        
        // Get the file URL
        const fileUrl = pb.getFileUrl(attachment, attachment.file);
        
        return json({
            id: attachment.id,
            fileName: attachment.fileName,
            file: attachment.file,
            url: fileUrl,
            note: attachment.note || ''
        });
    } catch (error) {
        console.error('Error uploading attachment:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// src/routes/api/tasks/[id]/attachments/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Get all attachments for a specific task
export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Check if user has access to this task
        const task = await pb.collection('tasks').getOne(params.id);
        
        if (task.createdBy !== locals.user.id) {
            // If task is in a project, check project permissions
            if (task.project_id) {
                const project = await pb.collection('projects').getOne(task.project_id);
                if (project.owner !== locals.user.id && 
                    !project.collaborators.includes(locals.user.id)) {
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

        // Get all attachments for this task
        const attachments = await pb.collection('attachments').getList(1, 100, {
            filter: `attachedTasks~"${params.id}"`,
            sort: '-created'
        });

        // Add URLs to attachments
        const items = attachments.items.map(attachment => ({
            ...attachment,
            url: pb.getFileUrl(attachment, attachment.file)
        }));

        return json({
            ...attachments,
            items
        });
    } catch (error) {
        console.error('Error fetching task attachments:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

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
                    } catch (err) {
                        console.warn(`Could not check task ${taskId}: ${err.message}`);
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
                    } catch (err) {
                        console.warn(`Could not check project ${projectId}: ${err.message}`);
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
    } catch (error) {
        console.error('Error deleting attachment:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};