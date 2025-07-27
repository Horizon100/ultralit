// src/routes/api/users/[id]/avatar/+server.ts
import { pb } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';
import { generateUserIdenticon, getUserIdentifier } from '$lib/utils/identiconUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const userId = params.id;
	const timestamp = url.searchParams.get('t'); // Support cache busting

	try {
		// Fetch the user
		const user = await pb.collection('users').getOne(userId);

		if (!user || !user.avatar || user.avatar === 'uploaded' || user.avatar === '') {
			// Generate identicon as fallback
			const identicon = generateUserIdenticon(getUserIdentifier(user), 120);
			
			return new Response(identicon, {
				headers: {
					'Content-Type': 'image/svg+xml',
					'Cache-Control': 'public, max-age=3600',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		// Get the avatar file URL
		let avatarUrl = pb.files.getUrl(user, user.avatar);
		
		// Add timestamp for cache busting if provided
		if (timestamp) {
			avatarUrl = `${avatarUrl}?t=${timestamp}`;
		}

		// Return redirect to the actual avatar file
		return new Response(null, {
			status: 302,
			headers: {
				Location: avatarUrl,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err) {
		console.error('Error fetching user avatar:', err);
		
		// Generate identicon for unknown/error users
		const identicon = generateUserIdenticon(userId, 120);
		return new Response(identicon, {
			headers: {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'public, max-age=300'
			}
		});
	}
};