import { pb } from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';
import type { Handle } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/validation';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
  const clientIP = event.getClientAddress();
  
  // Rate limiting for API endpoints
  if (event.url.pathname.startsWith('/api/')) {
    // Different limits for different endpoints
    let maxRequests = 60;
    let windowMs = 60000; // 1 minute
    
    if (event.url.pathname.includes('/auth')) {
      maxRequests = 5;
      windowMs = 300000; // 5 minutes for auth
    } else if (event.url.pathname.includes('/ai/')) {
      maxRequests = 10;
      windowMs = 60000;
    }
    
    if (!checkRateLimit(clientIP, event.url.pathname, maxRequests, windowMs)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Load the auth store from request cookie
  pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

  // Add pb and user to locals
  event.locals.pb = pb;
  event.locals.user = pb.authStore.model ? (structuredClone(pb.authStore.model) as User) : null;

  const response = await resolve(event);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CSP for production
  if (!dev) {
    response.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' " + process.env.VITE_POCKETBASE_URL + ";"
    );
  }

  // Set secure cookie only if we have a valid auth
  if (pb.authStore.isValid) {
    response.headers.set(
      'set-cookie',
      pb.authStore.exportToCookie({
        secure: !dev, // Use secure in production
        sameSite: 'Strict', // Changed from 'Lax' to 'Strict' for better security
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
    );
  }

  return response;
};