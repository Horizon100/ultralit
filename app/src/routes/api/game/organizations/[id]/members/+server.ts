import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { heroId } = await request.json();
		const organizationId = params.id;

		if (!heroId) {
			return json({ error: 'Hero ID is required' }, { status: 400 });
		}

		console.log('[ORG_MEMBERS] Adding hero to organization:', { heroId, organizationId });

		// Get current organization
		const organization = await locals.pb.collection('game_organizations').getOne(organizationId);
		
		// Check if hero is already a member
		const currentMembers = organization.members || [];
		if (currentMembers.includes(heroId)) {
			return json({ error: 'Hero is already a member' }, { status: 400 });
		}

		// Add hero to members array
		const updatedMembers = [...currentMembers, heroId];
		
		// Update organization
		const updatedOrganization = await locals.pb.collection('game_organizations').update(organizationId, {
			members: updatedMembers
		});

		// Update the hero's currentOrganization
		await locals.pb.collection('game_heroes').update(heroId, {
			currentOrganization: organizationId
		});

		console.log('[ORG_MEMBERS] Hero added successfully');

		return json({
			success: true,
			data: updatedOrganization
		});
	} catch (createError) {
		const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
		
		console.error('Add Member error:', {
			message: errorMessage,
			error: createError
		});
		
		return json({ 
			error: 'Failed to add members',
			details: errorMessage
		}, { status: 500 });
	}
};