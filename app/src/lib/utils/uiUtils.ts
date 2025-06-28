import { get } from 'svelte/store';
import { t } from '$lib/stores/translationStore';
import { threadsStore, type ThreadSortOption } from '$lib/stores/threadsStore';
import { clientTryCatch, isSuccess, type Result } from '$lib/utils/errorUtils';

/**
 * UI-related utility functions
 */
export class UIUtils {
	/**
	 * Gets a random greeting from translations
	 */
	static getRandomGreeting(): string {
		const $t = get(t);
		const quotes = $t('extras.greetings');

		if (Array.isArray(quotes) && quotes.every((item) => typeof item === 'string')) {
			return quotes[Math.floor(Math.random() * quotes.length)];
		}

		return 'Hello';
	}

	/**
	 * Gets a random question from translations
	 */
	static getRandomQuestions(): string {
		const $t = get(t);
		const quotes = $t('extras.questions');

		if (Array.isArray(quotes) && quotes.every((item) => typeof item === 'string')) {
			return quotes[Math.floor(Math.random() * quotes.length)];
		}

		return "What's on your mind?";
	}

	/**
	 * Gets a random quote from translations
	 */
	static getRandomQuote(): string {
		const $t = get(t);
		const quotes = $t('extras.quotes');

		if (Array.isArray(quotes) && quotes.every((item) => typeof item === 'string')) {
			return quotes[Math.floor(Math.random() * quotes.length)];
		}

		return 'The question of whether a computer can think is no more interesting than the question of whether a submarine can swim. - Edsger W. Dijkstra';
	}

	/**
	 * Gets random start prompts from translations
	 */
	static getRandomPrompts(count: number = 3): string[] {
		const $t = get(t);
		const prompts = $t('startPrompts');

		if (Array.isArray(prompts)) {
			const shuffled = [...prompts].sort(() => 0.5 - Math.random());
			return shuffled.slice(0, count);
		}

		return [];
	}

	/**
	 * Sets a specific sort option for threads
	 */
	static setSortOption(sortOption: ThreadSortOption): void {
		threadsStore.setSortOption(sortOption);
	}

	/**
	 * Toggles user selection in thread filters
	 */
	static toggleUserSelection(userId: string): void {
		threadsStore.toggleUserSelection(userId);
	}

	/**
	 * Clears all selected users from thread filters
	 */
	static clearSelectedUsers(): void {
		threadsStore.clearSelectedUsers();
	}

