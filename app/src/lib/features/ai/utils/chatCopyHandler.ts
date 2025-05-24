import { MarkupFormatter } from './markupFormatter';

export class ChatCopyHandler {
	private static instance: ChatCopyHandler | null = null;
	private initialized = false;

	/**
	 * Get the singleton instance of the ChatCopyHandler
	 */
	public static getInstance(): ChatCopyHandler {
		if (!this.instance) {
			this.instance = new ChatCopyHandler();
		}
		return this.instance;
	}

	/**
	 * Initialize the copy handler by attaching event listeners
	 * @param chatMessagesElement - The DOM element containing chat messages
	 */
	public initialize(chatMessagesElement: HTMLElement): void {
		if (this.initialized) return;

		// Add a copy event listener to the chat messages container
		chatMessagesElement.addEventListener('copy', this.handleCopy.bind(this));

		this.initialized = true;
		console.log('ChatCopyHandler initialized');
	}

	/**
	 * Clean up event listeners
	 * @param chatMessagesElement - The DOM element to remove listeners from
	 */
	public cleanup(chatMessagesElement: HTMLElement): void {
		if (!this.initialized) return;

		chatMessagesElement.removeEventListener('copy', this.handleCopy.bind(this));
		this.initialized = false;
	}

	/**
	 * Handle copy events to strip HTML markup
	 * @param event - The copy event
	 */
	private handleCopy(event: ClipboardEvent): void {
		// Get the currently selected text
		const selection = window.getSelection();
		if (!selection) return;

		const selectedText = selection.toString();
		if (!selectedText) return;

		// If HTML is being copied, replace it with plain text
		if (selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			const container = document.createElement('div');
			container.appendChild(range.cloneContents());

			// Only process if there's HTML content
			if (container.innerHTML !== container.textContent) {
				// Get plain text version
				const plainText = MarkupFormatter.stripHtml(container.innerHTML);

				// Replace the clipboard data with plain text
				event.clipboardData?.setData('text/plain', plainText);
				event.preventDefault(); // Prevent the default copy behavior
			}
		}
	}
}
