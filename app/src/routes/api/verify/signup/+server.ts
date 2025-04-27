import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const { email, password } = await request.json();
        
        // Validate input
        if (!email || !password) {
            return json({ 
                success: false, 
                error: 'Email and password are required' 
            }, { status: 400 });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({
                success: false,
                error: 'Invalid email format'
            }, { status: 400 });
        }

        // Validate password strength
        if (password.length < 8) {
            return json({
                success: false,
                error: 'Password must be at least 8 characters'
            }, { status: 400 });
        }

        // Create user
        const user = await pbServer.pb.collection('users').create({
            email,
            password,
            passwordConfirm: password,
            emailVisibility: true
        });

        // Authenticate user
        const authData = await pbServer.pb.collection('users').authWithPassword(email, password);

        // Set auth cookie
        cookies.set('pb_auth', pbServer.pb.authStore.exportToCookie(), {
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 30 // 30 days
        });

        return json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                // Include other safe fields
            },
            token: authData.token
        });

    } catch (error: any) {
        console.error('Sign-up error:', error);
        
        let errorMessage = 'Sign-up failed';
        
        // More specific error handling for PocketBase errors
        if (error.response?.data) {
            // Handle structured PocketBase errors
            const errorData = error.response.data;
            if (typeof errorData === 'object') {
                // Extract field-specific errors
                errorMessage = Object.entries(errorData)
                    .map(([field, msg]) => `${field}: ${msg}`)
                    .join(', ');
            } else {
                errorMessage = String(errorData);
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
    
        return json({ 
            success: false, 
            error: errorMessage 
        }, { status: 400 });
    }
};