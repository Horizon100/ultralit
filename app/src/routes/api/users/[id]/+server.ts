// src/routes/api/users/[id]/+server.ts
import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, locals }) {
    const userId = params.id;
    
    try {
        // Fetch the user
        const user = await pb.collection('users').getOne(userId, {
            fields: 'id,name,username,email'
        });
        
        if (!user) {
            throw error(404, 'User not found');
        }
        
        return json({
            id: user.id,
            name: user.name || '',
            username: user.username || '',
            email: user.email || ''
        });
    } catch (err) {
        console.error('Error fetching user data:', err);
        throw error(404, 'User not found');
    }
}