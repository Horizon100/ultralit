import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ locals, url }) => {
    console.log('Thread GET endpoint called');
    
    if (!locals.user) {
        console.log('No authenticated user found');
        return json({ success: false, message: 'Authentication required' }, { status: 401 });
    }
    
    const userId = locals.user.id;
    console.log('Authenticated user:', userId);
    
    try {
        const pb = locals.pb;
        if (!pb) {
            console.log('PocketBase instance not found in locals');
            return json({ success: false, message: 'Database connection not available' }, { status: 500 });
        }
        const projectId = url.searchParams.get('project');
        console.log('Project ID from query:', projectId);
        let filter = `op = "${userId}" || members ?~ "${userId}"`;
        if (projectId) {
            filter = `(${filter}) && project_id = "${projectId}"`;
        } else {
            filter = `(${filter}) && (project_id = "" || project_id = null)`;
        }
        console.log('Using filter:', filter);
        try {
            const threads = await pb.collection('threads').getList(1, 50, {
                filter,
                sort: '-updated'
            });
            
            console.log(`Found ${threads.items.length} threads`);
            
            return json({ 
                success: true,
                threads: threads.items
            });
        } catch (filterError) {
            console.error('Error with filter:', filterError);
            
            // If the complex filter fails, try a simpler one
            try {
                const simpleFilter = `op = "${userId}"`;
                console.log('Trying simple filter:', simpleFilter);
                
                const simpleThreads = await pb.collection('threads').getList(1, 50, {
                    filter: simpleFilter,
                    sort: '-updated'
                });
                
                console.log(`Found ${simpleThreads.items.length} threads with simple filter`);
                
                return json({ 
                    success: true,
                    threads: simpleThreads.items
                });
            } catch (simpleError) {
                console.error('Error with simple filter:', simpleError);
                
                // If even the simple filter fails, return an empty array
                return json({ 
                    success: true,
                    threads: []
                });
            }
        }
    } catch (err) {
        console.error('Unexpected thread fetch error:', err);
        return json({
            success: false,
            message: 'Failed to fetch threads',
            error: err.message || String(err)
        }, { status: 500 });
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