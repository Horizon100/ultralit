// src/routes/api/keys/messages/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import type { Messages } from '$lib/types/types';

export const GET: RequestHandler = async ({ locals, url }) =>
  apiTryCatch(async () => {
    console.log('API keys/messages: Fetching messages');

    if (!locals.user) {
      console.error('API keys/messages: User not authenticated');
      throw error(401, 'Authentication required');
    }

    const currentUserId = locals.user.id;
    const threadId = url.searchParams.get('thread');

    // If thread ID is provided, check thread permissions
    if (threadId) {
      const threadResult = await pbTryCatch(pb.collection('threads').getOne(threadId), 'fetch thread');
      const thread = unwrap(threadResult);

      const isCreator = thread.user === currentUserId;
      const isOp = thread.op === currentUserId;
      
      let isMember = false;
      if (thread.members) {
        if (typeof thread.members === 'string') {
          isMember = thread.members.includes(currentUserId);
        } else if (Array.isArray(thread.members)) {
          isMember = thread.members.some((m) =>
            typeof m === 'string' ? m === currentUserId : m.id === currentUserId
          );
        }
      }

      let hasProjectAccess = false;
      if (thread.project) {
        const projectId = typeof thread.project === 'string' ? thread.project : thread.project.id;
        try {
          const projectResult = await pbTryCatch(pb.collection('projects').getOne(projectId), 'fetch project');
          const project = unwrap(projectResult);
          hasProjectAccess =
            project.owner === currentUserId ||
            (Array.isArray(project.collaborators) && project.collaborators.includes(currentUserId));
        } catch (err) {
          console.warn('Project access check failed:', err);
        }
      }

      if (!isCreator && !isOp && !isMember && !hasProjectAccess) {
        throw error(403, 'You do not have permission to access this thread');
      }

      // Fetch messages for the specific thread
      const messagesResult = await pbTryCatch(
        pb.collection('messages').getFullList<Messages>({
          filter: `thread = "${threadId}"`,
          sort: '+created'
        }),
        'fetch thread messages'
      );
      const messages = unwrap(messagesResult);

      return json({
        success: true,
        messages
      });
    } else {
      // Fetch user's messages if no thread specified
      const messagesResult = await pbTryCatch(
        pb.collection('messages').getFullList<Messages>({
          filter: `user = "${currentUserId}"`,
          sort: '-created'
        }),
        'fetch user messages'
      );
      const messages = unwrap(messagesResult);

      return json({
        success: true,
        messages
      });
    }
  }, 'Failed to fetch messages');

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    console.log('API keys/messages: Creating message - START');

    if (!locals.user) {
      console.error('API keys/messages: User not authenticated');
      return json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const currentUserId = locals.user.id;
    let data;
    
    try {
      data = await request.json();
      console.log('API keys/messages: Received data:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('API keys/messages: Failed to parse JSON:', parseError);
      return json({ success: false, error: 'Invalid JSON data' }, { status: 400 });
    }

    // Allow empty text if attachments are present
    if (!data.text && !data.attachments) {
      console.log('API keys/messages: Empty message allowed, proceeding...');
    }

    // Thread permission checks if thread is specified
    if (data.thread) {
      try {
        console.log('API keys/messages: Checking thread permissions for:', data.thread);
        const thread = await pb.collection('threads').getOne(data.thread);
        console.log('API keys/messages: Thread found:', thread.id);

        const isCreator = thread.user === currentUserId;
        const isOp = thread.op === currentUserId;
        
        let isMember = false;
        if (thread.members) {
          if (typeof thread.members === 'string') {
            isMember = thread.members.includes(currentUserId);
          } else if (Array.isArray(thread.members)) {
            isMember = thread.members.some((m) =>
              typeof m === 'string' ? m === currentUserId : m.id === currentUserId
            );
          }
        }

        console.log('API keys/messages: Thread permissions - Creator:', isCreator, 'Op:', isOp, 'Member:', isMember);

        if (!isCreator && !isOp && !isMember) {
          console.error('API keys/messages: No permission to post to thread');
          return json({ success: false, error: 'No permission to post to this thread' }, { status: 403 });
        }
      } catch (threadError) {
        console.error('API keys/messages: Thread check failed:', threadError);
        return json({ success: false, error: 'Thread not found or inaccessible' }, { status: 404 });
      }
    }

    // Prepare message data - ensure all fields are properly handled
    const messageData = {
      text: data.text || '',
      user: data.user || currentUserId,
      thread: data.thread || null,
      parent_msg: data.parent_msg || null,
      type: data.type || 'text',
      prompt_type: data.prompt_type || null,
      prompt_input: data.prompt_input || null,
      model: data.model || '',
      read_by: Array.isArray(data.read_by) ? data.read_by : [currentUserId],
      attachments: data.attachments || '',
      task_relation: data.task_relation || null,
      agent_relation: data.agent_relation || null
    };

    console.log('API keys/messages: Creating message with data:', JSON.stringify(messageData, null, 2));

    try {
      // Create the message
      const message = await pb.collection('messages').create(messageData);
      console.log('API keys/messages: Message created successfully:', message.id);

      // Update thread timestamp if message belongs to a thread
      if (data.thread) {
        try {
          await pb.collection('threads').update(data.thread, {
            updated: new Date().toISOString()
          });
          console.log('API keys/messages: Thread timestamp updated');
        } catch (threadUpdateError) {
          console.warn('API keys/messages: Failed to update thread timestamp:', threadUpdateError);
          // Don't fail the request if thread update fails
        }
      }

      console.log('API keys/messages: Returning success response with message:', message.id);
      return json({
        success: true,
        message: message
      });

    } catch (createError) {
      console.error('API keys/messages: Failed to create message:', createError);
      
      // Handle PocketBase specific errors
      if (createError && typeof createError === 'object' && 'status' in createError) {
        const errorMsg = createError.message || 'Database error occurred';
        return json({ success: false, error: errorMsg }, { status: createError.status || 500 });
      }
      
      return json({ success: false, error: 'Failed to create message' }, { status: 500 });
    }

  } catch (outerError) {
    console.error('API keys/messages: Unexpected error:', outerError);
    return json({ 
      success: false, 
      error: outerError instanceof Error ? outerError.message : 'Internal server error' 
    }, { status: 500 });
  }
};