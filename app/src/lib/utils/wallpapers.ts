// src/lib/utils/wallpapers.ts

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
	const filename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';
	
	// Generate a readable name (capitalize and replace underscores/hyphens with spaces)
	const name = filename
		.replace(/[-_]/g, ' ')
		.replace(/\b\w/g, l => l.toUpperCase());
	
	// Auto-categorize based on filename patterns (you can customize this)
	let category = 'general';
	if (filename.includes('nature') || filename.includes('landscape')) category = 'nature';
	if (filename.includes('abstract') || filename.includes('pattern')) category = 'abstract';
	if (filename.includes('minimal') || filename.includes('clean')) category = 'minimal';
	if (filename.includes('dark') || filename.includes('night')) category = 'dark';
	if (filename.includes('light') || filename.includes('bright')) category = 'light';
	if (filename.includes('aristotle') || filename.includes('einstein') || filename.includes('philosopher')) category = 'scholars';
	
	console.log(`Creating wallpaper: ${filename} -> ${name} (${category})`);
	
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

console.log('Available wallpapers:', AVAILABLE_WALLPAPERS.length, AVAILABLE_WALLPAPERS.map(w => w.id));

// Default to first available wallpaper or null if none
export const DEFAULT_WALLPAPER = autoWallpapers.length > 0 ? autoWallpapers[0].id : null;

/**
 * Parse wallpaper preference from string (backward compatibility), object, or array
 */
export function parseWallpaperPreference(preference: string | WallpaperPreference | WallpaperPreferenceArray | undefined): WallpaperPreference {
	console.log('parseWallpaperPreference called with:', preference, 'type:', typeof preference);
	
	if (!preference) {
		console.log('No preference provided, returning default');
		return { wallpaperId: null, isActive: false };
	}
	
	// If it's an array [wallpaperId, isActive]
	if (Array.isArray(preference)) {
		console.log('Preference is array, parsing...');
		const [wallpaperId, isActive] = preference;
		const result = {
			wallpaperId: wallpaperId || null,
			isActive: isActive ?? false
		};
		console.log('Array converted to:', result);
		return result;
	}
	
	// If it's a string (legacy format or JSON), convert to new format
	if (typeof preference === 'string') {
		console.log('Preference is string, attempting to parse...');
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
			if (parsed && typeof parsed === 'object' && 'wallpaperId' in parsed && 'isActive' in parsed) {
				console.log('Valid JSON object found, returning:', parsed);
				return parsed;
			}
		} catch (err) {
			console.log('JSON parse failed, treating as legacy wallpaper ID string:', err);
			// If JSON parse fails, treat as wallpaper ID string (legacy)
			const result = {
				wallpaperId: preference === 'none' ? null : preference,
				isActive: preference !== 'none'
			};
			console.log('Legacy string converted to:', result);
			return result;
		}
	}
	
	// If it's already an object, return as is
	console.log('Preference is object, returning as-is:', preference);
	return preference as WallpaperPreference;
}

/**
 * Convert wallpaper preference to string for storage (supports both object and array formats)
 */
export function stringifyWallpaperPreference(preference: WallpaperPreference, useArrayFormat = false): string {
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
	return AVAILABLE_WALLPAPERS.find(w => w.id === id) || null;
}

/**
 * Get wallpaper source by preference, with fallback handling
 */
export function getWallpaperSrc(preference?: string | WallpaperPreference): string | null {
	console.log('getWallpaperSrc called with:', preference);
	
	const parsed = parseWallpaperPreference(preference);
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
	console.log('Available wallpapers:', AVAILABLE_WALLPAPERS.map(w => ({ id: w.id, src: w.src })));
	
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
	return AVAILABLE_WALLPAPERS.filter(w => w.category === category);
}

/**
 * Get all available categories
 */
export function getWallpaperCategories(): string[] {
	return [...new Set(AVAILABLE_WALLPAPERS
		.map(w => w.category)
		.filter(category => category !== undefined) as string[]
	)];
}
/**
 * Validate if wallpaper ID exists
 */
export function isValidWallpaper(id: string): boolean {
	return AVAILABLE_WALLPAPERS.some(w => w.id === id);
}