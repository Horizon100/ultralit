// src/routes/api/keys/threads/[id]/messages/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Messages } from '$lib/types/types';

export const GET: RequestHandler = async ({ params, locals }) => {
    const threadId = params.id;
    
    console.log(`API keys/threads/${threadId}/messages: Fetching messages`);
    
    if (!locals.user) {
        console.error('API: User not authenticated');
        throw error(401, 'Authentication required');
    }
    
    const currentUserId = locals.user.id;
    
    try {
        // First check if user has access to the thread
        const thread = await pb.collection('threads').getOne(threadId);
        
        // Check thread permissions
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
        
        // Verify access permissions
        if (!isCreator && !isOp && !isMember && !hasProjectAccess) {
            console.error('API: Access denied for user to thread');
            throw error(403, 'You do not have permission to access this thread');
        }
        
        // Fetch messages for the thread
        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `thread = "${threadId}"`,
            sort: '+created'
        });
        
        console.log(`API: Found ${messages.length} messages for thread ${threadId}`);
        
        return json({
            success: true,
            messages: messages
        });
    } catch (err) {
        console.error('API: Error fetching messages:', err);
        
        const statusCode = err.status || 400;
        const message = (err as Error).message || 'Failed to fetch messages';
        
        return json({ 
            success: false, 
            message: message
        }, { status: statusCode });
    }
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
    const threadId = params.id;
    
    console.log(`API keys/threads/${threadId}/messages: Creating message`);
    
    if (!locals.user) {
        console.error('API: User not authenticated');
        throw error(401, 'Authentication required');
    }
    
    const currentUserId = locals.user.id;
    
    try {
        // First check if user has access to the thread
        const thread = await pb.collection('threads').getOne(threadId);
        
        // Check thread permissions
        const isCreator = thread.user === currentUserId;
        const isOp = thread.op === currentUserId;
        const isMember = Array.isArray(thread.members) && thread.members.includes(currentUserId);
        
        // Verify access permissions
        if (!isCreator && !isOp && !isMember) {
            console.error('API: Access denied for user to thread');
            throw error(403, 'You do not have permission to post to this thread');
        }
        
        // Get the message data from the request
        const data = await request.json();
        
        // Create the message
        const message = await pb.collection('messages').create({
            ...data,
            thread: threadId,
            user: currentUserId
        });
        
        // Update the thread's updated timestamp
        await pb.collection('threads').update(threadId, {
            updated: new Date().toISOString()
        });
        
        console.log(`API: Created message ${message.id} for thread ${threadId}`);
        
        return json({
            success: true,
            message: message
        });
    } catch (err) {
        console.error('API: Error creating message:', err);
        
        const statusCode = err.status || 400;
        const message = (err as Error).message || 'Failed to create message';
        
        return json({ 
            success: false, 
            message: message
        }, { status: statusCode });
    }
};