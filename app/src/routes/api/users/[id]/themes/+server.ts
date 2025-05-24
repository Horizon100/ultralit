import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const AVAILABLE_THEMES = [
	'default',
	'dark',
	'light',
	'sunset',
	'focus',
	'bold',
	'turbo',
	'bone',
	'ivoryx'
];

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || params.id !== locals.user.id) {
		throw error(403, 'Forbidden');
	}

	try {
		const user = await pb.collection('users').getOne(params.id);
		const theme = user.theme_preference || 'default';

		// Validate theme exists in your SCSS
		if (!AVAILABLE_THEMES.includes(theme)) {
			console.warn(`Invalid theme ${theme}, using default`);
			return json({
				success: true,
				theme: 'default',
				availableThemes: AVAILABLE_THEMES
			});
		}

		return json({
			success: true,
			theme: theme,
			availableThemes: AVAILABLE_THEMES
		});
	} catch (err) {
		console.error('Theme GET error:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to fetch theme';
		throw error(400, errorMessage);
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || params.id !== locals.user.id) {
		throw error(403, 'Forbidden');
	}

	try {
		const { theme } = await request.json();

		// Validate theme exists in your SCSS
		if (!AVAILABLE_THEMES.includes(theme)) {
			throw error(400, `Invalid theme: ${theme}. Available themes: ${AVAILABLE_THEMES.join(', ')}`);
		}

		const updated = await pb.collection('users').update(params.id, {
			theme_preference: theme
		});

		return json({
			success: true,
			theme: updated.theme_preference
		});
	} catch (err) {
		console.error('Theme PATCH error:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to update theme';
		throw error(400, errorMessage);
	}
};
