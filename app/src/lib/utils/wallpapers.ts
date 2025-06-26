// src/lib/utils/wallpapers.ts

import type { User } from '$lib/types/types';

// Auto-import all images from wallpapers folder
const wallpaperModules = import.meta.glob('$lib/assets/wallpapers/*.{png,jpg,jpeg,webp}', {
	eager: true,
	import: 'default'
}) as Record<string, string>;

console.log('Wallpaper modules found:', Object.keys(wallpaperModules));

export interface Wallpaper {
	id: string;
	name: string;
	src: string;
	category?: string;
	description?: string;
}

export interface WallpaperPreference {
	wallpaperId: string | null;
	isActive: boolean;
}

// Type for array format: [wallpaperId, isActive]
export type WallpaperPreferenceArray = [string | null, boolean];

// Convert imported modules to wallpaper objects
const autoWallpapers: Wallpaper[] = Object.entries(wallpaperModules).map(([path, src]) => {
	// Extract filename without extension from path
	const filename =
		path
			.split('/')
			.pop()
			?.replace(/\.[^/.]+$/, '') || '';

	// Generate a readable name (capitalize and replace underscores/hyphens with spaces)
	const name = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

	// Auto-categorize based on filename patterns (you can customize this)
	let category = 'general';
	if (filename.includes('nature') || filename.includes('landscape')) category = 'nature';
	if (filename.includes('abstract') || filename.includes('pattern')) category = 'abstract';
	if (filename.includes('minimal') || filename.includes('clean')) category = 'minimal';
	if (filename.includes('dark') || filename.includes('night')) category = 'dark';
	if (filename.includes('light') || filename.includes('bright')) category = 'light';
	if (
		filename.includes('aristotle') ||
		filename.includes('einstein') ||
		filename.includes('philosopher')
	)
		category = 'scholars';

	// console.log(`Creating wallpaper: ${filename} -> ${name} (${category})`);

	return {
		id: filename,
		name,
		src: src as string,
		category,
		description: `${name} wallpaper`
	};
});

// Use only auto-imported wallpapers (no manual ones)
export const AVAILABLE_WALLPAPERS: Wallpaper[] = autoWallpapers;

console.log(
	'Available wallpapers:',
	AVAILABLE_WALLPAPERS.length,
	AVAILABLE_WALLPAPERS.map((w) => w.id)
);

// Default to first available wallpaper or null if none
export const DEFAULT_WALLPAPER = autoWallpapers.length > 0 ? autoWallpapers[0].id : null;

/**
 * Parse wallpaper preference from User.wallpaper_preference (string[] or string) or other formats
 */
export function parseWallpaperPreference(
	preference: string | string[] | WallpaperPreference | WallpaperPreferenceArray | undefined
): WallpaperPreference {
	console.log('parseWallpaperPreference called with:', preference, 'type:', typeof preference);

	// Handle null, undefined, or empty string - return default with first wallpaper if available
	if (!preference || preference === '' || preference === 'undefined' || preference === 'null') {
		console.log('No/empty preference provided, returning default with first wallpaper');
		const defaultPreference = {
			wallpaperId: DEFAULT_WALLPAPER,
			isActive: DEFAULT_WALLPAPER !== null // Only activate if we have wallpapers
		};
		console.log('Default preference:', defaultPreference);
		return defaultPreference;
	}

	// Handle string[] format (from User.wallpaper_preference)
	if (Array.isArray(preference)) {
		console.log('Preference is array, checking format...');

		// If it's a WallpaperPreferenceArray [wallpaperId, isActive]
		if (
			preference.length === 2 &&
			(typeof preference[1] === 'boolean' || preference[1] === 'true' || preference[1] === 'false')
		) {
			console.log('Preference is WallpaperPreferenceArray, parsing...');
			const [wallpaperId, isActive] = preference;
			const result = {
				wallpaperId: wallpaperId || null,
				isActive: typeof isActive === 'boolean' ? isActive : isActive === 'true'
			};
			console.log('WallpaperPreferenceArray converted to:', result);
			return result;
		}

		// If it's a string[] (User.wallpaper_preference), take the first item as JSON or wallpaper ID
		if (preference.length > 0 && typeof preference[0] === 'string') {
			console.log('Preference is string[], using first item:', preference[0]);
			return parseWallpaperPreference(preference[0]);
		}

		// Empty array - return default
		console.log('Empty array, returning default');
		const defaultPreference = {
			wallpaperId: DEFAULT_WALLPAPER,
			isActive: DEFAULT_WALLPAPER !== null
		};
		console.log('Default preference for empty array:', defaultPreference);
		return defaultPreference;
	}

	// If it's a string (from User.wallpaper_preference), convert to new format
	if (typeof preference === 'string') {
		console.log('Preference is string, attempting to parse...');

		// Handle special legacy values
		if (preference === 'none' || preference === 'false') {
			console.log('Legacy "none" or "false" value, disabling wallpapers');
			return { wallpaperId: null, isActive: false };
		}

		try {
			// Try to parse as JSON first
			const parsed = JSON.parse(preference);
			console.log('JSON parsed result:', parsed);

			// Check if it's an array format
			if (Array.isArray(parsed)) {
				const [wallpaperId, isActive] = parsed;
				const result = {
					wallpaperId: wallpaperId || null,
					isActive: isActive ?? false
				};
				console.log('JSON array converted to:', result);
				return result;
			}

			// Check if it's an object format
			if (
				parsed &&
				typeof parsed === 'object' &&
				('wallpaperId' in parsed || 'isActive' in parsed)
			) {
				const result = {
					wallpaperId: parsed.wallpaperId || null,
					isActive: parsed.isActive ?? false
				};
				console.log('Valid JSON object found, returning:', result);
				return result;
			}
		} catch (err) {
			console.log('JSON parse failed, treating as legacy wallpaper ID string:', err);
		}

		/*
		 * If JSON parse fails, treat as wallpaper ID string (legacy)
		 * Validate that the wallpaper ID actually exists
		 */
		const isValidId = isValidWallpaper(preference);
		const result = {
			wallpaperId: isValidId ? preference : DEFAULT_WALLPAPER,
			isActive: isValidId || DEFAULT_WALLPAPER !== null
		};
		console.log('Legacy string converted to:', result);
		return result;
	}

	// If it's already an object, validate and return
	if (preference && typeof preference === 'object') {
		console.log('Preference is object, validating...');
		const result = {
			wallpaperId: preference.wallpaperId || null,
			isActive: preference.isActive ?? false
		};
		console.log('Object validated and returned:', result);
		return result;
	}

	// Fallback to default
	console.log('Unhandled preference type, returning default');
	return {
		wallpaperId: DEFAULT_WALLPAPER,
		isActive: DEFAULT_WALLPAPER !== null
	};
}

