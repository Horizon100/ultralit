// lib/features/email/utils/emailFormatting.ts

/**
 * Extract domain from URL for display purposes
 */
export function getDomain(url: string): string {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname.replace('www.', '');
	} catch (e) {
		// If URL parsing fails, return truncated version
		return url.length > 30 ? url.substring(0, 30) + '...' : url;
	}
}

/**
 * Clean text by removing excessive line breaks and whitespace
 */
function cleanTextSpacing(text: string): string {
	return (
		text
			// Replace multiple consecutive newlines with at most 2
			.replace(/\n{3,}/g, '\n\n')
			// Replace multiple consecutive spaces with single space
			.replace(/ {2,}/g, ' ')
			// Remove trailing/leading whitespace from each line
			.split('\n')
			.map((line) => line.trim())
			.join('\n')
			// Remove leading/trailing empty lines
			.replace(/^\n+|\n+$/g, '')
	);
}

/**
 * Format text content by converting URLs to styled buttons
 */
export function formatTextWithUrls(text: string): string {
	if (!text) return '';

	// First clean the text spacing
	const cleanedText = cleanTextSpacing(text);

	// Regex to find URLs (both http and https)
	const urlRegex = /(https?:\/\/[^\s\]<>)(]+)/g;

	// Split text by URLs and create formatted content
	const parts = cleanedText.split(urlRegex);
	const formattedParts: string[] = [];

	parts.forEach((part) => {
		if (urlRegex.test(part)) {
			// This is a URL - create a button
			const domain = getDomain(part);
			const cleanUrl = part.replace(/[\]).]+$/, ''); // Remove trailing punctuation
			formattedParts.push(
				`<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="url-button" data-domain="${domain}">${domain}</a>`
			);
		} else {
			// This is regular text - preserve line breaks and escape HTML
			const escapedText = part
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				// Convert newlines to <br> but ensure no more than one consecutive <br><br>
				.replace(/\n/g, '<br>')
				.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');
			formattedParts.push(escapedText);
		}
	});

	return formattedParts.join('');
}

/**
 * Clean and format email body content
 */
export function formatEmailBody(
	bodyHtml?: string,
	bodyText?: string
): {
	hasHtml: boolean;
	htmlContent: string;
	formattedText: string;
	cleanText: string;
} {
	const hasHtml = !!(bodyHtml && bodyHtml.trim() !== '');
	const cleanText = bodyText ? cleanTextSpacing(bodyText) : '';

	return {
		hasHtml,
		htmlContent: bodyHtml || '',
		formattedText: formatTextWithUrls(cleanText),
		cleanText
	};
}

/**
 * Extract preview text from email content
 */
export function getEmailPreview(bodyText: string, maxLength: number = 120): string {
	if (!bodyText) return '';

	// Clean text spacing first
	const cleanedText = cleanTextSpacing(bodyText);

	// Remove URLs and extra whitespace for preview
	const previewText = cleanedText
		.replace(/(https?:\/\/[^\s\]<>)(]+)/g, '[link]')
		.replace(/\s+/g, ' ')
		.trim();

	return previewText.length > maxLength ? previewText.substring(0, maxLength) + '...' : previewText;
}

/**
 * Determine email content type for display
 */
export function getEmailContentType(
	bodyHtml?: string,
	bodyText?: string
): 'html' | 'text' | 'empty' {
	if (bodyHtml && bodyHtml.trim() !== '') {
		// Check if HTML actually has visible content (not just tracking pixels)
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = bodyHtml;
		const textContent = tempDiv.textContent || tempDiv.innerText || '';
		if (textContent.trim().length > 10) {
			return 'html';
		}
	}

	if (bodyText && bodyText.trim() !== '') {
		return 'text';
	}

	return 'empty';
}

/**
 * Sanitize HTML content for safe display
 */
export function sanitizeEmailHtml(html: string): string {
	if (!html) return '';

	// Basic HTML sanitization - remove potentially dangerous elements
	const cleanHtml = html
		.replace(/<script[^>]*>.*?<\/script>/gis, '')
		.replace(/<object[^>]*>.*?<\/object>/gis, '')
		.replace(/<embed[^>]*>/gi, '')
		.replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
		.replace(/<form[^>]*>.*?<\/form>/gis, '')
		.replace(/javascript:/gi, '')
		.replace(/on\w+\s*=/gi, ''); // Remove event handlers

	return cleanHtml;
}
