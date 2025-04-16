// src/routes/api/keys/threads/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
    console.log('API keys/threads: Fetching threads list');
    
    if (!locals.user) {
        console.error('API keys/threads: User not authenticated');
        throw error(401, 'Unauthorized');
    }
    
    try {
        const currentUserId = locals.user.id;
        
        // Check for query parameters
        const projectId = url.searchParams.get('project');
        const sort = url.searchParams.get('sort') || '-created';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        
        let filter = '';
        
        // If project ID is provided, filter by project
        if (projectId) {
            filter = `project = "${projectId}" && (user = "${currentUserId}" || op = "${currentUserId}" || members ?~ "${currentUserId}")`;
        } else {
            // Otherwise get all threads the user has access to
            filter = `user = "${currentUserId}" || op = "${currentUserId}" || members ?~ "${currentUserId}"`;
        }
        
        console.log(`API keys/threads: Using filter: ${filter}`);
        
        const threads = await pb.collection('threads').getFullList({
            filter: filter,
            sort: sort,
            expand: 'user,op,project',
            $autoCancel: false
        });
        
        console.log(`API keys/threads: Found ${threads.length} threads`);
        
        return json({
            success: true,
            threads: threads
        });
    } catch (err) {
        console.error('API keys/threads: Error fetching threads list:', err);
        throw error(400, err.message || 'Failed to fetch threads');
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
        
        // Set default values if not provided
        const threadData = {
            name: data.name || 'New Thread',
            user: currentUserId,
            op: data.op || currentUserId,
            members: data.members || [currentUserId],
            project: data.project || null,
            description: data.description || '',
            // Add other fields as needed
            ...data
        };
        
        console.log('API keys/threads: Creating thread with data:', threadData);
        
        // Create the thread
        const thread = await pb.collection('threads').create(threadData);
        
        console.log(`API keys/threads: Thread created with ID: ${thread.id}`);
        
        return json({
            success: true,
            thread: thread
        });
    } catch (err) {
        console.error('API keys/threads: Error creating thread:', err);
        throw error(400, err.message || 'Failed to create thread');
    }
};