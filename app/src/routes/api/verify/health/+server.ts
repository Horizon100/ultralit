import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';

export const GET: RequestHandler = async () => {
    try {
        const isHealthy = await pbServer.checkPocketBaseConnection();
        return json({ 
            success: isHealthy, 
            message: isHealthy ? 'PocketBase is healthy' : 'PocketBase is not healthy' 
        });
    } catch (error) {
        console.error('PocketBase health check failed:', error);
        return json({ success: false, error: 'PocketBase connection failed' }, { status: 500 });
    }
};