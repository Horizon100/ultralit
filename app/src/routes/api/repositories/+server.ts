import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const data = await request.json();

    if (!data?.repoName || !data?.project) {
      throw new Error('Repository name and project are required');
    }

    // Verify project exists and user access
    const projectResult = await pbTryCatch(pb.collection('projects').getOne(data.project), 'fetch project');
    const project = unwrap(projectResult);

    if (project.owner !== locals.user.id && !project.collaborators?.includes(locals.user.id)) {
      throw new Error('Unauthorized for this project');
    }

    // Create repository
    const repoResult = await pbTryCatch(
      pb.collection('repositories').create({
        repoName: data.repoName,
        project: data.project,
        createdBy: locals.user.id,
        defaultBranch: 'main',
        isPublic: false
      }),
      'create repository'
    );
    const repo = unwrap(repoResult);

    // Create root folder
    await pb.collection('code_folders').create({
      name: 'root',
      path: '/',
      repository: repo.id,
      branch: 'main',
      createdBy: locals.user.id
    });

    return json({ success: true, data: repo });
  }, 'Failed to create repository');

export const GET: RequestHandler = async ({ url, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const projectId = url.searchParams.get('projectId');
    const userId = url.searchParams.get('userId');
    const isPublic = url.searchParams.get('isPublic');

    let filter = `(createdBy="${locals.user.id}" || repoCollaborators~"${locals.user.id}"`;
    filter += isPublic === 'true' ? ' || isPublic=true)' : ')';

    if (projectId) {
      filter += ` && project="${projectId}"`;
    }

    if (userId) {
      filter += ` && createdBy="${userId}"`;
    }

    const reposResult = await pbTryCatch(
      pb.collection('repositories').getList(1, 100, {
        filter,
        sort: '-created',
        expand: 'createdBy,project'
      }),
      'fetch repositories'
    );
    const repositories = unwrap(reposResult);

    return json({ success: true, data: repositories });
  }, 'Failed to fetch repositories');
