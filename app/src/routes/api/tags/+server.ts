// src/routes/api/tags/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const filterParam = url.searchParams.get('filter');
		const search = url.searchParams.get('search') || '';
		const limit = parseInt(url.searchParams.get('limit') || '100');
		const page = parseInt(url.searchParams.get('page') || '1');

		let filterString = '';

		if (filterParam === 'createdBy') {
			filterString = `createdBy="${locals.user.id}"`;
		} else {
			filterString = `createdBy="${locals.user.id}" || taggedProjects=""`;
		}

		// Add search filter if provided
		if (search) {
			const searchFilter = `name ~ "${search}"`;
			filterString = filterString ? `(${filterString}) && (${searchFilter})` : searchFilter;
		}

		console.log('Fetching tags with filter:', filterString);

		const result = await pbTryCatch(
			pb.collection('tags').getList(page, limit, {
				filter: filterString,
				sort: 'name'
			}),
			'fetch tags'
		);

		const tags = unwrap(result);

		return json({ 
			success: true, 
			items: tags.items,
			totalItems: tags.totalItems,
			totalPages: tags.totalPages
		});
	}, 'Failed to fetch tags');

export const POST: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const data = await request.json();

		// Validate tag data
		if (!data.name || typeof data.name !== 'string') {
			throw new Error('Tag name is required and must be a string');
		}

		if (data.name.trim().length === 0) {
			throw new Error('Tag name cannot be empty');
		}

		if (data.name.length > 50) {
			throw new Error('Tag name must be 50 characters or less');
		}

		// Prepare tag data
		const tagData = {
			name: data.name.trim().toLowerCase(),
			selected: data.selected === true,
			createdBy: locals.user.id,
			taggedPosts: data.taggedPosts || []
		};

		// Check if tag already exists for this user
		try {
			const existingTag = await pb.collection('tags').getFirstListItem(`name = "${tagData.name}" && createdBy = "${locals.user.id}"`);
			console.log('Tag already exists:', tagData.name);
			return json({ success: true, data: existingTag });
		} catch (error) {
			// Tag doesn't exist, continue with creation
		}

		// Create new tag
		const result = await pbTryCatch(pb.collection('tags').create(tagData), 'create tag');
		const tag = unwrap(result);

		console.log('Created new tag:', tagData.name);
		return json({ success: true, data: tag });
	}, 'Failed to create tag');