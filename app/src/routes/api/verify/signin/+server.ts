// src/routes/api/verify/signin/+server.ts - Optimized
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';

// Cache sanitized user data function
const sanitizeUserData = (user: User | null): Partial<User> | null => {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        collectionId: user.collectionId,
        created: user.created,
        updated: user.updated,
        selected_provider: user.selected_provider,
        model: user.model,
        prompt_preference: user.prompt_preference,
        sysprompt_preference: user.sysprompt_preference,
        model_preference: user.model_preference,
        wallpaper_preference: user.wallpaper_preference

    };
};

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const { email, password } = await request.json();
        
        console.log('=== SIGNIN DEBUG ===');
        console.log('Email:', email);
        console.log('Password provided:', !!password);
        
        if (!email || !password) {
            return json({ 
                success: false, 
                error: 'Email and password are required' 
            }, { status: 400 });
        }


        
        console.log('Attempting authentication with PocketBase...');
        
        // Direct authentication without preliminary health check
        const authData = await pb.collection('users').authWithPassword<User>(email, password);
        
        console.log('✅ Authentication successful!');
        console.log('User ID:', authData.record.id);
        
        // Set auth cookie with optimized settings
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        };

        // Store auth data in cookie for faster subsequent requests
        cookies.set('pb_auth', JSON.stringify({
            token: pb.authStore.token,
            model: pb.authStore.model
        }), cookieOptions);

        return json({
            success: true,
            user: sanitizeUserData(authData.record),
            token: pb.authStore.token
        });
        
    } catch (error) {
        console.error('=== SIGNIN ERROR ===');
        
        // Clear any existing auth cookie on error
        cookies.delete('pb_auth', { path: '/' });
        
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            
            // Handle specific PocketBase errors more gracefully
            if (error.message.includes('Failed to authenticate')) {
                return json({
                    success: false,
                    error: 'Invalid email or password'
                }, { status: 401 });
            }
        }
        
        console.error('Full error:', error);
        
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Authentication failed'
        }, { status: 401 });
    }
};

