// src/routes/api/threads/batch/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const ids = url.searchParams.get('ids');
    if (!ids) {
      throw new Error('No IDs provided');
    }

    const idArray = ids.split(',').filter(Boolean);
    if (idArray.length === 0) {
      return json({ items: [] });
    }

    const threads = await pb.collection('threads').getList(1, idArray.length, {
      filter: idArray.map((id) => `id="${id}"`).join(' || '),
      expand: 'project_id'
    });

    const userId = locals.user.id;

    const accessibleThreads = threads.items.filter((thread) => {
      if (thread.user === userId) return true;

      if (thread.project_id && thread.expand?.project_id) {
        const project = thread.expand.project_id;
        return (
          project.owner === userId ||
          (project.collaborators && project.collaborators.includes(userId))
        );
      }

      return false;
    });

    return json({
      ...threads,
      items: accessibleThreads
    });
  }, 'Failed to fetch threads batch');
