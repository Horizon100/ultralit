import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get parameters - note we use 'repository' not 'repositoryId'
		const repository = url.searchParams.get('repository');
		const branch = url.searchParams.get('branch');
		const path = url.searchParams.get('path');

		console.log('Fetching files with params:', { repository, branch, path });

		if (!repository) {
			return json({ error: 'Repository parameter is required' }, { status: 400 });
		}

		// Verify repository exists
		let repoRecord;
		try {
			repoRecord = await pb.collection('repositories').getOne(repository);
		} catch (err) {
			return json({ error: 'Repository not found' }, { status: 404 });
		}

		// Check permissions
		const isOwner = repoRecord.createdBy === locals.user.id;
		const isCollaborator = repoRecord.repoCollaborators?.includes(locals.user.id);
		const isPublic = repoRecord.isPublic;

		if (!isOwner && !isCollaborator && !isPublic) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Build filter
		const filterParts = [
			`repository="${repository}"`,
			`branch="${branch || repoRecord.defaultBranch}"`
		];

		if (path) {
			filterParts.push(`path="${path}"`);
		}

		const filter = filterParts.join(' && ');
		console.log('Using filter:', filter);

		// Fetch files
		const files = await pb.collection('code_files').getList(1, 100, {
			filter,
			sort: 'name',
			expand: 'createdBy,lastEditedBy'
		});

		return json(files);
	} catch (error) {
		console.error('Error fetching files:', error);
		return json(
			{
				error: 'Failed to fetch files',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};

// POST: Create a new file
export const POST: RequestHandler = async ({ request }) => {
	// Check if user is authenticated
	const isAuthenticated = await ensureAuthenticated();
	if (!isAuthenticated || !pb.authStore.model) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await request.json();
		const userId = pb.authStore.model.id;

		// Validate required fields
		if (!data.name || !data.repository || !data.path) {
			return json({ error: 'File name, repository, and path are required' }, { status: 400 });
		}

		// Check if user has write access to the repository
		const repository = await pb.collection('repositories').getOne(data.repository);
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);

		if (!isOwner && !isCollaborator) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Use the default branch if not specified
		const branch = data.branch || repository.defaultBranch;

		// Check if file with same name already exists in the same path
		const existingFiles = await pb.collection('code_files').getList(1, 1, {
			filter: `repository="${data.repository}" && branch="${branch}" && path="${data.path}" && name="${data.name}"`
		});

		if (existingFiles.totalItems > 0) {
			return json(
				{ error: 'A file with this name already exists in this location' },
				{ status: 400 }
			);
		}

		// Determine file language based on extension
		const fileExtension = data.name.split('.').pop()?.toLowerCase() || '';
		let language = 'text';

		const languageMap: Record<string, string> = {
			js: 'javascript',
			ts: 'typescript',
			jsx: 'javascript',
			tsx: 'typescript',
			html: 'html',
			css: 'css',
			json: 'json',
			md: 'markdown',
			py: 'python',
			rb: 'ruby',
			java: 'java',
			c: 'c',
			cpp: 'cpp',
			go: 'go',
			rs: 'rust',
			php: 'php',
			sql: 'sql',
			sh: 'shell',
			yml: 'yaml',
			yaml: 'yaml',
			swift: 'swift',
			kt: 'kotlin'
		};

		if (fileExtension in languageMap) {
			language = languageMap[fileExtension];
		}

		// Calculate the initial content size
		const initialContent = data.content || '';
		const size = new Blob([initialContent]).size;

		// Create new file
		const file = await pb.collection('code_files').create({
			name: data.name,
			content: Array.isArray(initialContent) ? initialContent : [initialContent],
			path: data.path,
			repository: data.repository,
			branch: branch,
			createdBy: userId,
			lastEditedBy: userId,
			size: size,
			language: language
		});

		return json(file);
	} catch (error) {
		console.error('Error creating file:', error);
		return json({ error: 'Failed to create file' }, { status: 500 });
	}
};
