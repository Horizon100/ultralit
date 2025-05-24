import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return json({ success: false, error: 'Email is required' }, { status: 400 });
    }
    
    // Log the request for debugging
    console.log(`Processing password reset for email: ${email}`);
    
    // Use PocketBase's built-in password reset
    await pb.collection('users').requestPasswordReset(email);
    
    // Log success
    console.log('Password reset email sent successfully');
    
    return json({ success: true });
  } catch (error) {
    // Log the error with details
    console.error('Password reset API error:', error);
    
    return json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An error occurred during password reset request' 
      }, 
      { status: 500 }
    );
  }
}