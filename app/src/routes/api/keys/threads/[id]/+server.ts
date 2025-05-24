// src/routes/api/keys/threads/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
    console.log(`API keys/threads: Fetching thread ${params.id}`);
    
    if (!locals.user) {
        console.error('API keys/threads: User not authenticated');
        throw error(401, 'Unauthorized');
    }
    
    try {
        // Get the thread with expanded data
        const thread = await pb.collection('threads').getOne(params.id, {
            expand: 'user,op,members,project'
        });
        
        console.log(`API keys/threads: Thread found: ${thread.id}`);
        
        // Get current user ID
        const currentUserId = locals.user.id;
        
        // Check permissions - multiple ways a user can have access
        const isCreator = thread.user === currentUserId;
        const isOp = thread.op === currentUserId;
        
        // Check if user is a member
        let isMember = false;
        if (thread.members) {
            if (typeof thread.members === 'string') {
                isMember = thread.members.includes(currentUserId);
            } else if (Array.isArray(thread.members)) {
                isMember = thread.members.some(m => 
                    typeof m === 'string' ? m === currentUserId : m.id === currentUserId
                );
            }
        }
        
        // Check project access if thread belongs to a project
        let hasProjectAccess = false;
        if (thread.project) {
            const projectId = typeof thread.project === 'string' ? thread.project : thread.project.id;
            
            try {
                const project = await pb.collection('projects').getOne(projectId);
                hasProjectAccess = project.owner === currentUserId || 
                                  (Array.isArray(project.collaborators) && 
                                   project.collaborators.includes(currentUserId));
            } catch (err) {
                console.error('API keys/threads: Error checking project access:', err);
            }
        }
        
        // Verify access permissions
        if (!isCreator && !isOp && !isMember && !hasProjectAccess) {
            console.error('API keys/threads: Access denied for user to thread');
            throw error(403, 'You do not have permission to access this thread');
        }
        
        // Return the thread with success flag
        return json({ 
            success: true,
            thread: thread 
        });
    } catch (err) {
        console.error('API keys/threads: Error fetching thread:', err);
        
        if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
            throw error(404, 'Thread not found');
        }
        
        const message = err instanceof Error ? err.message : 'Failed to fetch thread';
        throw error(400, message);
    }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    
    const threadId = params.id;
    const data = await request.json();
    
    try {
        const thread = await pb.collection('threads').getOne(threadId);
        
        // Verify ownership or appropriate permissions
        if (thread.user !== locals.user.id) {
            // If not the owner, check if user is op or has project access
            const isOp = thread.op === locals.user.id;
            
            let hasProjectAccess = false;
            if (thread.project) {
                const projectId = typeof thread.project === 'string' ? thread.project : thread.project.id;
                
                try {
                    const project = await pb.collection('projects').getOne(projectId);
                    hasProjectAccess = project.owner === locals.user.id;
                } catch (err) {
                    console.error('Error checking project access:', err);
                }
            }
            
            if (!isOp && !hasProjectAccess) {
                throw error(403, 'You do not have permission to update this thread');
            }
        }
        
        const updated = await pb.collection('threads').update(threadId, data);
        
        return json({
            success: true,
            thread: updated
        });
    } catch (err) {
        console.error('Error updating thread:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to update thread';
        throw error(400, errorMessage);
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }
    
    const threadId = params.id;
    
    try {
        const thread = await pb.collection('threads').getOne(threadId);
        
        // Check ownership
        if (thread.user !== locals.user.id) {
            // If not the owner, check if user has project owner access
            let hasProjectOwnerAccess = false;
            if (thread.project) {
                const projectId = typeof thread.project === 'string' ? thread.project : thread.project.id;
                
                try {
                    const project = await pb.collection('projects').getOne(projectId);
                    hasProjectOwnerAccess = project.owner === locals.user.id;
                } catch (err) {
                    console.error('Error checking project access:', err);
                }
            }
            
            if (!hasProjectOwnerAccess) {
                throw error(403, 'Only the thread owner or project owner can delete this thread');
            }
        }
        
        await pb.collection('threads').delete(threadId);
        
        return json({
            success: true
        });
    } catch (err) {
        console.error('Error deleting thread:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete thread';
            throw error(400, errorMessage);
    }
};