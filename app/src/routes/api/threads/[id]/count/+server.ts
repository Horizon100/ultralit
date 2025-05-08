import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const threadId = params.id;
        
        if (!threadId) {
            return new Response(JSON.stringify({ error: 'Thread ID is required' }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        const pocketBase = locals?.pb || pb;
        const result = await pocketBase.collection('messages').getList(1, 1, {
            filter: `thread = "${threadId}"`,
            $autoCancel: false
        });
        
        return json({
            count: result.totalItems,
            success: true
        });
    } catch (error) {
        console.error('Error fetching thread count:', error);
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            count: 0,
            success: false
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};