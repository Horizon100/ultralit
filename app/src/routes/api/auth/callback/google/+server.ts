import { pb } from '$lib/server/pocketbase';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    // Extract OAuth params from URL
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code || !state) {
      throw new Error('Missing OAuth parameters');
    }
    
    // The correct redirect URL - should match what we used in the auth request
    const redirectUrl = `${url.origin}/api/auth/callback/google`;
    
    // Complete the OAuth flow using the correct method
    await pb.collection('users').authWithOAuth2({
      provider: 'google',
      code: code,
      state: state,
      redirectUrl: redirectUrl
    });
    
    // Set auth cookies
    cookies.set('pb_auth', pb.authStore.token, {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    
    // Redirect to dashboard after successful auth
    return redirect(303, '/home');
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // Redirect to login page with error
    return redirect(303, '/login?error=auth_failed&details=' + encodeURIComponent(errorMessage));
  }
};