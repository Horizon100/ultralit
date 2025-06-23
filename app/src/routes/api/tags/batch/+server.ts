// src/routes/api/tasks/batch/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const userId = locals.user.id;

    const ids = url.searchParams.get('ids');
    if (!ids) {
      throw new Error('No IDs provided');
    }

    const idArray = ids.split(',').filter(Boolean);
    if (idArray.length === 0) {
      return json({ items: [] });
    }

    const tasks = await pb.collection('tasks').getList(1, idArray.length, {
      filter: idArray.map((id) => `id="${id}"`).join(' || '),
      expand: 'project_id'
    });

    const accessibleTasks = tasks.items.filter((task) => {
      if (task.createdBy === userId) return true;

      if (task.project_id && task.expand?.project_id) {
        const project = task.expand.project_id;
        return (
          project.owner === userId ||
          (project.collaborators && project.collaborators.includes(userId))
        );
      }

      return false;
    });

    return json({ ...tasks, items: accessibleTasks });
  }, 'Failed to fetch batch tasks');
