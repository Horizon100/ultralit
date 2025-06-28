// src/routes/api/users/[id]/wallpaper/+server.ts

import { pb } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, fileTryCatch, validationTryCatch } from '$lib/utils/errorUtils';

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
			'fetch user for wallpaper update'
		);

		if (!userResult.success) {
			throw error(404, 'User not found');
		}

		// Parse form data with validation
		const formDataResult = await fileTryCatch(request.formData(), 'wallpaper-upload');

		if (!formDataResult.success) {
			throw error(400, formDataResult.error);
		}

		const formData = formDataResult.data;
		const file = formData.get('profileWallpaper') as File;

		// Validate file presence
		const fileValidation = validationTryCatch(() => {
			if (!file) {
				throw new Error('No file provided');
			}
			return file;
		}, 'profileWallpaper');

		if (!fileValidation.success) {
			throw error(400, fileValidation.error);
		}

		// Validate file constraints
		const constraintValidation = validationTryCatch(() => {
			const maxSize = 5 * 1024 * 1024; // 5MB
			const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

			if (file.size > maxSize) {
				throw new Error('File size must be less than 5MB');
			}

			if (!allowedTypes.includes(file.type)) {
				throw new Error('Invalid file type. Please upload JPEG, PNG, or WebP images');
			}

			return true;
		}, 'file-constraints');

		if (!constraintValidation.success) {
			throw error(400, constraintValidation.error);
		}

		// Update user with new wallpaper using fileTryCatch
		const updateResult = await fileTryCatch(
			(async () => {
				const updateData = new FormData();
				updateData.append('profileWallpaper', file);
				return pb.collection('users').update(userId, updateData);
			})(),
			file.name,
			5 // max size in MB
		);

		if (!updateResult.success) {
			throw error(500, updateResult.error);
		}

		return {
			user: updateResult.data
		};
	}, 'Failed to upload wallpaper');
};
