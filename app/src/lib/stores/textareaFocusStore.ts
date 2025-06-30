import { writable } from 'svelte/store';
import { threadListVisibility } from '$lib/clients/threadsClient';

// Focus state management
export const isTextareaFocused = writable(false);

// Configuration constants
export const defaultTextareaHeight = '60px';
export const maxFontSize = 30;
export const minFontSize = 20;
export const maxLength = 50;

// Timeout reference
let hideTimeout: ReturnType<typeof setTimeout>;

/**
 * Sets the textarea to focused state
 */
export function handleTextareaFocus() {
	clearTimeout(hideTimeout);
	isTextareaFocused.set(true);
	// Add this line to the textarea-utils file
	threadListVisibility.set(false);
}

/**
 * Sets the textarea to blurred state after a delay
 */
export function handleTextareaBlur(
	options: {
		getRandomQuestions?: () => string;
		getRandomQuote?: () => string;
		t?: (key: string) => string;
	} = {}
) {
	hideTimeout = setTimeout(() => {
		isTextareaFocused.set(false);
	}, 500);
}

/**
 * Immediately sets the textarea to blurred state without delay
 */
export function handleImmediateTextareaBlur() {
	clearTimeout(hideTimeout);
	isTextareaFocused.set(false);
}

/**
 * Adjusts font size based on content length
 * @param element Textarea element to adjust
 */
export function adjustFontSize(element: HTMLTextAreaElement | null) {
	if (!element) return;

	const contentLength = element.value.length;

	if (contentLength <= maxLength) {
		element.style.fontSize = `${maxFontSize}px`;
	} else {
		const fontSize = Math.max(minFontSize, maxFontSize - (contentLength - maxLength) / 2);
		element.style.fontSize = `${fontSize}px`;
	}
}

/**
 * Resets the textarea height to its default state
 * @param element The textarea element to reset
 */
export function resetTextareaHeight(element: HTMLTextAreaElement | null) {
	if (!element) return;

	// Clear any inline height styling
	element.style.height = '';

	// Force browser to recalculate the layout
	void element.offsetHeight;

	// Set to auto first to shrink if needed
	element.style.height = 'auto';

	// Then set to default height
	setTimeout(() => {
		if (element) {
			element.style.height = defaultTextareaHeight;
		}
	}, 0);
}

/**
 * Adjusts textarea height based on content
 * @param element Textarea element to adjust
 */
export function adjustTextareaHeight(element: HTMLTextAreaElement | null) {
	if (!element) return;

	// Reset to auto height to properly calculate scrollHeight
	element.style.height = 'auto';

	// Set the height to match content
	element.style.height = `${element.scrollHeight}px`;
}
