import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url }) =>
  apiTryCatch(async () => {
    console.log('Starting Google auth flow...');

    const authMethods = await pb.collection('users').listAuthMethods();

    const googleProvider = authMethods.authProviders.find((p) => p.name === 'google');

    if (!googleProvider) {
      throw new Error('Google authentication provider not found');
    }

    const authUrl = new URL(googleProvider.authUrl);

    authUrl.searchParams.forEach((value, key) => {
      console.log(`${key}: ${value}`);
    });

    if (!authUrl.searchParams.has('redirect_uri')) {
      console.log('redirect_uri missing, setting manually');
      authUrl.searchParams.set('redirect_uri', 'http://172.104.188.44:80/api/_/oauth2-redirect');
    }

    if (!authUrl.searchParams.has('client_id')) {
      throw new Error('OAuth configuration incomplete (missing client_id)');
    }

    if (!authUrl.searchParams.has('scope')) {
      authUrl.searchParams.set('scope', 'email profile');
    }

    if (!authUrl.searchParams.has('response_type')) {
      authUrl.searchParams.set('response_type', 'code');
    }

    console.log('Final Google Auth URL:', authUrl.toString());

    return {
      success: true,
      authUrl: authUrl.toString(),
      originalProvider: googleProvider
    };
  }, 'Failed to get Google auth URL');