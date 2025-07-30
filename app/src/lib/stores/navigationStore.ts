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

			console.log('🔍 Initializing scroll observer...');
			const sections = ['start', 'features', 'pricing', 'integrations'];

			// Check if sections exist in DOM
			sections.forEach((sectionId) => {
				const element = document.getElementById(sectionId);
				console.log(`Section ${sectionId}:`, element ? 'Found' : 'NOT FOUND');
			});

			const observerOptions = {
				root: null,
				rootMargin: '0px 0px -50% 0px',
				threshold: 0.1
			};

			const observer = new IntersectionObserver((entries) => {
				console.log('🔍 Observer triggered with entries:', entries.length);
				entries.forEach((entry) => {
					console.log(`Section ${entry.target.id}:`, entry.isIntersecting ? 'VISIBLE' : 'hidden');
					if (entry.isIntersecting) {
						const sectionId = entry.target.id;
						update((state) => {
							if (!state.isScrolling) {
								console.log('✅ Setting active section:', sectionId);
								return { ...state, activeSection: sectionId };
							}
							console.log('⏸️ Skipping update - currently scrolling');
							return state;
						});
					}
				});
			}, observerOptions);

			let observedCount = 0;
			sections.forEach((sectionId) => {
				const element = document.getElementById(sectionId);
				if (element) {
					observer.observe(element);
					observedCount++;
					console.log(`📍 Observing section: ${sectionId}`);
				} else {
					console.warn(`❌ Could not find section: ${sectionId}`);
				}
			});

			console.log(`📊 Total sections observed: ${observedCount}/${sections.length}`);

			return () => {
				console.log('🧹 Cleaning up scroll observer');
				observer.disconnect();
			};
		},

		reset: () => {
			set({ activeSection: 'start', isScrolling: false });
		}
	};
}

export const navigationStore = createNavigationStore();
