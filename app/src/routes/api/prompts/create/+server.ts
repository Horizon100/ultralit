import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, cookies }) =>
  apiTryCatch(async () => {
    const authCookie = cookies.get('pb_auth');
    if (!authCookie) throw new Error('Not authenticated');

    const authData = JSON.parse(authCookie);
    pb.authStore.save(authData.token, authData.model);

    if (!pb.authStore.isValid || !pb.authStore.model?.id) throw new Error('Invalid session');

    const userId = pb.authStore.model.id;

    const body = await request.json();

    if (!body.text || typeof body.text !== 'string') {
      throw new Error('Invalid prompt data: text field is required and must be a string');
    }

    const data = {
      prompt: body.text,
      createdBy: userId
    };

    console.log('Creating new prompt with data:', data);

    const result = await pbTryCatch(pb.collection('prompts').create(data), 'create prompt');
    const record = unwrap(result);

    return json({
      success: true,
      data: record
    });
  }, 'Failed to create prompt');
