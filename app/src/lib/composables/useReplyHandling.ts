import { chatStore } from '$lib/stores/chatStore';
import { get } from 'svelte/store';

/**
 * Composable for handling reply interactions and DOM management
 */
export function useReplyHandling() {
	/**
	 * Sets up event handlers for replyable elements
	 */
	function setupReplyableHandlers(): void {
		document.querySelectorAll('.replyable').forEach((el) => {
			el.addEventListener('click', (e) => {
				e.stopPropagation();
				const target = e.currentTarget as HTMLElement;

				// Get current store state
				const currentState = get(chatStore);
				const activeReplyMenu = currentState.activeReplyMenu;

				if (activeReplyMenu && activeReplyMenu.elementId === target.id) {
					chatStore.setActiveReplyMenu(null);
					return;
				}

				const rect = target.getBoundingClientRect();
				const position = {
					x: Math.min(rect.left + window.scrollX, window.innerWidth - 300),
					y: Math.min(rect.bottom + window.scrollY, window.innerHeight - 200)
				};

				chatStore.setActiveReplyMenu({
					elementId: target.id,
					position
				});

				chatStore.setReplyText('');
			});
		});

		// Close menu when clicking outside
		document.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			if (!target.closest('.reply-menu') && !target.classList.contains('replyable')) {
				chatStore.setActiveReplyMenu(null);
			}
		});
	}

	/**
	 * Handles clicking on a replyable element
	 */
	function handleReplyableClick(event: MouseEvent): void {
		const target = event.target as HTMLElement;
		const selection = window.getSelection();

		if (
			target.classList.contains('replyable') &&
			(!selection || selection.toString().length === 0)
		) {
			event.stopPropagation();

			// Get current state
			const currentState = get(chatStore);

			if (currentState.activeReplyMenu && currentState.activeReplyMenu.elementId === target.id) {
				chatStore.setActiveReplyMenu(null);
				return;
			}

			// Position the menu near the clicked element
			const rect = target.getBoundingClientRect();
			const position = {
				x: rect.left + window.scrollX,
				y: rect.bottom + window.scrollY
			};

			chatStore.setActiveReplyMenu({ elementId: target.id, position });
			chatStore.setReplyText('');
		} else if (!target.closest('.reply-menu')) {
			// Close menu if clicking outside
			chatStore.setActiveReplyMenu(null);
		}
	}

	/**
	 * Handles double-clicking on a replyable element
	 */
	function handleReplyableDoubleClick(event: MouseEvent): void {
		const target = event.target as HTMLElement;

		if (target.classList.contains('replyable')) {
			event.preventDefault();

			// Auto-select the text content for quick reply
			const selection = window.getSelection();
			const range = document.createRange();
			range.selectNodeContents(target);
			selection?.removeAllRanges();
			selection?.addRange(range);

			// Set the selected text as reply context
			chatStore.setReplyText(target.textContent || '');
		}
	}

	/**
	 * Toggles replies visibility for a message
	 */
	function toggleReplies(messageId: string): void {
		console.log(`[toggleReplies] Starting to toggle replies for message ID: ${messageId}`);

		try {
			// Find the replies container for this message
			const repliesContainer = document.querySelector(`.replies-to-${messageId}`);

			if (!repliesContainer) {
				console.warn(
					`[toggleReplies] No replies container found for message ID: ${messageId} - this might be expected if there are no replies`
				);
				// Still try to update the toggle button state if it exists
				updateToggleButtonState(messageId, true); // Assume hidden state if no container
				return;
			}

			// Toggle the 'hidden' class on the replies container
			const isHidden = repliesContainer.classList.toggle('hidden');
			console.log(`[toggleReplies] Toggled visibility. Now hidden: ${isHidden}`);

			// Update toggle button state
			updateToggleButtonState(messageId, isHidden);

			// If we're showing messages and have a chat div to scroll
			if (!isHidden) {
				setTimeout(() => {
					try {
						const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
						const chatMessagesDiv = document.querySelector('.chat-messages') as HTMLDivElement;

						if (messageElement && chatMessagesDiv) {
							const containerRect = chatMessagesDiv.getBoundingClientRect();
							const elementRect = messageElement.getBoundingClientRect();
							const scrollPosition =
								elementRect.top - containerRect.top + chatMessagesDiv.scrollTop;

							chatMessagesDiv.scrollTo({
								top: scrollPosition - 20,
								behavior: 'smooth'
							});
						}
					} catch (scrollError) {
						console.error(`[toggleReplies] Error during scroll:`, scrollError);
					}
				}, 100);
			}
		} catch (mainError) {
			console.error(`[toggleReplies] Critical error:`, mainError);
		}
	}

	/**
	 * Updates toggle button state for replies
	 */
	function updateToggleButtonState(messageId: string, isHidden: boolean): void {
		try {
			const toggleButton = document.querySelector(
				`[data-message-id="${messageId}"] .toggle-replies-btn .toggle-icon, 
         .reply-content .toggle-replies-btn[data-parent-id="${messageId}"] .toggle-icon`
			);

			if (toggleButton) {
				toggleButton.textContent = isHidden ? '+' : '-';
			}
		} catch (error) {
			console.error(`[updateToggleButtonState] Error:`, error);
		}
	}

	/**
	 * Clears all reply-related state
	 */
	function clearReplyState(): void {
		chatStore.setActiveReplyMenu(null);
		chatStore.setReplyText('');
	}

	/**
	 * Sets up reply handlers for a specific container
	 */
	function setupReplyHandlersForContainer(container: HTMLElement): void {
		const replyableElements = container.querySelectorAll('.replyable');

		replyableElements.forEach((element) => {
			// Type the element properly
			const htmlElement = element as HTMLElement;

			// Create properly typed event handlers
			const clickHandler = (e: Event) => handleReplyableClick(e as MouseEvent);
			const dblClickHandler = (e: Event) => handleReplyableDoubleClick(e as MouseEvent);

			// Remove existing listeners to prevent duplicates
			htmlElement.removeEventListener('click', clickHandler);
			htmlElement.removeEventListener('dblclick', dblClickHandler);

			// Add new listeners
			htmlElement.addEventListener('click', clickHandler);
			htmlElement.addEventListener('dblclick', dblClickHandler);
		});
	}

	/**
	 * Removes reply handlers from a container
	 */
	function removeReplyHandlersFromContainer(container: HTMLElement): void {
		const replyableElements = container.querySelectorAll('.replyable');

		replyableElements.forEach((element) => {
			const htmlElement = element as HTMLElement;

			// Create the same handler references
			const clickHandler = (e: Event) => handleReplyableClick(e as MouseEvent);
			const dblClickHandler = (e: Event) => handleReplyableDoubleClick(e as MouseEvent);

			htmlElement.removeEventListener('click', clickHandler);
			htmlElement.removeEventListener('dblclick', dblClickHandler);
		});
	}

	/**
	 * Gets the parent message ID from a replyable element
	 */
	function getParentMessageId(element: HTMLElement): string | null {
		return element.getAttribute('data-parent-msg');
	}

	/**
	 * Gets the selected text from a replyable element
	 */
	function getSelectedText(element: HTMLElement): string {
		const selection = window.getSelection();
		return selection?.toString().trim() || element.textContent?.trim() || '';
	}

	/**
	 * Highlights a replyable element temporarily
	 */
	function highlightReplyableElement(elementId: string, duration: number = 2000): void {
		const element = document.getElementById(elementId);
		if (element) {
			element.classList.add('highlighted');
			setTimeout(() => {
				element.classList.remove('highlighted');
			}, duration);
		}
	}

	/**
	 * Scrolls to a specific replyable element
	 */
	function scrollToReplyableElement(elementId: string): void {
		const element = document.getElementById(elementId);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	return {
		setupReplyableHandlers,
		handleReplyableClick,
		handleReplyableDoubleClick,
		toggleReplies,
		updateToggleButtonState,
		clearReplyState,
		setupReplyHandlersForContainer,
		removeReplyHandlersFromContainer,
		getParentMessageId,
		getSelectedText,
		highlightReplyableElement,
		scrollToReplyableElement
	};
}
