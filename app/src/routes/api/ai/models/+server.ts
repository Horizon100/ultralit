// src/routes/api/ai/models/+server.ts - FINAL CORRECTED VERSION
import { pb } from '$lib/server/pocketbase';
import type { AIModel } from '$lib/types/types';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    // Inline extractEndpoint logic:
    const pathParts = url.pathname.split('/');
    const aiIndex = pathParts.indexOf('ai');
    const modelsIndex = pathParts.indexOf('models');

    let command = '';
    const params: Record<string, string> = {};

    if (aiIndex !== -1 && modelsIndex !== -1 && modelsIndex === aiIndex + 1) {
      const remainingParts = pathParts.slice(modelsIndex + 1);
      command = remainingParts.join('/');

      if (remainingParts.length >= 1 && remainingParts[0]) {
        params.id = remainingParts[0];
      }
      if (remainingParts.length >= 2 && remainingParts[0] === 'provider') {
        params.provider = remainingParts[1];
      }
      if (remainingParts.length >= 4 && remainingParts[2] === 'user') {
        params.userId = remainingParts[3];
      }
    }

    if (params.id && !command.includes('/')) {
      // Fetch single model
      const modelResult = await pbTryCatch(pb.collection('models').getOne<AIModel>(params.id), 'fetch model');
      const model = unwrap(modelResult);

      if (!model.user.includes(locals.user.id)) {
        throw new Error('Unauthorized access to model');
      }

      // Inline sanitizeModelData logic: remove api_key
      const { api_key: _, ...sanitized } = model;
      return { success: true, model: sanitized };
    }

    if (command.startsWith('provider') && params.provider && params.userId) {
      if (params.userId !== locals.user.id) {
        throw new Error('Unauthorized access to user models');
      }

      const models = await pb.collection('models').getFullList<AIModel>({
        filter: `provider = "${params.provider}" && user ~ "${params.userId}"`,
        sort: '-created'
      });

      const sanitizedModels = models.map(({ api_key, ...rest }) => rest);
      return { success: true, models: sanitizedModels };
    }

    const userId = params.userId || url.searchParams.get('userId');
    const provider = params.provider || url.searchParams.get('provider');
    const targetUserId = userId || locals.user.id;

    if (targetUserId !== locals.user.id) {
      throw new Error('Unauthorized access to user models');
    }

    let filter = '';

    if (targetUserId && provider) {
      filter = `provider = "${provider}" && user ~ "${targetUserId}"`;
    } else if (targetUserId) {
      filter = `user ~ "${targetUserId}"`;
    } else if (provider) {
      filter = `provider = "${provider}"`;
    }

    const models = await pb.collection('models').getFullList<AIModel>({
      filter,
      sort: '-created'
    });

    const sanitizedModels = models.map(({ api_key, ...rest }) => rest);

    return { success: true, models: sanitizedModels };
  }, 'Error in models API GET');
export const POST: RequestHandler = async ({ request, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const body = await request.json();
    const { model, userId } = body;

    if (!model) {
      throw new Error('Model data is required');
    }

    if (!userId || userId !== locals.user.id) {
      throw new Error('Unauthorized: User ID mismatch');
    }

    // Validate required model fields
    if (!model.name || !model.provider || !model.api_type) {
      throw new Error('Model must have name, provider, and api_type');
    }

    // Prepare model data for PocketBase
    const modelData = {
      name: model.name,
      provider: model.provider,
      api_type: model.api_type,
      base_url: model.base_url || '',
      api_version: model.api_version || '',
      description: model.description || '',
      user: [userId], // PocketBase relation field
      api_key: model.api_key || '' // Store if provided
    };

    console.log('Creating model:', modelData);

    // Create the model
    const createResult = await pbTryCatch(
      pb.collection('models').create<AIModel>(modelData),
      'create model'
    );

    const createdModel = unwrap(createResult);

    // Remove api_key from response for security
    const { api_key, ...sanitizedModel } = createdModel;

    console.log('Model created successfully:', sanitizedModel.id);

    return { 
      success: true, 
      model: sanitizedModel 
    };
  }, 'Error creating model');