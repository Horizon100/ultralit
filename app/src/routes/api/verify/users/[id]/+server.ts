//src/routes/api/verify/users/[id]/+server.ts

import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import type { User } from '$lib/types/types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(
		async () => {
			if (!params.id) {
				throw new Error('User ID is required');
			}

			console.log('🔍 GET /api/verify/users/[id] - Fetching user:', params.id);
			console.log('🔍 PocketBase URL:', pb.baseUrl);
			console.log('🔍 Auth token exists:', !!pb.authStore.token);

			// Test PocketBase connection first
			try {
				await pb.health.check();
				console.log('✅ PocketBase health check passed');
			} catch (healthError) {
				console.error('❌ PocketBase health check failed:', healthError);
				throw new Error('Database connection failed');
			}

			// Simple fetch without expand first
			const userResult = await pbTryCatch(
				pb.collection('users').getOne<User>(params.id),
				'fetch user'
			);
			const user = unwrap(userResult);

			console.log('✅ User fetched successfully:', user.id);

			return {
				success: true,
				data: {
					user: user
				}
			};
		},
		'Failed to fetch user data',
		400
	);

export const PATCH: RequestHandler = async ({ params, request, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user?.id) {
				console.error('❌ No authenticated user in locals');
				throw new Error('Authentication required');
			}

			if (params.id !== locals.user.id) {
				console.error('❌ User ID mismatch:', {
					requestedId: params.id,
					userIdFromLocals: locals.user.id
				});
				throw new Error('You can only update your own user data');
			}

			console.log('🔄 Starting user update for ID:', params.id);

			const contentType = request.headers.get('content-type') || '';
			const updateData: Partial<User> & { updated: string } = {
				updated: new Date().toISOString()
			};

			if (contentType.includes('multipart/form-data')) {
				console.log('📁 Processing multipart form data');
				const formData = await request.formData();
				const MAX_FILE_SIZE = 2 * 1024 * 1024;

				for (const [key, value] of formData.entries()) {
					if (value instanceof File) {
						if (value.size > MAX_FILE_SIZE && key === 'avatar') {
							throw new Error('Avatar file size exceeds 2MB limit');
						}
						console.log(`📄 Adding file field ${key}:`, { size: value.size, type: value.type });
						(updateData as User)[key] = value;
					} else {
						console.log(`📝 Adding form field ${key}:`, value);
						(updateData as User)[key] = value;
					}
				}
			} else {
				console.log('📊 Processing JSON data');
				const data = await request.json();

				// Enhanced allowedFields list with local model support
				const allowedFields = [
					'name',
					'username',
					'role',
					'description',
					'email',
					'model', // For cloud provider models
					'selected_provider',
					'theme_preference',
					'wallpaper_preference',
					'profileWallpaper',
					'prompt_preference',
					'sysprompt_preference',
					'model_preference', // For favorite cloud models
					'taskAssignments',
					'userTaskStatus',
					// Local model support fields
					'local_model_preference', // Selected local model ID
					'local_model_favorites' // Array of favorite local model IDs
				];

				// Log the update request for debugging
				console.log('📝 User update request:', {
					userId: params.id,
					fields: Object.keys(data),
					hasLocalModelData: !!(data.local_model_preference || data.local_model_favorites)
				});

				for (const field of allowedFields) {
					if (field in data) {
						// Special handling for local model fields
						if (field === 'local_model_preference') {
							console.log(`🏠 Setting local model preference: ${data[field]}`);
						}
						if (field === 'local_model_favorites') {
							console.log(`⭐ Setting local model favorites:`, data[field]);
						}

						(updateData as User)[field] = data[field];
					}
				}

				// Validation for local model fields
				if ('local_model_preference' in data && data.local_model_preference !== null) {
					if (typeof data.local_model_preference !== 'string') {
						throw new Error('local_model_preference must be a string');
					}
				}

				if ('local_model_favorites' in data && data.local_model_favorites !== null) {
					if (!Array.isArray(data.local_model_favorites)) {
						throw new Error('local_model_favorites must be an array');
					}
					// Validate all items are strings
					if (!data.local_model_favorites.every((item: any) => typeof item === 'string')) {
						throw new Error('All items in local_model_favorites must be strings');
					}
				}

				// Remove any undefined values to avoid PocketBase issues
				Object.keys(updateData).forEach((key) => {
					if (updateData[key as keyof typeof updateData] === undefined) {
						delete updateData[key as keyof typeof updateData];
					}
				});
			}

			console.log('🔄 Updating user with data:', {
				...updateData,
				// Don't log sensitive data, just indicate presence
				hasLocalModelPref: !!updateData.local_model_preference,
				localFavoritesCount: updateData.local_model_favorites?.length || 0
			});

			// Verify user exists before updating
			const userExistsResult = await pbTryCatch(
				pb.collection('users').getOne(params.id),
				'verify user exists'
			);

			if (!userExistsResult.success) {
				console.error('❌ User does not exist:', params.id);
				throw new Error('User not found');
			}

			const updatedResult = await pbTryCatch(
				pb.collection('users').update<User>(params.id, updateData),
				'update user'
			);
			const updated = unwrap(updatedResult);

			console.log('✅ User updated successfully:', {
				userId: updated.id,
				selectedProvider: updated.selected_provider,
				hasLocalModelPref: !!updated.local_model_preference,
				localFavoritesCount: updated.local_model_favorites?.length || 0
			});

			return {
				success: true,
				data: {
					user: updated
				}
			};
		},
		'Update failed',
		400
	);
