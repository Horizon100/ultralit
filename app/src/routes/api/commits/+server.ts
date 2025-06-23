import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';
import { v4 as uuidv4 } from 'uuid';
import { apiTryCatch } from '$lib/utils/errorUtils';

// GET: Fetch commits, optionally filtered by repository and branch
export const GET: RequestHandler = async ({ url }) =>
  apiTryCatch(async () => {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
      throw new Error('Unauthorized');
    }

    const userId = pb.authStore.model.id;

    // Get query parameters
    const repositoryId = url.searchParams.get('repositoryId');
    const branch = url.searchParams.get('branch');

    if (!repositoryId) {
      throw new Error('Repository ID is required');
    }

    // Check if user has access to the repository
    const repository = await pb.collection('repositories').getOne(repositoryId);
    const isOwner = repository.createdBy === userId;
    const isCollaborator = repository.repoCollaborators?.includes(userId);
    const isPublic = repository.isPublic;

    if (!isOwner && !isCollaborator && !isPublic) {
      throw new Error('Access denied');
    }

    // Build filter
    const filters = [`repository="${repositoryId}"`];

    if (branch) {
      filters.push(`branch="${branch}"`);
    } else {
      // Default to the repository's default branch
      filters.push(`branch="${repository.defaultBranch}"`);
    }

    const filter = filters.join(' && ');

    // Fetch commits
    const commits = await pb.collection('code_commits').getList(1, 50, {
      filter,
      sort: '-created',
      expand: 'author'
    });

    return commits;
  }, 'Failed to fetch commits', 500);

// POST: Create a new commit
export const POST: RequestHandler = async ({ request }) =>
  apiTryCatch(async () => {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
      throw new Error('Unauthorized');
    }

    const data = await request.json();
    const userId = pb.authStore.model.id;

    // Validate required fields
    if (!data.message || !data.repository || !data.changedFiles) {
      throw new Error('Commit message, repository, and changed files are required');
    }

    // Check if user has write access to the repository
    const repository = await pb.collection('repositories').getOne(data.repository);
    const isOwner = repository.createdBy === userId;
    const isCollaborator = repository.repoCollaborators?.includes(userId);

    if (!isOwner && !isCollaborator) {
      throw new Error('Access denied');
    }

    // Use the default branch if not specified
    const branch = data.branch || repository.defaultBranch;

    // Generate a commit hash (simplified for demo)
    const commitHash = uuidv4().substring(0, 8);

    // Create new commit
    const commit = await pb.collection('code_commits').create({
      message: data.message,
      repository: data.repository,
      branch,
      author: userId,
      changedFiles: data.changedFiles,
      hash: commitHash
    });

    return commit;
  }, 'Failed to create commit', 500);