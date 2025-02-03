import { writable } from 'svelte/store';

import type {
	ExpandedSections,
	ThreadGroup,
	MessageState,
	PromptState,
	UIState,
	AIModel,
	ChatMessage,
	InternalChatMessage,
	Scenario,
	ThreadStoreState,
	Projects,
	Task,
	Attachment,
	Guidance,
	RoleType,
	PromptType,
	NetworkData,
	AIAgent,
	Network,
	Threads,
	Messages
} from '$lib/types/types';
import {
	isMinimized,
	chatMessagesDiv,
	showScrollButton,
	scrollToBottom,
	lastScrollTop,
	handleScroll,
	handleScrolling
} from '$lib/ui/navigation';

export let isTextareaFocused = false;
export let hideTimeout: ReturnType<typeof setTimeout>;
export let isDragging = false;
export let startY: number;
export let scrollTopStart: number;
export const searchQuery = writable('');

export const expandedSections = writable<ExpandedSections>({
	prompts: false,
	models: false
});
export const handleTextareaFocus = () => {
	clearTimeout(hideTimeout); // Clear any existing timeout
	isTextareaFocused = true;
};
export const handleTextareaBlur = () => {
	// Set a timeout before hiding the button
	hideTimeout = setTimeout(() => {
		isTextareaFocused = false;
	}, 300);
};

export function toggleSection(section: keyof ExpandedSections): void {
	expandedSections.update((sections) => {
		// Create a new object with all sections closed
		const newSections: ExpandedSections = {
			// tags: false,
			prompts: false,
			models: false
		};

		/*
		 * If the clicked section was not already open, open it
		 * If it was open, it remains closed (all sections false)
		 */
		if (!sections[section]) {
			newSections[section] = true;
		}

		return newSections;
	});
}

export function drag(event: MouseEvent) {
	if (isDragging) {
		const deltaY = startY - event.clientY;
		chatMessagesDiv.scrollTop = scrollTopStart + deltaY;
	}
}
export function stopDrag() {
	isDragging = false;
	document.removeEventListener('mousemove', drag);
	document.removeEventListener('mouseup', stopDrag);
}
