// src/routes/api/keys/messages/search/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
  console.log('🔍 Message search endpoint called (keys)');
  
  // Check authentication using locals.user like your other keys endpoints
  if (!locals.user) {
    console.error('API keys/messages/search: User not authenticated');
    throw error(401, 'Authentication required');
  }
  
  const currentUserId = locals.user.id;
  console.log('Authenticated user:', currentUserId);
  
  try {
    const query = url.searchParams.get('q');
    const limit = url.searchParams.get('limit') || '10';
    const projectId = url.searchParams.get('project');
    
    console.log('Search params:', { query, limit, projectId });
    
    if (!query || query.trim().length === 0) {
      return json({
        success: true,
        messages: []
      });
    }
    
    // Build filter to search user's messages
    let filter = `text ~ "${query}" && user = "${currentUserId}"`;
    
    if (projectId) {
      filter += ` && thread.project_id = "${projectId}"`;
    }
    
    console.log('Search filter:', filter);
    
    // Search messages
    const messages = await pb.collection('messages').getList(1, parseInt(limit), {
      filter,
      sort: '-created',
      expand: 'thread,user',
      fields: '*,expand.thread.name,expand.thread.project_id,expand.user.name'
    });
    
    console.log('Search successful, found:', messages.items.length, 'messages');
    
    // Transform the results
    const messagesWithContext = messages.items.map((message: any) => ({
      ...message,
      threadName: message.expand?.thread?.name || 'Unknown Thread',
      threadId: message.thread,
      userName: message.expand?.user?.name || 'Unknown User',
      projectId: message.expand?.thread?.project_id || null
    }));
    
    return json({
      success: true,
      messages: messagesWithContext,
      total: messages.totalItems
    });
    
  } catch (err) {
    console.error('API keys/messages/search: Error:', err);
    
    const statusCode = err.status || 500;
    const message = err.message || 'Failed to search messages';
    
    return json({ 
      success: false, 
      message: message
    }, { status: statusCode });
  }
};