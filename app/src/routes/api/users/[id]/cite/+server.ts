// src/routes/api/users/[id]/cite/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const PATCH: RequestHandler = async ({ request, params }) => {
  try {
    const { cite } = await request.json();
    
    // Validate the cite value
    const validCites = ['wiki', 'quora', 'x', 'google', 'reddit'];
    if (!validCites.includes(cite)) {
      return json({ error: 'Invalid cite value' }, { status: 400 });
    }

    // Update the user record
    const updatedUser = await pb.collection('users').update(params.id, { cite });
    
    return json({ 
      success: true,
      cite: updatedUser.cite 
    });
  } catch (err) {
    console.error('Error updating cite:', err);
    return json({ 
      error: err.message || 'Failed to update cite' 
    }, { status: 400 });
  }
};