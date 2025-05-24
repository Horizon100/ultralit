// src/routes/api/keys/messages/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
    const messageId = params.id;
    
    console.log(`API keys/messages/${messageId}: Fetching message`);
    
    if (!locals.user) {
        console.error('API keys/messages: User not authenticated');
        throw error(401, 'Authentication required');
    }
    
    const currentUserId = locals.user.id;
    
    try {
        // Get the message
        const message = await pb.collection('messages').getOne(messageId);
        
        // If message belongs to a thread, check thread permissions
        if (message.thread) {
            try {
                const thread = await pb.collection('threads').getOne(message.thread);
                
                // Check if user has permission to access this thread
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
                        console.error('API: Error checking project access:', err);
                    }
                }
                
                // If user doesn't have access, throw error
                if (!isCreator && !isOp && !isMember && !hasProjectAccess) {
                    throw error(403, 'You do not have permission to access this message');
                }
            } catch (err) {
                if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
                    if (message.user !== currentUserId) {
                        throw error(403, 'You do not have permission to access this message');
                    }
                } else {
                    throw err;
                }
            }
        } else if (message.user !== currentUserId) {
            throw error(403, 'You do not have permission to access this message');
        }
        
        console.log(`API keys/messages/${messageId}: Message fetched successfully`);
        
        return json({
            success: true,
            message: message
        });
    } catch (err) {
        console.error('API keys/messages: Error fetching message:', err);
        
        const statusCode = (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') ? err.status : 400;
        const message = (err as Error).message || 'Failed to fetch message';
        
        return json({ 
            success: false, 
            message: message
        }, { status: statusCode });
    }

};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    const messageId = params.id;
    
    console.log(`API keys/messages/${messageId}: Updating message`);
    
    if (!locals.user) {
        console.error('API keys/messages: User not authenticated');
        throw error(401, 'Authentication required');
    }
    
    const currentUserId = locals.user.id;
    
    try {
        // Get the existing message
        const existingMessage = await pb.collection('messages').getOne(messageId);
        
        // Only allow message creator or thread owner to update message
        if (existingMessage.user !== currentUserId) {
            // Check if user is thread owner
            let isThreadOwner = false;
            
            if (existingMessage.thread) {
                try {
                    const thread = await pb.collection('threads').getOne(existingMessage.thread);
                    isThreadOwner = thread.user === currentUserId;
                } catch (err) {
                    console.error('Error checking thread ownership:', err);
                }
            }
            
            if (!isThreadOwner) {
                throw error(403, 'You do not have permission to update this message');
            }
        }
        
        // Get the update data
        const data = await request.json();
        
        // Update the message
        const updatedMessage = await pb.collection('messages').update(messageId, data);
        
        console.log(`API keys/messages/${messageId}: Message updated successfully`);
        
        return json({
            success: true,
            message: updatedMessage
        });
    } catch (err) {
        console.error('API keys/messages: Error updating message:', err);
        
        const statusCode = (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') ? err.status : 400;
        const message = err instanceof Error ? err.message : 'Failed to update message';
        
        return json({ 
            success: false, 
            message: message
        }, { status: statusCode });
    }

};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    const messageId = params.id;
    
    console.log(`API keys/messages/${messageId}: Deleting message`);
    
    if (!locals.user) {
        console.error('API keys/messages: User not authenticated');
        throw error(401, 'Authentication required');
    }
    
    const currentUserId = locals.user.id;
    
    try {
        // Get the existing message
        const existingMessage = await pb.collection('messages').getOne(messageId);
        
        // Only allow message creator or thread owner to delete message
        if (existingMessage.user !== currentUserId) {
            // Check if user is thread owner
            let isThreadOwner = false;
            
            if (existingMessage.thread) {
                try {
                    const thread = await pb.collection('threads').getOne(existingMessage.thread);
                    isThreadOwner = thread.user === currentUserId;
                } catch (err) {
                    console.error('Error checking thread ownership:', err);
                }
            }
            
            if (!isThreadOwner) {
                throw error(403, 'You do not have permission to delete this message');
            }
        }
        
        // Delete the message
        await pb.collection('messages').delete(messageId);
        
        console.log(`API keys/messages/${messageId}: Message deleted successfully`);
        
        return json({
            success: true
        });
    } catch (err) {
        console.error('API keys/messages: Error deleting message:', err);
        
        const statusCode = (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') ? err.status : 400;
        const message = err instanceof Error ? err.message : 'Failed to delete message';
        
        return json({ 
            success: false, 
            message: message
        }, { status: statusCode });
    }
};