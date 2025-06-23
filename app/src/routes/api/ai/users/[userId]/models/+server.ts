import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AIModel } from '$lib/types/types';
import * as pbServer from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params, cookies }) =>
  apiTryCatch(async () => {
    const authCookie = cookies.get('pb_auth');
    if (authCookie) {
      try {
        const authData = JSON.parse(authCookie);
        pbServer.pb.authStore.save(authData.token, authData.model);
      } catch (e) {
        console.error('Error parsing auth cookie:', e);
      }
    }

    if (!pbServer.pb.authStore.isValid) {
      throw new Error('Not authenticated');
    }

    const userId = params.userId;
    if (!userId) {
      throw new Error('Missing userId parameter');
    }

    const currentUser = pbServer.pb.authStore.model;
    if (currentUser?.id !== userId && !currentUser?.admin) {
      throw new Error('Unauthorized to access these models');
    }

    const recordsResult = await pbTryCatch(
      pbServer.pb.collection('models').getFullList<AIModel>({
        filter: `user ~ "${userId}"`,
        sort: '-created'
      }),
      'fetch models'
    );

    const records = unwrap(recordsResult);

    const sanitizedModels = records.map((model) => ({
      id: model.id,
      name: model.name,
      base_url: model.base_url,
      api_type: model.api_type,
      api_version: model.api_version,
      description: model.description,
      user: model.user,
      created: model.created,
      updated: model.updated,
      provider: model.provider
    }));

    return json({ success: true, models: sanitizedModels });
  }, 'Failed to fetch models for user');
