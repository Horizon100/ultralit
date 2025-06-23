// src/routes/api/keys/messages/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, locals }) =>
  apiTryCatch(async () => {
    console.log('API keys/messages: Creating message');

    if (!locals.user) {
      console.error('API keys/messages: User not authenticated');
      throw error(401, 'Authentication required');
    }

    const currentUserId = locals.user.id;
    const data = await request.json();

    // Thread permission checks
    if (data.thread) {
      const threadResult = await pbTryCatch(pb.collection('threads').getOne(data.thread), 'fetch thread');
      const thread = unwrap(threadResult);

      const isCreator = thread.user === currentUserId;
      const isOp = thread.op === currentUserId;
      const isMember = Array.isArray(thread.members) && thread.members.includes(currentUserId);

      if (!isCreator && !isOp && !isMember) {
        throw error(403, 'No permission to post to this thread');
      }
    }

    // Create message with all fields preserved
    const messageData = {
      text: data.text,
      user: data.user || currentUserId,
      thread: data.thread,
      parent_msg: data.parent_msg,
      type: data.type || 'text',
      prompt_type: data.prompt_type || '',
      prompt_input: data.prompt_input || '',
      model: data.model || '',
      read_by: data.read_by || [currentUserId],
      attachments: data.attachments || '',
      task_relation: data.task_relation || '',
      agent_relation: data.agent_relation || ''
    };

    const messageResult = await pbTryCatch(pb.collection('messages').create(messageData), 'create message');
    const message = unwrap(messageResult);

    // Update thread timestamp
    if (data.thread) {
      await pbTryCatch(
        pb.collection('threads').update(data.thread, {
          updated: new Date().toISOString()
        }),
        'update thread timestamp'
      );
    }

    return json({
      success: true,
      message
    });
  }, 'Failed to create message');
