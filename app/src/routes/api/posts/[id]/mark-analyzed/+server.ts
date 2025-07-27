// src/routes/api/posts/[id]/mark-analyzed/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import { error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, cookies }) =>
	apiTryCatch(async () => {
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw error(401, 'Authentication required');

		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch {
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) throw error(401, 'Invalid authentication');

		console.log('✅ Marking post as analyzed:', params.id);

		// Update the post to mark it as analyzed
		const updateResult = await pbTryCatch(
			pb.collection('posts').update(params.id, {
				analyzed: true,
				analyzed_at: new Date().toISOString()
			}),
			'mark post as analyzed'
		);
		const updatedPost = unwrap(updateResult);

		console.log('✅ Post marked as analyzed successfully:', params.id);

		return { success: true, post: updatedPost };
	}, 'Marking post as analyzed');