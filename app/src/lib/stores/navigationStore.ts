// src/lib/stores/navigationStore.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const isNavigating = writable(false);

interface NavigationState {
	activeSection: string;
	isScrolling: boolean;
}

function createNavigationStore() {
	const { subscribe, set, update } = writable<NavigationState>({
		activeSection: 'start',
		isScrolling: false
	});

	return {
		subscribe,

		setActiveSection: (sectionId: string) => {
			update((state) => ({ ...state, activeSection: sectionId }));
		},

		scrollToSection: (sectionId: string) => {
			update((state) => ({ ...state, isScrolling: true }));

			const section = document.getElementById(sectionId);
			if (section) {
				section.scrollIntoView({ behavior: 'smooth' });

				setTimeout(() => {
					update((state) => ({
						...state,
						activeSection: sectionId,
						isScrolling: false
					}));
				}, 500);
			} else {
				update((state) => ({
					...state,
					activeSection: sectionId,
					isScrolling: false
				}));
			}
		},

		initializeScrollObserver: () => {
			if (!browser) return () => {};

			const sections = ['start', 'features', 'pricing', 'about'];
			let isUserScrolling = false;

			const observerOptions = {
				root: null,
				rootMargin: '-20% 0px -20% 0px',
				threshold: 0.3
			};

			const observer = new IntersectionObserver((entries) => {
				if (isUserScrolling) {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							const sectionId = entry.target.id;
							update((state) => ({ ...state, activeSection: sectionId }));
						}
					});
				}
			}, observerOptions);

			sections.forEach((sectionId) => {
				const element = document.getElementById(sectionId);
				if (element) {
					observer.observe(element);
				}
			});

			let scrollTimeout: ReturnType<typeof setTimeout>;

			const handleScroll = () => {
				isUserScrolling = true;

				if (scrollTimeout) {
					clearTimeout(scrollTimeout);
				}

				scrollTimeout = setTimeout(() => {
					isUserScrolling = false;
				}, 150);
			};

			const handleScrollPosition = () => {
				if (!isUserScrolling) return;

				const scrollY = window.scrollY;
				const windowHeight = window.innerHeight;

				const sectionElements = sections
					.map((id) => ({
						id,
						element: document.getElementById(id)
					}))
					.filter((item) => item.element);

				let currentSection = 'start';
				let maxVisibility = 0;

				sectionElements.forEach(({ id, element }) => {
					if (!element) return;

					const rect = element.getBoundingClientRect();
					const elementTop = rect.top;
					const elementBottom = rect.bottom;

					const visibleTop = Math.max(0, Math.min(windowHeight, windowHeight - elementTop));
					const visibleBottom = Math.max(0, Math.min(windowHeight, elementBottom));
					const visibleHeight = Math.max(0, visibleBottom - Math.max(0, windowHeight - elementTop));

					const visibility = visibleHeight / windowHeight;

					if (visibility > maxVisibility) {
						maxVisibility = visibility;
						currentSection = id;
					}
				});

				update((state) => ({ ...state, activeSection: currentSection }));
			};

			window.addEventListener('scroll', handleScroll, { passive: true });
			window.addEventListener('scroll', handleScrollPosition, { passive: true });

			// Cleanup function
			return () => {
				observer.disconnect();
				window.removeEventListener('scroll', handleScroll);
				window.removeEventListener('scroll', handleScrollPosition);
				if (scrollTimeout) {
					clearTimeout(scrollTimeout);
				}
			};
		},

		reset: () => {
			set({ activeSection: 'start', isScrolling: false });
		}
	};
}

export const navigationStore = createNavigationStore();
