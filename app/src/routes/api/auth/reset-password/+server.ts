import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request }) =>
  apiTryCatch(async () => {
    const { email } = await request.json();
    if (!email) throw new Error('Email is required');

    await pb.collection('users').requestPasswordReset(email);
    return { success: true };
  }, 'Failed to request password reset');