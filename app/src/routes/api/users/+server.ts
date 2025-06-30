import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url }) => {
	const search = url.searchParams.get('search');

	if (!search || search.trim() === '') {
		return json([], { status: 200 });
	}

	try {
		const sanitizedSearch = search.trim().toLowerCase();
		console.log('Searching for users with term:', sanitizedSearch);

		// Include status and last_login in public fields
		const publicFields = 'id,name,username,avatar,created,status,last_login,followers,following';

		// Try exact matching first
		console.log('Trying exact match search...');
		const exactMatches = await pb.collection('users').getList(1, 100, {
			filter: `name = "${sanitizedSearch}" || username = "${sanitizedSearch}" || id = "${sanitizedSearch}"`,
			fields: publicFields
		});

		console.log(`Found ${exactMatches.totalItems} exact matches`);

		if (exactMatches.totalItems > 0) {
			// We found exact matches
			const filteredResults = exactMatches.items.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				avatar: user.avatar,
				created: user.created,
				status: user.status,
				last_login: user.last_login,
				followers: user.followers,
				following: user.following,
				location: user.location,
				website: user.website
			}));

			console.log('Returning exact matches:', filteredResults.length);
			return json(filteredResults, { status: 200 });
		}

		console.log('No exact matches, trying contains search...');
		const containsMatches = await pb.collection('users').getList(1, 100, {
			filter: `name ~ "${sanitizedSearch}" || username ~ "${sanitizedSearch}"`,
			fields: publicFields
		});

		console.log(`Found ${containsMatches.totalItems} contains matches`);

		if (containsMatches.totalItems > 0) {
			const filteredResults = containsMatches.items.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				avatar: user.avatar,
				created: user.created,
				status: user.status,
				last_login: user.last_login,
				followers: user.followers,
				following: user.following,
				location: user.location,
				website: user.website
			}));

			console.log('Returning contains matches:', filteredResults.length);
			return json(filteredResults, { status: 200 });
		}

		// If the search term is at least 3 characters, try manual filtering as a last resort
		if (sanitizedSearch.length >= 3) {
			console.log('No matches found with PocketBase filters, trying manual filtering...');

			// Get users with only public fields (limit to 200 to prevent performance issues)
			const allUsers = await pb.collection('users').getFullList(200, {
				fields: publicFields // Now includes status and last_login
			});
			console.log(`Retrieved ${allUsers.length} users for manual filtering`);

			// Manually filter users (only search in public fields)
			const manuallyFiltered = allUsers.filter((user) => {
				const name = (user.name || '').toLowerCase();
				const username = (user.username || '').toLowerCase();

				return (
					name.includes(sanitizedSearch) ||
					username.includes(sanitizedSearch) ||
					user.id === sanitizedSearch
				);
			});

			console.log(`Found ${manuallyFiltered.length} users through manual filtering`);

			const filteredResults = manuallyFiltered.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				avatar: user.avatar,
				created: user.created,
				status: user.status,
				last_login: user.last_login,
				followers: user.followers,
				following: user.following,
				location: user.location,
				website: user.website
			}));

			return json(filteredResults, { status: 200 });
		}

		// No matches found
		console.log('No matches found for search term:', sanitizedSearch);
		return json([], { status: 200 });
	} catch (err) {
		console.error('Error searching users:', err);

		// Check if it's a permissions error
		if (err && typeof err === 'object' && 'status' in err && err.status === 403) {
			console.error('Permission denied - make sure users collection allows public read access');
		}

		return json(
			{
				error: 'Failed to search users',
				message: err instanceof Error ? err.message : String(err)
			},
			{ status: 500 }
		);
	}
};
