// src/routes/api/keys/messages/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request, locals }) => {
    console.log('API keys/messages: Creating message');
    
    if (!locals.user) {
        console.error('API keys/messages: User not authenticated');
        throw error(401, 'Authentication required');
    }
    
    const currentUserId = locals.user.id;
    
    try {
        // Get the message data from the request
        const data = await request.json();
        
        // Ensure the thread exists if provided
        if (data.thread) {
            try {
                const thread = await pb.collection('threads').getOne(data.thread);
                
                // Check if user has permission to post to this thread
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
                
                // If user doesn't have access, throw error
                if (!isCreator && !isOp && !isMember) {
                    throw error(403, 'You do not have permission to post to this thread');
                }
            } catch (err) {
                if (err.status === 404) {
                    throw error(404, 'Thread not found');
                }
                throw err;
            }
        }
        
        // Create the message
        const message = await pb.collection('messages').create({
            ...data,
            user: data.user || currentUserId
        });
        
        console.log(`API keys/messages: Created message ${message.id}`);
        
        // Update the thread's updated timestamp if this message belongs to a thread
        if (data.thread) {
            await pb.collection('threads').update(data.thread, {
                updated: new Date().toISOString()
            });
        }
        
        return json({
            success: true,
            message: message
        });
    } catch (err) {
        console.error('API keys/messages: Error creating message:', err);
        
        const statusCode = err.status || 400;
        const message = err.message || 'Failed to create message';
        
        return json({ 
            success: false, 
            message: message
        }, { status: statusCode });
    }
};