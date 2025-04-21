import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
    console.log(`API threads/[id]: Fetching thread ${params.id}`);
    
    if (!locals.user) throw error(401, 'Unauthorized');
    
    try {
        const thread = await pb.collection('threads').getOne(params.id, {
            expand: 'user,participants,op,project,members'
        });
        
        const userId = locals.user.id;
        
        // Comprehensive access check
        const isCreator = thread.user === userId;
        const isOp = thread.op === userId;
        const isMember = Array.isArray(thread.members) && thread.members.includes(userId);
        const isParticipant = thread.participants?.includes(userId);
        
        // Check project access if thread has a project
        let hasProjectAccess = false;
        if (thread.project) {
            try {
                const projectId = typeof thread.project === 'string' ? thread.project : thread.project.id;
                hasProjectAccess = await isProjectCollaborator(projectId, userId);
            } catch (projectErr) {
                console.warn(`Failed to check project access: ${projectErr.message}`);
            }
        }
        
        if (!isCreator && !isOp && !isMember && !isParticipant && !hasProjectAccess) {
            console.warn(`Access denied to thread ${params.id} for user ${userId}`);
            throw error(403, 'Forbidden');
        }
        
        console.log(`Thread ${params.id} access granted to user ${userId}`);
        return json({ success: true, data: thread, thread: thread }); // Include both formats for compatibility
    } catch (err) {
        console.error(`Thread fetch error for ${params.id}:`, err);
        const message = err.response?.data?.message || err.message;
        throw error(err.status || 400, message || 'Failed to fetch thread');
    }
};

async function isProjectCollaborator(projectId, userId) {
    try {
        const project = await pb.collection('projects').getOne(projectId);
        const isOwner = project.owner === userId;
        const isCollaborator = Array.isArray(project.collaborators) && 
                              project.collaborators.includes(userId);
        return isOwner || isCollaborator;
    } catch (err) {
        console.warn(`Error checking project collaboration: ${err.message}`);
        return false;
    }
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    console.log(`API threads/[id]: Updating thread ${params.id}`);
    
    if (!locals.user) throw error(401, 'Unauthorized');
    
    const data = await request.json();
    try {
        const thread = await pb.collection('threads').getOne(params.id);
        const userId = locals.user.id;
        
        // Check various permissions
        const isOwner = thread.user === userId || thread.op === userId;
        const isCollaborator = thread.project ? 
                              await isProjectCollaborator(thread.project, userId) : false;
        const isMember = Array.isArray(thread.members) && thread.members.includes(userId);
        
        if (!isOwner && !isCollaborator && !isMember) {
            console.warn(`Update permission denied for thread ${params.id} by user ${userId}`);
            throw error(403, 'Insufficient permissions to update thread');
        }
        
        // Non-owners can only update certain fields
        if (!isOwner && Object.keys(data).some(key => 
            !['members', 'updated', 'read_by'].includes(key))) {
            throw error(403, 'Limited update permissions');
        }
        
        // Always update the 'updated' timestamp
        const updateData = {
            ...data,
            updated: new Date().toISOString()
        };
        
        console.log(`Updating thread ${params.id} with data:`, updateData);
        const updated = await pb.collection('threads').update(params.id, updateData);
        return json({ success: true, data: updated, thread: updated }); // Include both formats
    } catch (err) {
        console.error(`Thread update error for ${params.id}:`, err);
        throw error(err.status || 400, err.message || 'Update failed');
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    console.log(`API threads/[id]: Deleting thread ${params.id}`);
    
    if (!locals.user) throw error(401, 'Unauthorized');
    
    try {
        const thread = await pb.collection('threads').getOne(params.id);
        const userId = locals.user.id;
        
        // Verify ownership for deletion
        if (thread.user !== userId) {
            console.warn(`Delete permission denied for thread ${params.id} by user ${userId}`);
            throw error(403, 'Only thread owner can delete');
        }
        
        console.log(`Deleting thread ${params.id}`);
        await pb.collection('threads').delete(params.id);
        return json({ success: true });
    } catch (err) {
        console.error(`Thread deletion error for ${params.id}:`, err);
        throw error(err.status || 400, err.message || 'Deletion failed');
    }
};