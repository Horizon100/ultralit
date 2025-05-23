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
    
    // Get the original auth URL from PocketBase
    const authUrl = new URL(googleProvider.authUrl);
    
    // Log the original URL parameters for debugging
    console.log('Original URL parameters:');
    authUrl.searchParams.forEach((value, key) => {
      console.log(`${key}: ${value}`);
    });
    
    // Check if redirect_uri is present
    if (!authUrl.searchParams.has('redirect_uri')) {
      console.log('redirect_uri is missing, setting it manually');
      
      // Set the production redirect URI
      authUrl.searchParams.set('redirect_uri', 'http://172.104.188.44:80/api/_/oauth2-redirect');
    }
    
    // If using Google OAuth, ensure these required parameters are set
    if (!authUrl.searchParams.has('client_id')) {
      console.error('client_id is missing from the auth URL!');
      return json({
        success: false,
        error: 'OAuth configuration is incomplete (missing client_id)'
      }, { status: 500 });
    }
    
    if (!authUrl.searchParams.has('scope')) {
      // Set default scope if missing
      authUrl.searchParams.set('scope', 'email profile');
    }
    
    if (!authUrl.searchParams.has('response_type')) {
      // For OAuth 2.0, code is typically used
      authUrl.searchParams.set('response_type', 'code');
    }
    
    // Log the final URL for debugging
    console.log('Final Google Auth URL:', authUrl.toString());
    
    // Return the modified authorization URL
    return json({
      success: true,
      authUrl: authUrl.toString(),
      originalProvider: googleProvider // Include this for debugging
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }, { status: 500 });
  }
};