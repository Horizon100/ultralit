import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  
  try {
    const threads = await locals.pb.collection('threads').getFullList({

    });
    return json({ success: true, data: threads });
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Unknown error');
  }
};


export const POST: RequestHandler = async ({ request, locals }) => {
    console.log('API keys/threads: Creating new thread');
    
    if (!locals.user) {
        console.error('API keys/threads: User not authenticated');
        throw error(401, 'Unauthorized');
    }
    
    try {
        const data = await request.json();
        const currentUserId = locals.user.id;
        
        console.log('API keys/threads: Raw request data:', data);
        
        // Prepare thread data with required fields
        const threadData = {
            name: data.name || 'New Thread',
            user: currentUserId,
            op: data.op || currentUserId,
            members: data.members || [currentUserId],
            description: data.description || '',
            updated: new Date().toISOString(),
            created: new Date().toISOString(),
        };
        
        // Only include project if it's provided and not null/undefined/empty
        if (data.project) {
            threadData.project = data.project;
        }
        
        // Include any other fields that were sent
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && !['name', 'user', 'op', 'members', 'description', 'project', 'updated', 'created'].includes(key)) {
                threadData[key] = value;
            }
        }
        
        console.log('API keys/threads: Creating thread with data:', threadData);
        
        try {
            // Create the thread
            const thread = await pb.collection('threads').create(threadData);
            
            console.log(`API keys/threads: Thread created with ID: ${thread.id}`);
            
            return json({
                success: true,
                thread: thread
            });
        } catch (pbError) {
            console.error('API keys/threads: PocketBase error creating thread:', pbError);
            
            // Check if it's a validation error
            if (pbError.status === 400) {
                return json({
                    success: false,
                    message: `Validation error: ${JSON.stringify(pbError.data || {})}`,
                    errors: pbError.data
                }, { status: 400 });
            }
            
            throw pbError;
        }
    } catch (err) {
        console.error('API keys/threads: Error creating thread:', err);
        return json({
            success: false,
            message: String(err.message || 'Failed to create thread'),
            error: err
        }, { status: 400 });
    }
};