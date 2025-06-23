// src/routes/api/users/[id]/wallpapers/+server.ts

import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	AVAILABLE_WALLPAPERS,
	DEFAULT_WALLPAPER,
	isValidWallpaper,
	parseWallpaperPreference,
	stringifyWallpaperPreference
} from '$lib/utils/wallpapers';
import type { WallpaperPreference } from '$lib/utils/wallpapers';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || params.id !== locals.user.id) {
		throw error(403, 'Forbidden');
	}

	try {
		const user = await pb.collection('users').getOne(params.id);
		const preference = parseWallpaperPreference(user.wallpaper_preference);

		// Validate wallpaper exists if one is selected
		if (preference.wallpaperId && !isValidWallpaper(preference.wallpaperId)) {
			console.warn(`Invalid wallpaper ${preference.wallpaperId}, resetting to default`);
			const defaultPreference: WallpaperPreference = {
				wallpaperId: DEFAULT_WALLPAPER,
				isActive: false
			};
			return json({
				success: true,
				preference: defaultPreference,
				availableWallpapers: AVAILABLE_WALLPAPERS
			});
		}

		return json({
			success: true,
			preference,
			availableWallpapers: AVAILABLE_WALLPAPERS
		});
	} catch (err) {
		console.error('Wallpaper GET error:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to fetch wallpaper';
		throw error(400, errorMessage);
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || params.id !== locals.user.id) {
		console.log('Authorization failed:', {
			hasUser: !!locals.user,
			requestedId: params.id,
			userId: locals.user?.id
		});
		throw error(403, 'Forbidden');
	}

	try {
		const requestData = await request.json();
		console.log('Wallpaper PATCH request data:', requestData);
		console.log(
			'Available wallpapers:',
			AVAILABLE_WALLPAPERS.length,
			AVAILABLE_WALLPAPERS.map((w) => w.id)
		);

		const { wallpaperId, isActive } = requestData;

		// Create preference object
		const preference: WallpaperPreference = {
			wallpaperId: wallpaperId || null,
			isActive: isActive ?? false
		};

		console.log('Created preference:', preference);

		// Only validate wallpaper if it's active and has an ID
		if (preference.isActive && preference.wallpaperId) {
			if (AVAILABLE_WALLPAPERS.length === 0) {
				console.warn('No wallpapers available in the system');
				throw error(
					400,
					'No wallpapers are available. Please add wallpaper images to src/lib/assets/wallpapers/'
				);
			}

			if (!isValidWallpaper(preference.wallpaperId)) {
				const availableIds = AVAILABLE_WALLPAPERS.map((w) => w.id).join(', ');
				console.error(`Invalid wallpaper: ${preference.wallpaperId}. Available: ${availableIds}`);
				throw error(
					400,
					`Invalid wallpaper: ${preference.wallpaperId}. Available wallpapers: ${availableIds}`
				);
			}
		}

		// If disabling wallpapers, we don't need to validate the wallpaper ID
		if (!preference.isActive) {
			console.log('Disabling wallpapers, no validation needed');
		}

		console.log('Updating user with preference:', stringifyWallpaperPreference(preference));

		const updated = await pb.collection('users').update(params.id, {
			wallpaper_preference: stringifyWallpaperPreference(preference)
		});

		console.log('Update successful, returning preference');

		const finalPreference = parseWallpaperPreference(updated.wallpaper_preference);

		return json({
			success: true,
			preference: finalPreference
		});
	} catch (err) {
		console.error('Wallpaper PATCH error:', err);

		// If it's already an error object from SvelteKit, re-throw it
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		// Handle PocketBase errors
		if (err && typeof err === 'object' && 'data' in err) {
			console.error('PocketBase error details:', err.data);
			throw error(400, 'Database error: Failed to update user preferences');
		}

		const errorMessage = err instanceof Error ? err.message : 'Failed to update wallpaper';
		throw error(500, errorMessage);
	}
};
