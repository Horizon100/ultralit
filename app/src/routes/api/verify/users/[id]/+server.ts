import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    // Allow fetching user profile even without authentication
    // This is important for model initialization which needs the user preferences
    const user = await pb.collection('users').getOne(params.id, {
      expand: 'verification'  // If you have related data
    });

    return json({
      success: true,
      user: {
        id: user.id,
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        description: user.description || '',
        role: user.role || '',
        created: user.created || '',
        updated: user.updated || '',
        verified: user.verified || false,
        model: user.model || null,
        selected_provider: user.selected_provider || null,
        prompt_preference: user.prompt_preference || '',
        sysprompt_preference: user.sysprompt_preference || '',
        api_keys: {},
        verification_status: user.expand?.verification?.status || '',
        last_verified: user.expand?.verification?.updated || '',
        model_preference: user.model_preference
      }
    });
  } catch (err) {
    console.error('Failed to fetch user data:', err);
    return json({
      success: false, 
      error: 'Failed to fetch user data'
    }, { status: 400 });
  }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user?.id) {
      return json({
        success: false,
        error: 'Authentication required'
      }, { status: 403 });
    }
    
    if (params.id !== locals.user.id) {
      return json({
        success: false,
        error: 'You can only update your own user data'
      }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    let updateData: Record<string, any> = {};
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          updateData[key] = value;
        } else {
          updateData[key] = value;
        }
      }
    } else {
      const data = await request.json();
      
      const allowedFields = [
        'name', 'username', 'description', 'email', 
        'model', 'selected_provider', 'theme', 'language', 
        'prompt_preference', 'sysprompt_preference', 'avatar'
      ];
      
      for (const field of allowedFields) {
        if (field in data) {
          updateData[field] = data[field];
        }
      }
    }
    
    updateData.updated = new Date().toISOString();

    const updated = await pb.collection('users').update(params.id, updateData);

    return json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        email: updated.email,
        description: updated.description,
        role: updated.role,
        created: updated.created,
        updated: updated.updated,
        verified: updated.verified,
        avatar: updated.avatar,
        model: updated.model,
        selected_provider: updated.selected_provider,
        prompt_preference: updated.prompt_preference,
        sysprompt_preference: updated.sysprompt_preference
      }
    });
  } catch (err) {
    console.error('Update failed:', err);
    return json({
      success: false, 
      error: err instanceof Error ? err.message : 'Update failed'
    }, { status: 400 });
  }
};