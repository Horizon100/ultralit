// src/lib/stores/timerStore.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { TimerSession } from '$lib/types/types';
import { storageTryCatch, tryCatchSync } from '$lib/utils/errorUtils';

interface TimerState {
	isTracking: boolean;
	seconds: number;
	startTime: Date | null;
}

const STORAGE_KEY = 'timer_state';

// Default state
const defaultState: TimerState = {
	isTracking: false,
	seconds: 0,
	startTime: null
};

// Load initial state from localStorage if available
function loadTimerState(): TimerState {
	if (!browser) return defaultState;

	return storageTryCatch(
		() => {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (!stored) return defaultState;

			const parsed = JSON.parse(stored);

			// If we were tracking, calculate elapsed time since last save
			if (parsed.isTracking && parsed.startTime) {
				const startTime = new Date(parsed.startTime);
				const now = new Date();
				const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

				return {
					...parsed,
					startTime,
					seconds: Math.max(0, elapsedSeconds) // Ensure non-negative
				};
			}

			return {
				...parsed,
				startTime: parsed.startTime ? new Date(parsed.startTime) : null
			};
		},
		defaultState,
		'Error loading timer state from localStorage'
	);
}

// Create the store
function createTimerStore() {
	const { subscribe, update } = writable<TimerState>(loadTimerState());

	let interval: ReturnType<typeof setInterval> | null = null;

	// Save state to localStorage
	function saveState(state: TimerState) {
		if (browser) {
			storageTryCatch(
				() => {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
				},
				undefined,
				'Error saving timer state to localStorage'
			);
		}
	}

	// Start the timer interval
	function startInterval() {
		if (interval) clearInterval(interval);

		interval = setInterval(() => {
			update((state) => {
				const newState = { ...state, seconds: state.seconds + 1 };
				saveState(newState);
				return newState;
			});
		}, 1000);
	}

	// Stop the timer interval
	function stopInterval() {
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
	}

	return {
		subscribe,

		startTracking: () => {
			update((state) => {
				const newState = tryCatchSync(() => {
					const startTime = new Date();
					return {
						...state,
						isTracking: true,
						startTime,
						seconds: 0
					};
				});

				if (newState.success) {
					saveState(newState.data);
					startInterval();
					return newState.data;
				} else {
					console.error('Failed to start tracking:', newState.error);
					return state;
				}
			});
		},

		stopTracking: () => {
			update((state) => {
				const newState = tryCatchSync(() => ({
					...state,
					isTracking: false,
					startTime: null,
					seconds: 0
				}));

				if (newState.success) {
					saveState(newState.data);
					stopInterval();
					return newState.data;
				} else {
					console.error('Failed to stop tracking:', newState.error);
					return state;
				}
			});
		},

		// Initialize the store (call this when the app starts)
		initialize: () => {
			update((state) => {
				const initResult = tryCatchSync(() => {
					if (state.isTracking && state.startTime) {
						startInterval();
					}
					return state;
				});

				if (initResult.success) {
					return initResult.data;
				} else {
					console.error('Failed to initialize timer store:', initResult.error);
					return state;
				}
			});
		},

		// Get current session data for saving
		getCurrentSession: (): TimerSession | null => {
			let currentState: TimerState | undefined;
			update((state) => {
				currentState = state;
				return state;
			});

			if (!currentState || !currentState.isTracking || !currentState.startTime) {
				return null;
			}

			const sessionResult = tryCatchSync(() => {
				if (!currentState || !currentState.startTime) {
					throw new Error('Invalid current state or missing start time');
				}

				const endTime = new Date();
				return {
					date: currentState.startTime.toISOString().split('T')[0],
					startTime: currentState.startTime.toISOString(),
					endTime: endTime.toISOString(),
					duration: currentState.seconds
				};
			});

			if (sessionResult.success) {
				return sessionResult.data;
			} else {
				console.error('Failed to get current session:', sessionResult.error);
				return null;
			}
		},

		// Clean up resources
		destroy: () => {
			const destroyResult = tryCatchSync(() => {
				stopInterval();
			});

			if (!destroyResult.success) {
				console.error('Failed to destroy timer store:', destroyResult.error);
			}
		}
	};
}

export const timerStore = createTimerStore();

// Initialize the store when the module loads
if (browser) {
	const initResult = tryCatchSync(() => {
		timerStore.initialize();

		// Save session before page unload
		window.addEventListener('beforeunload', () => {
			timerStore.destroy();
		});
	});

	if (!initResult.success) {
		console.error('Failed to set up timer store:', initResult.error);
	}
}