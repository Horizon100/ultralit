// src/routes/api/tasks/search/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) =>
  apiTryCatch(async () => {
    const user = locals.user;
    if (!user) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const projectId = url.searchParams.get('project') || '';

    if (!query) {
      return json({ tasks: [], total: 0 });
    }

    let filter = `(title ~ "${query}" || taskDescription ~ "${query}") && (assignedTo = "${user.id}" || createdBy = "${user.id}")`;

    if (projectId) {
      filter += ` && project_id = "${projectId}"`;
    }

    const tasksData = await pb.collection('tasks').getList(1, limit, {
      filter,
      sort: '-updated',
      expand: 'createdBy',
      skip: offset
    });

    const tasks = tasksData.items.map((task) => {
      const plainTask = { ...task };

      if (task.expand?.createdBy) {
        plainTask.creatorName = task.expand.createdBy.name || task.expand.createdBy.username;
        plainTask.creatorAvatar = task.expand.createdBy.avatar;
      }

      return plainTask;
    });

    return {
      tasks,
      total: tasksData.totalItems,
      totalPages: tasksData.totalPages,
      page: tasksData.page
    };
  }, 'Failed to search tasks');
