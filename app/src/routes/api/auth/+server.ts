// src/routes/api/auth/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { email, password } = await request.json();
  
  try {
    const authData = await pb.collection('users').authWithPassword(email, password);
    cookies.set('pb_auth', pb.authStore.exportToCookie(), {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    return json({
      success: true,
      user: authData.record
    });
  } catch (err) {
    throw error(401, 'Invalid credentials');
  }
};