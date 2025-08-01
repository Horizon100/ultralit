// src/routes/api/auth/security/+server.ts
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request }) =>
  apiTryCatch(async () => {
    const { userId, securityQuestion, securityAnswer } = await request.json();
    
    if (!userId || !securityQuestion || !securityAnswer) {
      throw new Error('All fields are required');
    }

    // Create security record
    await pb.collection('users_security').create({
      user: userId,
      securityQuestion,
      securityAnswer: securityAnswer.toLowerCase().trim()
    });

    return { success: true };
  }, 'Failed to save security information');

export const GET: RequestHandler = async ({ url }) =>
  apiTryCatch(async () => {
    const email = url.searchParams.get('email');
    
    if (!email) {
      throw new Error('Email is required');
    }

    // Find user by email
    const user = await pb.collection('users').getFirstListItem(`email="${email}"`);
    
    // Get security question
    const security = await pb.collection('users_security').getFirstListItem(`user="${user.id}"`);
    
    return { 
      success: true, 
      question: security.securityQuestion 
    };
  }, 'Failed to get security question');