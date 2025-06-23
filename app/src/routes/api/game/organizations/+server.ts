import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.pb.authStore.isValid) {
		return new Response(
			JSON.stringify({ error: 'Unauthorized' }),
			{ status: 401, headers: { 'Content-Type': 'application/json' } }
		);
	}

	return apiTryCatch(
		async () => {
			const isPublic = url.searchParams.get('public') !== 'false';
			const filter = isPublic ? 'isActive = true && isPublic = true' : 'isActive = true';

			const organizations = await locals.pb.collection('game_organizations').getFullList({
				filter,
				sort: 'created'
			});

			return organizations;
		},
		'Failed to fetch organizations',
		500
	);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.pb.authStore.isValid) {
		return new Response(
			JSON.stringify({ error: 'Unauthorized' }),
			{ status: 401, headers: { 'Content-Type': 'application/json' } }
		);
	}

	return apiTryCatch(
		async () => {
			const userId = locals.pb.authStore.model?.id;
			if (!userId) {
				throw new Error('User ID not found');
			}

			const data = await request.json();

			// Get the user's hero
			const heroes = await locals.pb.collection('game_heroes').getFullList({
				filter: `user = "${userId}"`
			});
			const userHero = heroes[0];

			if (!userHero) {
				throw new Error('Hero not found. Create a hero first.');
			}

			const orgData = {
				name: data.name,
				description: data.description || '',
				createdBy: userId,
				isPublic: data.isPublic || false,
				isActive: true,
				members: [userHero.id]
			};

			const organization = await locals.pb.collection('game_organizations').create(orgData);

			console.log('Organization created successfully with hero member:', {
				orgId: organization.id,
				heroId: userHero.id,
				userId: userId
			});

			return organization;
		},
		'Failed to create organization',
		500
	);
};
