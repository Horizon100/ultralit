// src/routes/api/agents/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, url, cookies }) =>
  apiTryCatch(async () => {
    const authCookie = cookies.get('pb_auth');
    if (!authCookie) throw error(401, 'Authentication required');

    try {
      const authData = JSON.parse(authCookie);
      pb.authStore.save(authData.token, authData.model);
    } catch {
      pb.authStore.loadFromCookie(authCookie);
    }

    if (!pb.authStore.isValid) throw error(401, 'Invalid authentication');

    const userId = pb.authStore.model?.id;
    if (!userId) throw error(401, 'User ID not found');

    const expand = url.searchParams.get('expand') || '';
    const queryOptions: { expand?: string } = {};
    if (expand) queryOptions.expand = expand;

    const agentResult = await pbTryCatch(pb.collection('ai_agents').getOne(params.id, queryOptions), 'fetch agent');
    const agent = unwrap(agentResult);

    if (agent.owner !== userId) throw error(403, 'Access denied');

    return json({ success: true, data: agent });
  }, 'Failed to fetch agent');

export const PATCH: RequestHandler = async ({ params, request, cookies }) =>
  apiTryCatch(async () => {
    const authCookie = cookies.get('pb_auth');
    if (!authCookie) throw error(401, 'Authentication required');

    try {
      const authData = JSON.parse(authCookie);
      pb.authStore.save(authData.token, authData.model);
    } catch {
      pb.authStore.loadFromCookie(authCookie);
    }

    if (!pb.authStore.isValid) throw error(401, 'Invalid authentication');

    const userId = pb.authStore.model?.id;
    if (!userId) throw error(401, 'User ID not found');

    const existingResult = await pbTryCatch(pb.collection('ai_agents').getOne(params.id), 'fetch existing agent');
    const existingAgent = unwrap(existingResult);

    if (existingAgent.owner !== userId) throw error(403, 'Access denied');

    const contentType = request.headers.get('content-type');
    let updateData: FormData | Record<string, unknown>;

    if (contentType?.includes('multipart/form-data')) {
      updateData = await request.formData();
    } else {
      updateData = await request.json();
    }

    const updatedResult = await pbTryCatch(pb.collection('ai_agents').update(params.id, updateData), 'update agent');
    const updatedAgent = unwrap(updatedResult);

    return json({ success: true, data: updatedAgent });
  }, 'Failed to update agent');

export const DELETE: RequestHandler = async ({ params, cookies }) =>
  apiTryCatch(async () => {
    const authCookie = cookies.get('pb_auth');
    if (!authCookie) throw error(401, 'Authentication required');

    try {
      const authData = JSON.parse(authCookie);
      pb.authStore.save(authData.token, authData.model);
    } catch {
      pb.authStore.loadFromCookie(authCookie);
    }

    if (!pb.authStore.isValid) throw error(401, 'Invalid authentication');

    const userId = pb.authStore.model?.id;
    if (!userId) throw error(401, 'User ID not found');

    const existingResult = await pbTryCatch(pb.collection('ai_agents').getOne(params.id), 'fetch existing agent');
    const existingAgent = unwrap(existingResult);

    if (existingAgent.owner !== userId) throw error(403, 'Access denied');

    await pbTryCatch(pb.collection('ai_agents').delete(params.id), 'delete agent');

    return json({ success: true });
  }, 'Failed to delete agent');