	/**
	 * Debounces a function call
	 */
	static debounce<T extends (...args: unknown[]) => unknown>(
		func: T,
		wait: number
	): (...args: Parameters<T>) => void {
		let timeout: ReturnType<typeof setTimeout>;

		return (...args: Parameters<T>) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), wait);
		};
	}

	/**
	 * Throttles a function call
	 */
	static throttle<T extends (...args: unknown[]) => unknown>(
		func: T,
		limit: number
	): (...args: Parameters<T>) => void {
		let inThrottle: boolean;

		return (...args: Parameters<T>) => {
			if (!inThrottle) {
				func.apply(this, args);
				inThrottle = true;
				setTimeout(() => (inThrottle = false), limit);
			}
		};
	}

	/**
	 * Checks if the current screen is mobile size
	 */
	static isMobileScreen(): boolean {
		return window.innerWidth < 1000;
	}

	/**
	 * Checks if the current screen is tablet size
	 */
	static isTabletScreen(): boolean {
		return window.innerWidth >= 768 && window.innerWidth < 1024;
	}

	/**
	 * Checks if the current screen is desktop size
	 */
	static isDesktopScreen(): boolean {
		return window.innerWidth >= 1024;
	}

	/**
	 * Gets the current screen size category
	 */
	static getScreenSize(): 'mobile' | 'tablet' | 'desktop' {
		if (this.isMobileScreen()) return 'mobile';
		if (this.isTabletScreen()) return 'tablet';
		return 'desktop';
	}

	/**
	 * Adds a CSS class to the document body
	 */
	static addBodyClass(className: string): void {
		document.body.classList.add(className);
	}

	/**
	 * Removes a CSS class from the document body
	 */
	static removeBodyClass(className: string): void {
		document.body.classList.remove(className);
	}

	/**
	 * Toggles a CSS class on the document body
	 */
	static toggleBodyClass(className: string): void {
		document.body.classList.toggle(className);
	}

	/**
	 * Scrolls an element into view with smooth behavior
	 */
	static scrollIntoView(
		element: HTMLElement,
		options: {
			behavior?: 'auto' | 'smooth';
			block?: 'start' | 'center' | 'end' | 'nearest';
			inline?: 'start' | 'center' | 'end' | 'nearest';
		} = { behavior: 'smooth', block: 'start' }
	): void {
		element.scrollIntoView(options);
	}

	/**
	 * Scrolls to the bottom of a container
	 */
	static scrollToBottom(container: HTMLElement): void {
		container.scrollTop = container.scrollHeight;
	}

	/**
	 * Scrolls to the top of a container
	 */
	static scrollToTop(container: HTMLElement): void {
		container.scrollTop = 0;
	}

	/**
	 * Checks if an element is in the viewport
	 */
	static isElementInViewport(element: HTMLElement): boolean {
		const rect = element.getBoundingClientRect();
		return (
			rect.top >= 0 &&
			rect.left >= 0 &&
			rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
			rect.right <= (window.innerWidth || document.documentElement.clientWidth)
		);
	}

	/**
	 * Gets the scroll percentage of a container
	 */
	static getScrollPercentage(container: HTMLElement): number {
		const scrollTop = container.scrollTop;
		const scrollHeight = container.scrollHeight - container.clientHeight;
		return scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
	}

	/**
	 * Checks if user is at the bottom of a scrollable container
	 */
	static isAtBottom(container: HTMLElement, threshold: number = 100): boolean {
		const scrollTop = container.scrollTop;
		const scrollHeight = container.scrollHeight;
		const clientHeight = container.clientHeight;
		return scrollTop + clientHeight >= scrollHeight - threshold;
	}

	/**
	 * Prevents page scroll when modal is open
	 */
	static preventBodyScroll(): void {
		document.body.style.overflow = 'hidden';
	}

	/**
	 * Restores page scroll when modal is closed
	 */
	static restoreBodyScroll(): void {
		document.body.style.overflow = '';
	}

	/**
	 * Focuses an element after a delay (useful for dynamic content)
	 */
	static focusElement(element: HTMLElement, delay: number = 0): void {
		setTimeout(() => {
			element.focus();
		}, delay);
	}

	/**
	 * Copies text to clipboard
	 */
	static async copyToClipboard(text: string): Promise<Result<boolean, string>> {
		const result = await clientTryCatch(navigator.clipboard.writeText(text), 'Clipboard operation');

		if (isSuccess(result)) {
			return { data: true, error: null, success: true };
		}

		return { data: null, error: result.error, success: false };
	}

	/**
	 * Creates a download link for text content
	 */
	static downloadTextAsFile(
		content: string,
		filename: string,
		mimeType: string = 'text/plain'
	): void {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	/**
	 * Formats file size for display
	 */
	static formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';

		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	/**
	 * Generates a random ID string
	 */
	static generateId(length: number = 8): string {
		return Math.random()
			.toString(36)
			.substring(2, 2 + length);
	}

	/**
	 * Capitalizes the first letter of a string
	 */
	static capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	/**
	 * Truncates text with ellipsis
	 */
	static truncate(text: string, maxLength: number): string {
		return text.length <= maxLength ? text : text.slice(0, maxLength) + '...';
	}

	/**
	 * Formats a number with commas
	 */
	static formatNumber(num: number): string {
		return num.toLocaleString();
	}

	/**
	 * Gets CSS custom property value
	 */
	static getCSSVariable(variable: string): string {
		return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
	}

	/**
	 * Sets CSS custom property value
	 */
	static setCSSVariable(variable: string, value: string): void {
		document.documentElement.style.setProperty(variable, value);
	}

	/**
	 * Creates a delay/sleep function
	 */
	static delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Handles keyboard shortcuts
	 */
	static handleKeyboardShortcut(event: KeyboardEvent, shortcuts: Record<string, () => void>): void {
		const key = event.key.toLowerCase();
		const modifiers = {
			ctrl: event.ctrlKey,
			shift: event.shiftKey,
			alt: event.altKey,
			meta: event.metaKey
		};

		// Create shortcut string (e.g., "ctrl+s", "shift+enter")
		const shortcutParts = [];
		if (modifiers.ctrl) shortcutParts.push('ctrl');
		if (modifiers.shift) shortcutParts.push('shift');
		if (modifiers.alt) shortcutParts.push('alt');
		if (modifiers.meta) shortcutParts.push('meta');
		shortcutParts.push(key);

		const shortcutString = shortcutParts.join('+');

		if (shortcuts[shortcutString]) {
			event.preventDefault();
			shortcuts[shortcutString]();
		}
	}
}
