import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';

export async function POST({ request }) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return json({ success: false, error: 'Email is required' }, { status: 400 });
    }
    
    console.log('Testing direct PocketBase password reset for email:', email);
    
    await pb.collection('users').requestPasswordReset(email);
    
    return json({ success: true, message: 'Direct PocketBase reset email sent' });
  } catch (error) {
    console.error('Direct PocketBase reset error:', error);
    
    return json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An error occurred during test reset' 
      }, 
      { status: 500 }
    );
  }
}