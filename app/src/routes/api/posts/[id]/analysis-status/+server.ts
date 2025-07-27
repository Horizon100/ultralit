// src/routes/api/posts/[id]/analysis-status/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, cookies }) =>
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

		console.log('🔍 Checking analysis status for post:', params.id);

		// Get the post to check if it has an analyzed field or agent replies
		const postResult = await pbTryCatch(
			pb.collection('posts').getOne(params.id),
			'fetch post for analysis check'
		);
		const post = unwrap(postResult);

		// Check if post has been analyzed (you might need to add this field to your posts collection)
		let analyzed = post.analyzed || false;

		// Alternative: Check if there are agent replies (comments from agents)
		if (!analyzed) {
			const agentRepliesResult = await pbTryCatch(
				pb.collection('posts').getList(1, 1, {
					filter: `parent = "${params.id}" && type = "agent_reply"`
				}),
				'check for agent replies'
			);
			const agentReplies = unwrap(agentRepliesResult);
			analyzed = agentReplies.totalItems > 0;
		}

		console.log('📊 Analysis status:', { postId: params.id, analyzed });

		return { analyzed };
	}, 'Checking post analysis status');