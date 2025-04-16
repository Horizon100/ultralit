import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, cookies }) => {
    // Restore auth from cookies
    const authCookie = cookies.get('pb_auth');
    if (authCookie) {
        try {
            const authData = JSON.parse(authCookie);
            pbServer.pb.authStore.save(authData.token, authData.model);
        } catch (e) {
            console.error('Error parsing auth cookie:', e);
        }
    }
    
    const userId = params.userId;
    
    // Check authentication
    if (!pbServer.pb.authStore.isValid) {
        return json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    // Verify user is requesting their own data or has admin rights
    if (pbServer.pb.authStore.model?.id !== userId && !pbServer.pb.authStore.model?.admin) {
        return json({ success: false, error: 'Unauthorized to access these models' }, { status: 403 });
    }
    
    try {
        const records = await pbServer.pb.collection('models').getFullList({
            filter: `user ~ "${userId}"`,
            sort: '-created'
        });
        
        return json({ success: true, models: records });
    } catch (error) {
        console.error('Error fetching models for user:', error);
        return json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to fetch models' 
        }, { status: 500 });
    }
};