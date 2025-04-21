// src/routes/api/auth/google/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    console.log('Starting Google auth flow...');
    
    // Get auth methods from PocketBase
    const authMethods = await pb.collection('users').listAuthMethods();
    
    // Find Google provider
    const googleProvider = authMethods.authProviders.find(
      provider => provider.name === 'google'
    );
    
    if (!googleProvider) {
      return json({
        success: false,
        error: 'Google authentication provider not found'
      }, { status: 400 });
    }
    
    // Get the auth URL and modify it to include the correct redirect URI
    const authUrl = new URL(googleProvider.authUrl);
    
    // Set the redirect_uri parameter explicitly
    authUrl.searchParams.set('redirect_uri', 'https://vrazum.com/api/oauth2-redirect');
    
    // Return the modified authorization URL
    return json({
      success: true,
      authUrl: authUrl.toString()
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }, { status: 500 });
  }
};