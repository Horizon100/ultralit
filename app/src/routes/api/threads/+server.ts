import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
    console.log('API threads: Fetching threads list');
    
    if (!locals.user) {
        console.error('API threads: User not authenticated');
        throw error(401, 'Unauthorized');
    }
    
    try {
        const userId = locals.user.id;
        
        // Check for query parameters
        const projectId = url.searchParams.get('project');
        const sort = url.searchParams.get('sort') || '-updated';
        
        let filter = '';
        
        // Determine the right filter based on presence of project ID
        if (projectId) {
            // Filter threads for a specific project
            filter = `project = "${projectId}" && (user = "${userId}" || op = "${userId}" || members ?~ "${userId}")`;
        } else {
            // Get ALL threads the user has access to
            filter = `user = "${userId}" || op = "${userId}" || members ?~ "${userId}"`;
        }
        
        console.log(`API threads: Using filter: ${filter}`);
        
        const threads = await pb.collection('threads').getFullList({
            filter: filter,
            sort: sort,
            expand: 'user,op,project',
            $autoCancel: false
        });
        
        console.log(`API threads: Found ${threads.length} threads`);
        
        return json({
            success: true,
            data: threads,
            threads: threads
        });
    } catch (err) {
        console.error('API threads: Error fetching threads list:', err);
        throw error(400, String(err.message || 'Failed to fetch threads'));
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    console.log('API threads: Creating new thread');
    
    if (!locals.user) {
        console.error('API threads: User not authenticated');
        throw error(401, 'Unauthorized');
    }
    
    try {
        const data = await request.json();
        const userId = locals.user.id;
        
        // Prepare thread data with required fields
        const threadData = {
            name: data.name || 'New Thread',
            user: userId,
            op: data.op || userId,
            members: data.members || [userId],
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
        
        console.log('API threads: Creating thread with data:', threadData);
        
        // Create the thread
        const thread = await pb.collection('threads').create(threadData);
        
        console.log(`API threads: Thread created with ID: ${thread.id}`);
        
        return json({
            success: true,
            data: thread,
            thread: thread
        });
    } catch (err) {
        console.error('API threads: Error creating thread:', err);
        return json({
            success: false,
            message: String(err.message || 'Failed to create thread'),
            error: err
        }, { status: 400 });
    }
};