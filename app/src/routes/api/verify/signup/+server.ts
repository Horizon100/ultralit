import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';

// Helper function to sanitize user data for client
function sanitizeUserData(user: any): any {
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
        model: user.model
    };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const { email, password } = await request.json();
        
        if (!email || !password) {
            return json({ 
                success: false, 
                error: 'Email and password are required' 
            }, { status: 400 });
        }
        
        const user = await pbServer.signUp(email, password);
        if (!user) {
            return json({ success: false, error: 'Failed to create user' }, { status: 400 });
        }
        
        // Automatically sign in after successful signup
        const authData = await pbServer.signIn(email, password);
        
        // Save auth to cookies
        if (pbServer.pb.authStore.isValid) {
            cookies.set('pb_auth', JSON.stringify({
                token: pbServer.pb.authStore.token,
                model: pbServer.pb.authStore.model
            }), {
                path: '/',
                httpOnly: true,
                sameSite: 'strict',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 30 // 30 days
            });
        }
        
        return json({ 
            success: true, 
            user: sanitizeUserData(user),
            authData
        });
    } catch (error) {
        console.error('Sign-up error:', error);
        return json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Sign-up failed' 
        }, { status: 400 });
    }
};