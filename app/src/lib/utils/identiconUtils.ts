/**
 * Utility functions for generating identicons based on string input
 * Generates deterministic, colorful geometric patterns as SVG strings
 */

interface IdenticonOptions {
	size?: number;
	backgroundColor?: string;
	margin?: number;
	gridSize?: number;
}

/**
 * Simple hash function to convert string to number
 */
function hashCode(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash);
}

/**
 * Generate a deterministic color from a hash
 */
function generateColor(hash: number, saturation = 100, lightness = 100): string {
	const hue = hash % 360;
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generate a 5x5 symmetric pattern from hash
 */
function generatePattern(hash: number): boolean[] {
	const pattern: boolean[] = [];

	// Generate first 3 columns (15 cells)
	for (let i = 0; i < 15; i++) {
		pattern[i] = Boolean((hash >> i) & 1);
	}

	// Mirror to create 5x5 symmetric pattern
	const fullPattern: boolean[] = [];
	for (let row = 0; row < 5; row++) {
		for (let col = 0; col < 5; col++) {
			if (col < 3) {
				fullPattern[row * 5 + col] = pattern[row * 3 + col];
			} else {
				// Mirror columns 3 and 4 from columns 1 and 0
				fullPattern[row * 5 + col] = pattern[row * 3 + (4 - col)];
			}
		}
	}

	return fullPattern;
}

/**
 * Generate an identicon SVG string based on input string
 */
export function generateIdenticon(input: string, options: IdenticonOptions = {}): string {
	const { size = 64, backgroundColor = '#f0f0f0', margin = 8, gridSize = 5 } = options;

	if (!input || input.trim().length === 0) {
		throw new Error('Input string cannot be empty');
	}

	const hash = hashCode(input);
	const pattern = generatePattern(hash);
	const primaryColor = generateColor(hash);
	const secondaryColor = generateColor(hash >> 8, 60, 70);

	const cellSize = (size - margin * 2) / gridSize;

	let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;
	svg += `<rect width="${size}" height="${size}" fill="${backgroundColor}" rx="4"/>`;

	for (let i = 0; i < pattern.length; i++) {
		if (pattern[i]) {
			const row = Math.floor(i / gridSize);
			const col = i % gridSize;
			const x = margin + col * cellSize;
			const y = margin + row * cellSize;

			// Use secondary color for center column to add variety
			const color = col === 2 ? secondaryColor : primaryColor;

			svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" rx="1"/>`;
		}
	}

	svg += '</svg>';
	return svg;
}

/**
 * Generate identicon as data URL for direct use in img src
 */
export function generateIdenticonDataUrl(input: string, options: IdenticonOptions = {}): string {
	const svg = generateIdenticon(input, options);
	const encoded = encodeURIComponent(svg);
	return `data:image/svg+xml,${encoded}`;
}

/**
 * Generate multiple size variants of an identicon
 */
export function generateIdenticonSizes(
	input: string,
	sizes: number[] = [32, 64, 128],
	options: Omit<IdenticonOptions, 'size'> = {}
): Record<number, string> {
	const result: Record<number, string> = {};

	sizes.forEach((size) => {
		result[size] = generateIdenticonDataUrl(input, { ...options, size });
	});

	return result;
}

/**
 * Generate identicon for user - typically using email or username
 */
export function generateUserIdenticon(userIdentifier: string, size = 64): string {
	// Normalize identifier to ensure consistency
	const normalized = userIdentifier.toLowerCase().trim();

	return generateIdenticonDataUrl(normalized, {
		size,
		backgroundColor: 'transparent',
		margin: 4
	});
}

// Example usage and types export
export type { IdenticonOptions };

// Helper to get fallback identifier from user object
export function getUserIdentifier(
	user: { email?: string; username?: string; name?: string; id?: string } | null
): string {
	if (!user) return 'anonymous';
	return user.email || user.username || user.name || user.id || 'anonymous';
}