/**
 * Parse wallpaper preference directly from User object
 */
export function parseUserWallpaperPreference(
	user: User | Partial<User> | null
): WallpaperPreference {
	console.log(
		'parseUserWallpaperPreference called with user:',
		user?.id,
		'wallpaper_preference:',
		user?.wallpaper_preference
	);

	if (!user) {
		console.log('No user provided, returning default');
		return {
			wallpaperId: DEFAULT_WALLPAPER,
			isActive: DEFAULT_WALLPAPER !== null
		};
	}

	// Handle both string[] and string formats
	const preference = user.wallpaper_preference;
	if (Array.isArray(preference)) {
		// If it's string[], use the first item or return default
		return parseWallpaperPreference(preference.length > 0 ? preference[0] : undefined);
	}

	return parseWallpaperPreference(preference);
}

/**
 * Convert wallpaper preference to string for storage (supports both object and array formats)
 */
export function stringifyWallpaperPreference(
	preference: WallpaperPreference,
	useArrayFormat = false
): string {
	if (useArrayFormat) {
		// Store as array: [wallpaperId, isActive]
		return JSON.stringify([preference.wallpaperId, preference.isActive]);
	} else {
		// Store as object: {wallpaperId: "...", isActive: true}
		return JSON.stringify(preference);
	}
}

/**
 * Get wallpaper by ID
 */
export function getWallpaperById(id: string): Wallpaper | null {
	return AVAILABLE_WALLPAPERS.find((w) => w.id === id) || null;
}

/**
 * Get wallpaper source by preference, with fallback handling
 */
export function getWallpaperSrc(
	preference: string | string[] | WallpaperPreference | User
): string | null {
	console.log('getWallpaperSrc called with:', preference);

	let parsed: WallpaperPreference;

	// If it's a User object, extract wallpaper_preference
	if (preference && typeof preference === 'object' && 'wallpaper_preference' in preference) {
		console.log('Input is User object, extracting wallpaper_preference');
		parsed = parseUserWallpaperPreference(preference as User);
	} else {
		parsed = parseWallpaperPreference(preference as string | WallpaperPreference);
	}

	console.log('Parsed preference:', parsed);

	// If wallpapers are disabled, return null
	if (!parsed.isActive) {
		console.log('Wallpapers are disabled, returning null');
		return null;
	}

	if (!parsed.wallpaperId) {
		console.log('No wallpaper ID specified, returning null');
		return null;
	}

	console.log('Looking for wallpaper with ID:', parsed.wallpaperId);
	console.log(
		'Available wallpapers:',
		AVAILABLE_WALLPAPERS.map((w) => ({ id: w.id, src: w.src }))
	);

	const wallpaper = getWallpaperById(parsed.wallpaperId);
	console.log('Found wallpaper:', wallpaper);

	const result = wallpaper?.src || null;
	console.log('Returning wallpaper source:', result);

	return result;
}

/**
 * Get wallpapers by category
 */
export function getWallpapersByCategory(category: string): Wallpaper[] {
	return AVAILABLE_WALLPAPERS.filter((w) => w.category === category);
}

/**
 * Get all available categories
 */
export function getWallpaperCategories(): string[] {
	return [
		...new Set(
			AVAILABLE_WALLPAPERS.map((w) => w.category).filter(
				(category) => category !== undefined
			) as string[]
		)
	];
}

/**
 * Validate if wallpaper ID exists
 */
export function isValidWallpaper(id: string): boolean {
	return AVAILABLE_WALLPAPERS.some((w) => w.id === id);
}
