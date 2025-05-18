import { pb } from '$lib/server/pocketbase';
import { redirect } from '@sveltejs/kit';

export const GET = async ({ url, cookies, request }) => {
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
    const authData = await pb.collection('users').authWithOAuth2({
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
    return redirect(303, '/dashboard');
  } catch (error) {
    console.error('OAuth callback error:', error);
    // Redirect to login page with error
    return redirect(303, '/login?error=auth_failed&details=' + encodeURIComponent(error.message));
  }
};