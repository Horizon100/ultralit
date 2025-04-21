// src/routes/api/auth/callback/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { code, state } = await request.json();
    
    if (!code) {
      return json({ 
        success: false, 
        error: 'No authorization code provided' 
      }, { status: 400 });
    }
    
    // Use the PocketBase SDK to exchange the code
    // Note: This completes the OAuth flow on the server side
    const redirectUrl = `${request.headers.get('origin')}/auth/callback`;
    const authData = await pb.collection('users').authWithOAuth2Code(
      'google',
      code,
      state,
      redirectUrl
    );
    
    // Set auth cookie
    const cookieValue = JSON.stringify({
      token: authData.token,
      model: authData.record
    });
    
    cookies.set('pb_auth', cookieValue, {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    
    // Return the authenticated user
    return json({
      success: true,
      user: {
        id: authData.record.id,
        email: authData.record.email,
        username: authData.record.username,
        name: authData.record.name,
        avatar: authData.record.avatar,
        // Add other safe fields here
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }, { status: 500 });
  }
};