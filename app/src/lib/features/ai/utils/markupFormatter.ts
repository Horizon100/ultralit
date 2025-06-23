// MarkupFormatter.ts - Utility for handling markup formatting and text operations
import { extractPlainTextFromHtml } from '$lib/features/ai/utils/markdownProcessor';
import { 
	clientTryCatch, 
	validationTryCatch,
	isSuccess, 
	isFailure,
	type Result 
} from '$lib/utils/errorUtils';

export class MarkupFormatter {
	/**
	 * Removes HTML tags from a string to create clean plain text
	 * @param html - The HTML string to convert to plain text
	 * @returns Result containing clean text version with no HTML markup
	 */
	static stripHtml(html: string): Result<string, string> {
		const validation = validationTryCatch(() => {
			if (typeof html !== 'string') {
				throw new Error('Input must be a string');
			}
			return html;
		}, 'HTML input validation');

		if (isFailure(validation)) {
			return { data: null, error: validation.error, success: false };
		}



		const result = validationTryCatch(() => {
			return extractPlainTextFromHtml(html);
		}, 'HTML stripping');

		return result;
	}

	/**
	 * Copies the given text to clipboard with HTML markup removed
	 * @param text - HTML string to copy as plain text
	 * @returns Promise resolving to Result with success status
	 */
	static async copyAsPlainText(text: string): Promise<Result<boolean, string>> {
		// Validate input
		const validation = validationTryCatch(() => {
			if (typeof text !== 'string') {
				throw new Error('Text must be a string');
			}
			return text;
		}, 'copy text input validation');

		if (isFailure(validation)) {
			return { data: null, error: validation.error, success: false };
		}

		// Strip HTML markup
		const stripResult = this.stripHtml(text);
		if (isFailure(stripResult)) {
			return { data: null, error: stripResult.error, success: false };
		}

		const plainText = stripResult.data;

		// Copy to clipboard
		const copyResult = await clientTryCatch(
			navigator.clipboard.writeText(plainText),
			'Copying to clipboard'
		);

		if (isSuccess(copyResult)) {
			return { data: true, error: null, success: true };
		} else {
			return { data: null, error: copyResult.error, success: false };
		}
	}

	/**
	 * Legacy method that maintains original API for backward compatibility
	 * @param html - The HTML string to convert to plain text
	 * @returns A clean text version with no HTML markup
	 */
	static stripHtmlLegacy(html: string): string {
		const result = this.stripHtml(html);
		return isSuccess(result) ? result.data : '';
	}

	/**
	 * Legacy method that maintains original API for backward compatibility
	 * @param text - HTML string to copy as plain text
	 * @returns Promise resolving to true if successfully copied
	 */
	static async copyAsPlainTextLegacy(text: string): Promise<boolean> {
		const result = await this.copyAsPlainText(text);
		return isSuccess(result) ? result.data : false;
	}
}