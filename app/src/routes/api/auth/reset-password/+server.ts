// src/routes/api/auth/reset-password/+server.ts
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request }) =>
  apiTryCatch(async () => {
    const { email, securityAnswer, newPassword } = await request.json();
    
    if (!email) {
      throw new Error('Email is required');
    }

    if (!securityAnswer && !newPassword) {
      throw new Error('Security answer and new password are required');
    }

    const user = await pb.collection('users').getFirstListItem(`email="${email}"`);
    
    const security = await pb.collection('users_security').getFirstListItem(`user="${user.id}"`);
    
    const normalizedAnswer = securityAnswer.toLowerCase().trim();
    const storedAnswer = security.securityAnswer.toLowerCase().trim();
    
    if (normalizedAnswer !== storedAnswer) {
      throw new Error('Incorrect security answer');
    }

    await pb.collection('users').update(user.id, {
      password: newPassword,
      passwordConfirm: newPassword
    });

    return { success: true };
  }, 'Failed to reset password');