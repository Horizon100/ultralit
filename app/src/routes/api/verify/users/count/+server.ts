import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		// Fetch total user count
		const resultList = await pbServer.pb.collection('users').getList(1, 1, {
			sort: '-created'
		});

		const count = resultList.totalItems;

		return json({
			success: true,
			count
		});
	} catch (error) {
		console.error('Error fetching user count:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to get user count'
			},
			{ status: 500 }
		);
	}
};
