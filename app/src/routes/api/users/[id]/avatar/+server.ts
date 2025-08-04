// src/routes/api/users/[id]/avatar/+server.ts
import { pb } from '$lib/server/pocketbase';
import { generateUserIdenticon, getUserIdentifier } from '$lib/utils/identiconUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const userId = params.id;
	const timestamp = url.searchParams.get('t');

	console.log(`🖼️ Avatar API called for user: ${userId}`);

	try {
		// Fetch the user
		const user = await pb.collection('users').getOne(userId);
		console.log(`👤 User found:`, { 
			id: user.id, 
			avatar: user.avatar, 
			username: user.username 
		});

		if (!user || !user.avatar || user.avatar === 'uploaded' || user.avatar === '') {
			console.log(`🎭 No avatar found, generating identicon`);
			
			const identicon = generateUserIdenticon(getUserIdentifier(user || { id: userId }), 120);
			return new Response(identicon, {
				headers: {
					'Content-Type': 'image/svg+xml',
					'Cache-Control': 'public, max-age=3600',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		// Get the avatar file URL
		const avatarUrl = pb.files.getUrl(user, user.avatar);
		console.log(`🔗 Fetching from PocketBase: ${avatarUrl}`);

		// IMPORTANT: Fetch the image and return the data directly (NO REDIRECT)
		try {
			const response = await fetch(avatarUrl);
			console.log(`📊 PocketBase response: ${response.status}`);

			if (!response.ok) {
				throw new Error(`PocketBase fetch failed: ${response.status}`);
			}

			// Get the image as ArrayBuffer
			const imageBuffer = await response.arrayBuffer();
			const contentType = response.headers.get('content-type') || 'image/jpeg';
			
			console.log(`✅ Successfully proxied avatar (${imageBuffer.byteLength} bytes, ${contentType})`);

			// Return the actual image data
			return new Response(imageBuffer, {
				headers: {
					'Content-Type': contentType,
					'Cache-Control': 'public, max-age=3600',
					'Access-Control-Allow-Origin': '*'
				}
			});

		} catch (fetchError) {
			console.error(`❌ Failed to fetch from PocketBase:`, fetchError);
			
			// Return identicon as fallback
			const identicon = generateUserIdenticon(getUserIdentifier(user), 120);
			return new Response(identicon, {
				headers: {
					'Content-Type': 'image/svg+xml',
					'Cache-Control': 'public, max-age=300',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

	} catch (err) {
		console.error(`💥 Avatar API error:`, err);

		// Generate identicon for unknown/error users
		const identicon = generateUserIdenticon(userId, 120);
		return new Response(identicon, {
			headers: {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'public, max-age=300',
				'Access-Control-Allow-Origin': '*'
			}
		});
	}
};