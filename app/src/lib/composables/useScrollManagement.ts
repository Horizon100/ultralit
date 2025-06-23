import { writable, derived, get } from 'svelte/store';
import { UIUtils } from '$lib/utils/uiUtils';

interface ScrollState {
	isUserScrolling: boolean;
	userScrollPosition: number;
	scrollThreshold: number;
	isAtBottom: boolean;
	lastScrollTop: number;
	scrollPercentage: number;
}

const initialState: ScrollState = {
	isUserScrolling: false,
	userScrollPosition: 0,
	scrollThreshold: 100,
	isAtBottom: true,
	lastScrollTop: 0,
	scrollPercentage: 0
};

export function useScrollManagement() {
	const scrollState = writable<ScrollState>(initialState);

	/**
	 * Sets up scroll management for a chat container
	 */
	function setupScrollObserver(container: HTMLElement): () => void {
		if (!container) return () => {}; // Return empty cleanup function

		let scrollTimeout: ReturnType<typeof setTimeout>;

		const handleScroll = () => {
			const scrollTop = container.scrollTop;

			// Update scroll state
			scrollState.update((state) => ({
				...state,
				userScrollPosition: scrollTop,
				isUserScrolling: true,
				isAtBottom: UIUtils.isAtBottom(container, state.scrollThreshold),
				scrollPercentage: UIUtils.getScrollPercentage(container),
				lastScrollTop: scrollTop
			}));

			// Clear scrolling flag after user stops scrolling
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				scrollState.update((state) => ({ ...state, isUserScrolling: false }));
			}, 150);
		};

		container.addEventListener('scroll', handleScroll, { passive: true });

		// Return cleanup function
		return () => {
			container.removeEventListener('scroll', handleScroll);
			clearTimeout(scrollTimeout);
		};
	}

	/**
	 * Scrolls to the bottom of a container
	 */
	function scrollToBottom(container: HTMLElement, behavior: 'auto' | 'smooth' = 'smooth'): void {
		if (!container) return;

		container.scrollTo({
			top: container.scrollHeight,
			behavior
		});
	}

	/**
	 * Scrolls to a specific message
	 */
	function scrollToMessage(messageId: string, behavior: 'auto' | 'smooth' = 'smooth'): void {
		const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
		if (messageElement) {
			messageElement.scrollIntoView({ behavior, block: 'start' });
		}
	}

	/**
	 * Scrolls to a specific position in the container
	 */
	function scrollToPosition(
		container: HTMLElement,
		position: number,
		behavior: 'auto' | 'smooth' = 'smooth'
	): void {
		if (!container) return;

		container.scrollTo({
			top: position,
			behavior
		});
	}

	/**
	 * Checks if container should auto-scroll
	 */
	function shouldAutoScroll(): boolean {
		const state = get(scrollState);
		// Auto-scroll if user is at bottom and not actively scrolling
		return state.isAtBottom && !state.isUserScrolling;
	}

	/**
	 * Handles auto-scroll behavior for new messages
	 */
	function handleNewMessage(
		container: HTMLElement,
		messageCount: number,
		lastMessageCount: number
	): void {
		if (!container || messageCount <= lastMessageCount) return;

		const state = get(scrollState);

		// If user is at bottom or close to it, auto-scroll
		if (state.isAtBottom || !state.isUserScrolling) {
			setTimeout(() => {
				scrollToBottom(container, 'smooth');
			}, 100);
		}
	}

	/**
	 * Updates scroll threshold
	 */
	function setScrollThreshold(threshold: number): void {
		scrollState.update((state) => ({ ...state, scrollThreshold: threshold }));
	}

	/**
	 * Manually sets the bottom state
	 */
	function setAtBottom(isAtBottom: boolean): void {
		scrollState.update((state) => ({ ...state, isAtBottom }));
	}

	/**
	 * Gets current scroll percentage
	 */
	function getScrollPercentage(container: HTMLElement): number {
		return UIUtils.getScrollPercentage(container);
	}

	/**
	 * Smoothly scrolls to top
	 */
	function scrollToTop(container: HTMLElement): void {
		UIUtils.scrollToTop(container);
	}

	/**
	 * Handles scroll restoration for thread changes
	 */
	function restoreScrollPosition(container: HTMLElement, position: number): void {
		if (!container) return;

		// Use requestAnimationFrame to ensure DOM is updated
		requestAnimationFrame(() => {
			container.scrollTop = position;
		});
	}

	/**
	 * Saves current scroll position for thread
	 */
	function saveScrollPosition(container: HTMLElement, threadId: string): void {
		if (!container || !threadId) return;

		const position = container.scrollTop;
		sessionStorage.setItem(`scroll_${threadId}`, position.toString());
	}

	/**
	 * Restores saved scroll position for thread
	 */
	function loadScrollPosition(container: HTMLElement, threadId: string): void {
		if (!container || !threadId) return;

		const savedPosition = sessionStorage.getItem(`scroll_${threadId}`);
		if (savedPosition) {
			const position = parseInt(savedPosition, 10);
			restoreScrollPosition(container, position);
		}
	}

	/**
	 * Handles scroll to element with offset
	 */
	function scrollToElementWithOffset(
		container: HTMLElement,
		element: HTMLElement,
		offset: number = 20
	): void {
		if (!container || !element) return;

		const containerRect = container.getBoundingClientRect();
		const elementRect = element.getBoundingClientRect();
		const scrollPosition = elementRect.top - containerRect.top + container.scrollTop - offset;

		scrollToPosition(container, scrollPosition);
	}

	/**
	 * Checks if element is visible in container
	 */
	function isElementVisible(container: HTMLElement, element: HTMLElement): boolean {
		if (!container || !element) return false;

		const containerRect = container.getBoundingClientRect();
		const elementRect = element.getBoundingClientRect();

		return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
	}

	/**
	 * Scrolls container to show element if not visible
	 */
	function ensureElementVisible(container: HTMLElement, element: HTMLElement): void {
		if (!isElementVisible(container, element)) {
			scrollToElementWithOffset(container, element);
		}
	}

	/**
	 * Handles smooth scroll with easing
	 */
	function smoothScrollTo(
		container: HTMLElement,
		targetPosition: number,
		duration: number = 300
	): Promise<void> {
		return new Promise((resolve) => {
			const startPosition = container.scrollTop;
			const distance = targetPosition - startPosition;
			const startTime = performance.now();

			function easeInOutQuad(t: number): number {
				return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
			}

			function scrollStep(currentTime: number) {
				const elapsed = currentTime - startTime;
				const progress = Math.min(elapsed / duration, 1);
				const easedProgress = easeInOutQuad(progress);

				container.scrollTop = startPosition + distance * easedProgress;

				if (progress < 1) {
					requestAnimationFrame(scrollStep);
				} else {
					resolve();
				}
			}

			requestAnimationFrame(scrollStep);
		});
	}

	// Derived stores for easy access
	const isAtBottom = derived(scrollState, ($state) => $state.isAtBottom);
	const scrollPercentage = derived(scrollState, ($state) => $state.scrollPercentage);
	const isUserScrolling = derived(scrollState, ($state) => $state.isUserScrolling);

	return {
		scrollState,
		isAtBottom,
		scrollPercentage,
		isUserScrolling,
		setupScrollObserver,
		scrollToBottom,
		scrollToMessage,
		scrollToPosition,
		shouldAutoScroll,
		handleNewMessage,
		setScrollThreshold,
		setAtBottom,
		getScrollPercentage,
		scrollToTop,
		restoreScrollPosition,
		saveScrollPosition,
		loadScrollPosition,
		scrollToElementWithOffset,
		isElementVisible,
		ensureElementVisible,
		smoothScrollTo
	};
}
