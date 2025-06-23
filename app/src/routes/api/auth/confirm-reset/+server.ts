import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request }) =>
  apiTryCatch(async () => {
    const { token, password, passwordConfirm } = await request.json();

    if (!token || !password || !passwordConfirm) {
      throw new Error('Token, password, and password confirmation are required');
    }
    if (password !== passwordConfirm) {
      throw new Error('Passwords do not match');
    }

    await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);
    return { success: true };
  }, 'Failed to confirm password reset');