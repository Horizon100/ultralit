import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import type { User } from '$lib/types/types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params }) =>
	apiTryCatch(
		async () => {
			if (!params.id) {
				throw new Error('User ID is required');
			}

			const userResult = await pbTryCatch(
				pb.collection('users').getOne<User>(params.id, { expand: 'verification' }),
				'fetch user'
			);
			const user = unwrap(userResult);

			// Return the user data directly - don't sanitize away important fields
			return { 
				success: true, 
				data: { 
					user: user  // This matches the structure your model store expects
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
				throw new Error('Authentication required');
			}

			if (params.id !== locals.user.id) {
				throw new Error('You can only update your own user data');
			}

			const contentType = request.headers.get('content-type') || '';
			const updateData: Partial<User> & { updated: string } = {
				updated: new Date().toISOString()
			};

			if (contentType.includes('multipart/form-data')) {
				const formData = await request.formData();
				const MAX_FILE_SIZE = 2 * 1024 * 1024;

				for (const [key, value] of formData.entries()) {
					if (value instanceof File) {
						if (value.size > MAX_FILE_SIZE && key === 'avatar') {
							throw new Error('Avatar file size exceeds 2MB limit');
						}
						(updateData as any)[key] = value;
					} else {
						(updateData as any)[key] = value;
					}
				}
			} else {
				const data = await request.json();

				// Use a more permissive approach - update any field that exists in the User type
				const allowedFields = [
					'name', 'username', 'description', 'email', 'model', 'selected_provider',
					'theme_preference', 'wallpaper_preference', 'profileWallpaper', 'prompt_preference',
					'sysprompt_preference', 'model_preference', 'taskAssignments', 'userTaskStatus'
				];

				for (const field of allowedFields) {
					if (field in data) {
						(updateData as any)[field] = data[field];
					}
				}
			}

			const updatedResult = await pbTryCatch(
				pb.collection('users').update<User>(params.id, updateData),
				'update user'
			);
			const updated = unwrap(updatedResult);

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