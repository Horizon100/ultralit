import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) throw new Error('Unauthorized');

		const { id } = params;
		const userId = pb.authStore.model.id;

		const fileResult = await pbTryCatch(
			pb.collection('code_files').getOne(id, { expand: 'createdBy,lastEditedBy,repository' }),
			'fetch file'
		);
		const file = unwrap(fileResult);

		const repository =
			file.expand?.repository ??
			unwrap(
				await pbTryCatch(pb.collection('repositories').getOne(file.repository), 'fetch repository')
			);
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);
		const isPublic = repository.isPublic;

		if (!isOwner && !isCollaborator && !isPublic) throw new Error('Access denied');

		return file;
	}, 'Failed to fetch file');

export const PATCH: RequestHandler = async ({ params, request }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) throw new Error('Unauthorized');

		const { id } = params;
		const data = await request.json();
		const userId = pb.authStore.model.id;

		const fileResult = await pbTryCatch(pb.collection('code_files').getOne(id), 'fetch file');
		const file = unwrap(fileResult);

		const repoResult = await pbTryCatch(
			pb.collection('repositories').getOne(file.repository),
			'fetch repository'
		);
		const repository = unwrap(repoResult);

		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);

		if (!isOwner && !isCollaborator) throw new Error('Access denied');

		if (data.name && data.name !== file.name) {
			const existingFilesResult = await pbTryCatch(
				pb.collection('code_files').getList(1, 1, {
					filter: `repository="${file.repository}" && branch="${file.branch}" && path="${file.path}" && name="${data.name}" && id!="${id}"`
				}),
				'check existing file name'
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
			data.language = languageMap[fileExtension] ?? 'text';
		}

		let size = file.size;
		if (data.content) {
			const content = Array.isArray(data.content) ? data.content.join('') : data.content;
			size = new Blob([content]).size;
			if (!Array.isArray(data.content)) data.content = [data.content];
		}

		const updatedFileResult = await pbTryCatch(
			pb.collection('code_files').update(id, {
				name: data.name || file.name,
				content: data.content || file.content,
				path: data.path || file.path,
				lastEditedBy: userId,
				size,
				language: data.language || file.language
			}),
			'update file'
		);

		return unwrap(updatedFileResult);
	}, 'Failed to update file');

export const DELETE: RequestHandler = async ({ params }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) throw new Error('Unauthorized');

		const { id } = params;
		const userId = pb.authStore.model.id;

		const fileResult = await pbTryCatch(pb.collection('code_files').getOne(id), 'fetch file');
		const file = unwrap(fileResult);

		const repoResult = await pbTryCatch(
			pb.collection('repositories').getOne(file.repository),
			'fetch repository'
		);
		const repository = unwrap(repoResult);

		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);

		if (!isOwner && !isCollaborator) throw new Error('Access denied');

		await pbTryCatch(pb.collection('code_files').delete(id), 'delete file');

		return { success: true };
	}, 'Failed to delete file');
