// src/lib/utils/colorUtils.ts

/**
 * Generates a random, consistently bright color based on a string input.
 * The same input string will always generate the same color.
 * 
 * @param input String to generate a color from
 * @returns CSS HSL color string
 */
export function getRandomBrightColor(input: string): string {
    // Generate a hash from the string
    const hash = input.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Convert hash to a hue (0-360)
    const h = Math.abs(hash % 360);
    
    // Use fixed saturation and lightness values for consistently bright colors
    return `hsl(${h}, 70%, 60%)`;
}

/**
 * Determines if a color is light or dark based on its luminance
 * 
 * @param color CSS color string (hex, rgb, hsl)
 * @returns Boolean indicating if the color is light
 */
export function isLightColor(color: string): boolean {
    // For HSL colors
    if (color.startsWith('hsl')) {
        const hslMatch = color.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
        if (hslMatch) {
            const h = parseInt(hslMatch[1], 10);
            const s = parseInt(hslMatch[2], 10);
            const l = parseInt(hslMatch[3], 10);
            
            // Lightness above 65% is considered light
            return l > 65;
        }
    }
    
    // For hex colors, convert to RGB
    if (color.startsWith('#')) {
        const hex = color.substring(1);
        const rgb = parseInt(hex, 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        
        /*
         * Calculate relative luminance using the formula
         * 0.299 * R + 0.587 * G + 0.114 * B
         */
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.65;
    }
    
    // For RGB colors
    const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.65;
    }
    
    // Default to false if the color format is not recognized
    return false;
}

/**
 * Gets a contrasting color (black or white) for text to display against a background
 * 
 * @param backgroundColor CSS color string
 * @returns Either 'black' or 'white'
 */
export function getContrastingTextColor(backgroundColor: string): string {
    return isLightColor(backgroundColor) ? 'black' : 'white';
}