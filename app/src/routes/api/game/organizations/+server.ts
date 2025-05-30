import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const isPublic = url.searchParams.get('public') !== 'false';
		const filter = isPublic ? 'isActive = true && isPublic = true' : 'isActive = true';

		const organizations = await locals.pb.collection('game_organizations').getFullList({
			filter,
			sort: 'created'
		});

		return json({
			success: true,
			data: organizations
		});
	} catch (error) {
		console.error('Organizations fetch error:', error);
		return json({ error: 'Failed to fetch organizations' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const userId = locals.pb.authStore.model?.id;
		if (!userId) {
			return json({ error: 'User ID not found' }, { status: 401 });
		}

		const data = await request.json();

		// First, get the user's hero
		let userHero;
		try {
			const heroes = await locals.pb.collection('game_heroes').getFullList({
				filter: `user = "${userId}"`
			});
			userHero = heroes[0];
		} catch (heroError) {
			console.error('Failed to get user hero:', heroError);
			return json({ 
				error: 'Hero not found. Create a hero first.',
				details: 'You need a hero to create an organization'
			}, { status: 400 });
		}

		if (!userHero) {
			return json({ 
				error: 'Hero not found. Create a hero first.',
				details: 'You need a hero to create an organization'
			}, { status: 400 });
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

		return json({
			success: true,
			data: organization
		});


	} catch (createError) {
		const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
		
		console.error('Organization creation error details:', {
			message: errorMessage,
			error: createError
		});
		
		return json({ 
			error: 'Failed to create organization',
			details: errorMessage
		}, { status: 500 });
	}
};