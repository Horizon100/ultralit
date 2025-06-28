import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const repository = url.searchParams.get('repository');
		const branch = url.searchParams.get('branch');
		const path = url.searchParams.get('path');

		if (!repository) throw new Error('Repository parameter is required');

		const repoResult = await pbTryCatch(
			pb.collection('repositories').getOne(repository),
			'fetch repository'
		);
		const repoRecord = unwrap(repoResult);

		const isOwner = repoRecord.createdBy === locals.user.id;
		const isCollaborator = repoRecord.repoCollaborators?.includes(locals.user.id);
		const isPublic = repoRecord.isPublic;

		if (!isOwner && !isCollaborator && !isPublic) throw new Error('Access denied');

		const filterParts = [
			`repository="${repository}"`,
			`branch="${branch || repoRecord.defaultBranch}"`
		];
		if (path) filterParts.push(`path="${path}"`);
		const filter = filterParts.join(' && ');

		const filesResult = await pbTryCatch(
			pb.collection('code_files').getList(1, 100, {
				filter,
				sort: 'name',
				expand: 'createdBy,lastEditedBy'
			}),
			'fetch files'
		);

		return unwrap(filesResult);
	}, 'Failed to fetch files');

export const POST: RequestHandler = async ({ request }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) throw new Error('Unauthorized');

		const data = await request.json();
		const userId = pb.authStore.model.id;

		if (!data.name || !data.repository || !data.path)
			throw new Error('File name, repository, and path are required');

		const repoResult = await pbTryCatch(
			pb.collection('repositories').getOne(data.repository),
			'fetch repository'
		);
		const repository = unwrap(repoResult);

		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);

		if (!isOwner && !isCollaborator) throw new Error('Access denied');

		const branch = data.branch || repository.defaultBranch;

		const existingFilesResult = await pbTryCatch(
			pb.collection('code_files').getList(1, 1, {
				filter: `repository="${data.repository}" && branch="${branch}" && path="${data.path}" && name="${data.name}"`
			}),
			'check existing file'
		);

		const existingFiles = unwrap(existingFilesResult);
		if (existingFiles.totalItems > 0)
			throw new Error('A file with this name already exists in this location');

		const fileExtension = data.name.split('.').pop()?.toLowerCase() || '';
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
		const language = languageMap[fileExtension] || 'text';

		const initialContent = data.content || '';
		const size = new Blob([initialContent]).size;

		const fileResult = await pbTryCatch(
			pb.collection('code_files').create({
				name: data.name,
				content: Array.isArray(initialContent) ? initialContent : [initialContent],
				path: data.path,
				repository: data.repository,
				branch,
				createdBy: userId,
				lastEditedBy: userId,
				size,
				language
			}),
			'create file'
		);

		return unwrap(fileResult);
	}, 'Failed to create file');
