import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	// Get search parameter
	const search = url.searchParams.get('search');

	if (!search || search.trim() === '') {
		return json([], { status: 200 });
	}

	try {
		const sanitizedSearch = search.trim().toLowerCase();
		console.log('Searching for users with term:', sanitizedSearch);

		// Try exact matching first
		console.log('Trying exact match search...');
		const exactMatches = await pb.collection('users').getList(1, 100, {
			filter: `email = "${sanitizedSearch}" || name = "${sanitizedSearch}" || username = "${sanitizedSearch}" || id = "${sanitizedSearch}"`
		});

		console.log(`Found ${exactMatches.totalItems} exact matches`);

		if (exactMatches.totalItems > 0) {
			// We found exact matches
			const filteredResults = exactMatches.items.map((user) => ({
				id: user.id,
				email: user.email,
				name: user.name,
				username: user.username,
				avatar: user.avatar,
				collectionId: user.collectionId
			}));

			console.log('Returning exact matches:', filteredResults.length);
			return json(filteredResults, { status: 200 });
		}

		// No exact matches found, try with contains operator
		console.log('No exact matches, trying contains search...');
		const containsMatches = await pb.collection('users').getList(1, 100, {
			filter: `email ~ "${sanitizedSearch}" || name ~ "${sanitizedSearch}" || username ~ "${sanitizedSearch}"`
		});

		console.log(`Found ${containsMatches.totalItems} contains matches`);

		if (containsMatches.totalItems > 0) {
			// We found contains matches
			const filteredResults = containsMatches.items.map((user) => ({
				id: user.id,
				email: user.email,
				name: user.name,
				username: user.username,
				avatar: user.avatar,
				collectionId: user.collectionId
			}));

			console.log('Returning contains matches:', filteredResults.length);
			return json(filteredResults, { status: 200 });
		}

		// If the search term is at least 3 characters, try manual filtering as a last resort
		if (sanitizedSearch.length >= 3) {
			console.log('No matches found with PocketBase filters, trying manual filtering...');

			// Get all users (limit to 200 to prevent performance issues)
			const allUsers = await pb.collection('users').getFullList(200);
			console.log(`Retrieved ${allUsers.length} users for manual filtering`);

			// Manually filter users
			const manuallyFiltered = allUsers.filter((user) => {
				const email = (user.email || '').toLowerCase();
				const name = (user.name || '').toLowerCase();
				const username = (user.username || '').toLowerCase();

				return (
					email.includes(sanitizedSearch) ||
					name.includes(sanitizedSearch) ||
					username.includes(sanitizedSearch) ||
					user.id === sanitizedSearch
				);
			});

			console.log(`Found ${manuallyFiltered.length} users through manual filtering`);

			const filteredResults = manuallyFiltered.map((user) => ({
				id: user.id,
				email: user.email,
				name: user.name,
				username: user.username,
				avatar: user.avatar,
				collectionId: user.collectionId
			}));

			return json(filteredResults, { status: 200 });
		}

		// No matches found
		console.log('No matches found for search term:', sanitizedSearch);
		return json([], { status: 200 });
	} catch (err) {
		console.error('Error searching users:', err);
		return json(
			{
				error: 'Failed to search users',
				message: err instanceof Error ? err.message : String(err)
			},
			{ status: 500 }
		);
	}
};
