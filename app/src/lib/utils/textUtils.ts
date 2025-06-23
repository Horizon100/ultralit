import { processMarkdown } from '$lib/features/ai/utils/markdownProcessor';
import { clientTryCatch, unwrapOr } from '$lib/utils/errorUtils';

/**
 * Text processing and formatting utilities
 */
export class TextUtils {
	/**
	 * Adjusts font size based on content length
	 */
	static adjustFontSize(element: HTMLTextAreaElement): void {
		const textLength = element.value.length;

		if (textLength > 1000) {
			element.style.fontSize = '13px';
		} else if (textLength > 500) {
			element.style.fontSize = '14px';
		} else {
			element.style.fontSize = '15px';
		}
	}

	/**
	 * Resets textarea height to default
	 */
	static resetTextareaHeight(element: HTMLTextAreaElement): void {
		element.style.height = '60px';
		element.style.height = `${element.scrollHeight}px`;
	}

	/**
	 * Resets textarea to initial state
	 */
	static resetTextarea(element: HTMLTextAreaElement): void {
		element.value = '';
		element.style.height = '60px';
		element.style.fontSize = '15px';
	}

	/**
	 * Auto-resizes textarea based on content
	 */
	static autoResizeTextarea(element: HTMLTextAreaElement): void {
		// Reset height to calculate scrollHeight properly
		element.style.height = 'auto';

		// Set height based on scrollHeight with some padding
		const newHeight = Math.min(element.scrollHeight, 300); // Max height of 300px
		element.style.height = `${newHeight}px`;
	}

	/**
	 * Processes markdown content to HTML
	 */
	static async formatContent(content: string): Promise<string> {
		if (!content || typeof content !== 'string') return content || '';

		const result = await clientTryCatch(
			processMarkdown(content),
			'Markdown processing'
		);

		return unwrapOr(result, content);
	}
	/**
	 * Synchronously formats content (fallback)
	 */
	static formatContentSync(content: string): string {
		if (!content || typeof content !== 'string') return content || '';

		// Basic formatting as fallback
		return content
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/`(.*?)`/g, '<code>$1</code>')
			.replace(/\n/g, '<br>');
	}

	/**
	 * Truncates text to specified length with ellipsis
	 */
	static truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + '...';
	}

	/**
	 * Removes HTML tags from text
	 */
	static stripHtml(html: string): string {
		const div = document.createElement('div');
		div.innerHTML = html;
		return div.textContent || div.innerText || '';
	}

	/**
	 * Counts words in text
	 */
	static countWords(text: string): number {
		return text
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
	}

	/**
	 * Counts characters in text
	 */
	static countCharacters(text: string): number {
		return text.length;
	}

	/**
	 * Checks if text exceeds maximum visible characters
	 */
	static isTextTooLong(text: string, maxChars: number = 200): boolean {
		return text.length > maxChars;
	}

	/**
	 * Gets preview text (first N characters)
	 */
	static getPreviewText(text: string, maxChars: number = 200): string {
		if (text.length <= maxChars) return text;
		return text.slice(0, maxChars) + '...';
	}

	/**
	 * Extracts text selection from window
	 */
	static getTextSelection(): string {
		const selection = window.getSelection();
		return selection?.toString().trim() || '';
	}

	/**
	 * Clears text selection
	 */
	static clearTextSelection(): void {
		if (window.getSelection) {
			window.getSelection()?.removeAllRanges();
		}
	}

	/**
	 * Highlights text in element
	 */
	static highlightText(element: HTMLElement, searchTerm: string): void {
		if (!searchTerm.trim()) return;

		const text = element.textContent || '';
		const regex = new RegExp(`(${searchTerm})`, 'gi');
		const highlightedText = text.replace(regex, '<mark>$1</mark>');
		element.innerHTML = highlightedText;
	}

	/**
	 * Removes highlighting from element
	 */
	static removeHighlight(element: HTMLElement): void {
		const text = element.textContent || '';
		element.innerHTML = text;
	}

	/**
	 * Capitalizes first letter of text
	 */
	static capitalizeFirst(text: string): string {
		if (!text) return text;
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	/**
	 * Converts text to title case
	 */
	static toTitleCase(text: string): string {
		return text.replace(
			/\w\S*/g,
			(txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
		);
	}

	/**
	 * Sanitizes text for safe HTML insertion
	 */
	static sanitizeText(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Extracts URLs from text
	 */
	static extractUrls(text: string): string[] {
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		return text.match(urlRegex) || [];
	}

	/**
	 * Replaces URLs with clickable links
	 */
	static linkifyUrls(text: string): string {
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
	}

	/**
	 * Extracts mentions from text (e.g., @username)
	 */
	static extractMentions(text: string): string[] {
		const mentionRegex = /@([a-zA-Z0-9_]+)/g;
		const matches = text.match(mentionRegex) || [];
		return matches.map((match) => match.slice(1)); // Remove @ symbol
	}

	/**
	 * Extracts hashtags from text
	 */
	static extractHashtags(text: string): string[] {
		const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
		const matches = text.match(hashtagRegex) || [];
		return matches.map((match) => match.slice(1)); // Remove # symbol
	}
}
