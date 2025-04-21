// src/routes/api/oauth2-redirect/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, fetch }) => {
  // Get the authorization code from the URL
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code) {
    // Redirect to error page if no code is provided
    throw redirect(302, '/auth/error');
  }
  
  try {
    // Forward this to your PocketBase server
    const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}_/#/auth/oauth2-redirect?code=${code}&state=${state}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('OAuth exchange failed');
    }
    
    // If successful, PocketBase should return auth data
    const data = await response.json();
    
    // Set auth cookie
    cookies.set('pb_auth', JSON.stringify({
      token: data.token,
      model: data.record
    }), {
      path: '/',
      secure: import.meta.env.PROD,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    
    // Redirect to home page or dashboard
    throw redirect(302, '/dashboard');
  } catch (error) {
    console.error('OAuth redirect handling error:', error);
    throw redirect(302, '/auth/error');
  }
};