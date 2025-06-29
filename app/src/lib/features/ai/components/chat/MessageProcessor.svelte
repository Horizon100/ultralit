<script lang="ts">
	import { currentCite, availableCites, type Cite } from '$lib/stores/citeStore';
	import { onMount, afterUpdate } from 'svelte';
	import { messagesStore } from '$lib/stores/messagesStore';
	import type { InternalChatMessage } from '$lib/types/types';

	// This component can be added to your chat component to handle message processing
	export const messages: InternalChatMessage[] = [];
	let isTypingInProgress = false;

	// Define base URLs for each source
	const sourceUrls: Record<Cite, string> = {
		wiki: 'https://en.wikipedia.org/wiki/',
		quora: 'https://www.quora.com/search?q=',
		x: 'https://twitter.com/search?q=',
		google: 'https://www.google.com/search?q=',
		reddit: 'https://www.reddit.com/search/?q='
	};

	// Process a message to automatically wrap important terms in <strong> tags
	function processMessageContent(content: string): string {
		/*
		 * This is a simplified example. You might want to use more sophisticated methods
		 * like NLP to identify important terms in the message
		 */

		// Example: Wrap words with initial capital letters that are likely to be important terms
		return content.replace(/\b([A-Z][a-z]{2,})\b/g, '<strong>$1</strong>');
	}
	export function setTypingState(isTyping: boolean) {
		isTypingInProgress = isTyping;
	}
	function enhanceWithCitations() {
		if (isTypingInProgress) {
			return;
		}

		const replyableElements = document.querySelectorAll(
			'.message p strong, .message li, .message blockquote'
		);

		replyableElements.forEach((element) => {
			const el = element as HTMLElement;

			// Generate an ID if needed
			if (!el.id) {
				el.id = `replyable-${Math.random().toString(36).substring(2, 15)}`;
			}

			// Find parent message container to get message ID
			const messageContainer = el.closest('.message');
			if (messageContainer) {
				const messageId =
					messageContainer.getAttribute('data-message-id') ||
					messageContainer.id.replace('message-', '');

				if (messageId) {
					el.setAttribute('data-parent-msg', messageId);
					el.classList.add('replyable');

					// Remove existing listeners to prevent duplicates
					const clone = el.cloneNode(true) as HTMLElement;
					el.parentNode?.replaceChild(clone, el);

					// Add hover effect
					clone.addEventListener('mouseenter', () => {
						clone.classList.add('hover-replyable');
					});

					clone.addEventListener('mouseleave', () => {
						clone.classList.remove('hover-replyable');
					});
				}
			}
		});

		const strongElements = document.querySelectorAll('.message p strong');

		strongElements.forEach((element) => {
			const strongEl = element as HTMLElement;

			// Remove existing listeners to prevent duplicates
			const clone = strongEl.cloneNode(true);
			strongEl.parentNode?.replaceChild(clone, strongEl);

			// Add citation hover effect
			clone.addEventListener('mouseenter', (e) => {
				const target = e.currentTarget as HTMLElement;
				const text = target.textContent || '';
				target.style.cursor = 'pointer';
				target.style.textDecoration = 'underline';
				target.title = `Click to search for "${text}" on ${$currentCite}`;
			});

			clone.addEventListener('mouseleave', (e) => {
				const target = e.currentTarget as HTMLElement;
				target.style.textDecoration = 'none';
			});

			// Add click handler to open citation source
			clone.addEventListener('click', (e) => {
				const target = e.currentTarget as HTMLElement;
				const text = target.textContent || '';
				if (text) {
					const url = `${sourceUrls[$currentCite]}${encodeURIComponent(text)}`;
					window.open(url, '_blank');
				}
			});
		});
	}

	// Listen for changes to the current cite
	const unsubscribe = currentCite.subscribe(() => {
		// When the cite changes, we need to update all citation links
		setTimeout(enhanceWithCitations, 0);
	});

	onMount(() => {
		enhanceWithCitations();

		return () => {
			unsubscribe();
		};
	});

	afterUpdate(() => {
		if (!isTypingInProgress) {
			setTimeout(enhanceWithCitations, 0);
		}
	});
</script>

<!-- This component doesn't render anything visible -->
