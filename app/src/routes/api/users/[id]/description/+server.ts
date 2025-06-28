// src/routes/api/users/[id]/description/+server.ts

import { pb } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, validationTryCatch } from '$lib/utils/errorUtils';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	return apiTryCatch(async () => {
		const userId = params.id;

		// Check authentication
		if (!locals.user || locals.user.id !== userId) {
			throw error(403, 'Unauthorized');
		}

		// Verify user exists using pbTryCatch
		const userResult = await pbTryCatch(
			pb.collection('users').getOne(userId),
			'fetch user for description update'
		);

		if (!userResult.success) {
			throw error(404, 'User not found');
		}

		// Parse and validate request body
		const bodyResult = await pbTryCatch(request.json(), 'parse request body');

		if (!bodyResult.success) {
			throw error(400, 'Invalid request body');
		}

		const { description } = bodyResult.data;

		// Validate description using validationTryCatch
		const descriptionValidation = validationTryCatch(() => {
			if (typeof description !== 'string') {
				throw new Error('Description must be a string');
			}

			const trimmedDescription = description.trim();

			// Check length (max 160 characters)
			if (trimmedDescription.length > 160) {
				throw new Error('Description must be 160 characters or less');
			}

			return trimmedDescription;
		}, 'description');

		if (!descriptionValidation.success) {
			throw error(400, descriptionValidation.error);
		}

		const trimmedDescription = descriptionValidation.data;

		// Update user description using pbTryCatch
		const updateResult = await pbTryCatch(
			pb.collection('users').update(userId, {
				description: trimmedDescription
			}),
			'update user description'
		);

		if (!updateResult.success) {
			throw error(500, updateResult.error);
		}

		return {
			user: updateResult.data
		};
	}, 'Failed to update description');
};
