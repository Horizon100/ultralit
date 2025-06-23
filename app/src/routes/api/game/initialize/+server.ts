import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.pb.authStore.isValid) {
		throw error(401, 'Unauthorized');
	}

	try {
		const userId = locals.pb.authStore.model?.id;
		if (!userId) throw error(401, 'User not found');

		// Get organization data from request body
		const body = await request.json();
		const { name, description } = body;

		// First, get the user's hero
		let userHero;
		try {
			const heroes = await locals.pb.collection('game_heroes').getFullList({
				filter: `user = "${userId}"`
			});
			userHero = heroes[0];
		} catch (heroError) {
			console.error('Failed to get user hero:', heroError);
			return json(
				{
					error: 'Hero not found. Create a hero first.',
					details: 'You need a hero to create an organization'
				},
				{ status: 400 }
			);
		}

		if (!userHero) {
			return json(
				{
					error: 'Hero not found. Create a hero first.',
					details: 'You need a hero to create an organization'
				},
				{ status: 400 }
			);
		}

		const pb = locals.pb;
		console.log('[INIT] Creating new organization for user:', userId, 'with hero:', userHero.id);
		function generateGuildName(): string {
			const prefixes = [
				'Silver',
				'Golden',
				'Shadow',
				'Storm',
				'Iron',
				'Crystal',
				'Fire',
				'Frost',
				'Noble',
				'Ancient'
			];
			const suffixes = [
				'Guild',
				'Alliance',
				'Brotherhood',
				'Order',
				'Legion',
				'Covenant',
				'House',
				'Company'
			];

			const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
			const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

			return `${prefix} ${suffix}`;
		}
		// Create new organization with hero as member
		const newOrg = await pb.collection('game_organizations').create({
			name: name || generateGuildName(),
			description: description || 'Add description',
			createdBy: userId,
			isPublic: true,
			isActive: true,
			members: [userHero.id]
		});
		console.log('[INIT] New organization created:', newOrg.id, 'with hero member:', userHero.id);

		return json({
			success: true,
			message: 'Organization created successfully',
			data: { organization: newOrg }
		});
	} catch (createError) {
		const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';

		console.error('[INIT] Create error:', {
			message: errorMessage,
			error: createError
		});

		return json(
			{
				error: 'Failed to create organization',
				details: errorMessage
			},
			{ status: 500 }
		);
	}
};
