import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
    const userId = params.id;
    
    try {
        // Fetch the user
        const user = await pb.collection('users').getOne(userId, {
            fields: 'id,name,username,email,avatar,collectionId'
        });
        
        if (!user) {
            throw error(404, 'User not found');
        }
        
        return json({
            id: user.id,
            name: user.name || '',
            username: user.username || '',
            email: user.email || '',
            avatar: user.avatar || '',
            collectionId: user.collectionId
        });
    } catch (err) {
        console.error('Error fetching user data:', err);
        throw error(404, 'User not found');
    }
};