import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const PATCH: RequestHandler = async ({ params, request, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const tag = await pb.collection('tags').getOne(params.id);

    if (tag.createdBy !== locals.user.id) {
      if (tag.taggedProjects) {
        const projectIds = tag.taggedProjects.split(',').filter(Boolean);
        let hasAccess = false;

        for (const projectId of projectIds) {
          const project = await pb.collection('projects').getOne(projectId);
          if (
            project.owner === locals.user.id ||
            (project.collaborators && project.collaborators.includes(locals.user.id))
          ) {
            hasAccess = true;
            break;
          }
        }

        if (!hasAccess) {
          throw new Error('Unauthorized');
        }
      } else {
        throw new Error('Unauthorized');
      }
    }

    const data = await request.json();

    const updatedTag = await pb.collection('tags').update(params.id, data);

    return json(updatedTag);
  }, 'Failed to update tag');

export const DELETE: RequestHandler = async ({ params, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const tag = await pb.collection('tags').getOne(params.id);

    if (tag.createdBy !== locals.user.id) {
      if (tag.taggedProjects) {
        const projectIds = tag.taggedProjects.split(',').filter(Boolean);
        let hasOwnerAccess = false;

        for (const projectId of projectIds) {
          try {
            const project = await pb.collection('projects').getOne(projectId);
            if (project.owner === locals.user.id) {
              hasOwnerAccess = true;
              break;
            }
          } catch {
            // Ignore errors here, continue checking others
          }
        }

        if (!hasOwnerAccess) {
          throw new Error('Unauthorized');
        }
      } else {
        throw new Error('Unauthorized');
      }
    }

    await pb.collection('tags').delete(params.id);

    return json({ success: true });
  }, 'Failed to delete tag');

  export const GET: RequestHandler = async ({ params, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const tagId = params.id;
    if (!tagId) {
      throw new Error('Tag ID is required');
    }

    const result = await pbTryCatch(
      pb.collection('tags').getOne(tagId),
      `fetch tag ${tagId}`
    );

    const tag = unwrap(result);

    // Optional: Check if user has access to this tag
    // You might want to implement access control here based on your business logic
    
    return json({ success: true, data: tag });
  }, 'Failed to fetch tag');
