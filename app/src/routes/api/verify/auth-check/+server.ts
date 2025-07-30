import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, tryCatchSync, pbTryCatch, isFailure } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ cookies }) => {
	return apiTryCatch(
		async () => {
			// Restore auth from cookie if available
			const authCookie = cookies.get('pb_auth');
			if (authCookie) {
				const parseResult = tryCatchSync(() => {
					const authData = JSON.parse(authCookie);
					pb.authStore.save(authData.token, authData.model);
					return authData;
				});

				if (isFailure(parseResult)) {
					console.error('Error parsing auth cookie:', parseResult.error);
				}
			}

			// Refresh auth if needed
			if (pb.authStore.isValid) {
				const refreshResult = await pbTryCatch(
					pb.collection('users').authRefresh(),
					'auth refresh'
				);

				if (isFailure(refreshResult)) {
					pb.authStore.clear();
					throw new Error('Authentication expired');
				}
			}

			if (!pb.authStore.isValid) {
				throw new Error('Not authenticated');
			}

			// Return sanitized user data
			return {
				success: true,
				user: {
					id: pb.authStore.model?.id,
					email: pb.authStore.model?.email,
					username: pb.authStore.model?.username,
					name: pb.authStore.model?.name,
					avatar: pb.authStore.model?.avatar,
					role: pb.authStore.model?.role,
					verified: pb.authStore.model?.verified,
					status: pb.authStore.model?.status,
					created: pb.authStore.model?.created,
					updated: pb.authStore.model?.updated
				}
			};
		},
		'Authentication check failed',
		401
	);
};
