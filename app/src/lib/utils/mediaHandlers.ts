// lib/utils/mediaHandlers.ts
import { writable, type Writable } from 'svelte/store';

// Types
export interface AudioState {
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	isMuted: boolean;
}

export interface AudioManager {
	elements: { [key: string]: HTMLAudioElement };
	states: Writable<{ [key: string]: AudioState }>;
}

// Global audio manager
const audioElements: { [key: string]: HTMLAudioElement } = {};
const audioStatesStore = writable<{ [key: string]: AudioState }>({});

// Initialize audio state for an attachment
export function initAudioState(attachmentId: string): void {
	audioStatesStore.update((states) => {
		if (!states[attachmentId]) {
			states[attachmentId] = {
				isPlaying: false,
				currentTime: 0,
				duration: 0,
				volume: 1,
				isMuted: false
			};
		}
		return states;
	});
}

// Register audio element
export function registerAudioElement(attachmentId: string, element: HTMLAudioElement): void {
	audioElements[attachmentId] = element;
}

// Get audio states store
export function getAudioStatesStore() {
	return audioStatesStore;
}

// Audio control functions
export function togglePlayPause(attachmentId: string): void {
	const audioElement = audioElements[attachmentId];
	if (!audioElement) return;

	audioStatesStore.update((states) => {
		const state = states[attachmentId];
		if (!state) return states;

		if (state.isPlaying) {
			audioElement.pause();
			state.isPlaying = false;
		} else {
			audioElement.play();
			state.isPlaying = true;
		}
		return states;
	});
}

// Update these functions in your lib/utils/mediaHandlers.ts

export function handleAudioLoaded(attachmentId: string): void {
	const audioElement = audioElements[attachmentId];
	if (!audioElement) return;

	audioStatesStore.update((states) => {
		const state = states[attachmentId];
		if (!state) return states;

		// Check if duration is available and valid
		if (audioElement.duration && !isNaN(audioElement.duration) && isFinite(audioElement.duration)) {
			state.duration = audioElement.duration;
		}

		// Also update current time
		state.currentTime = audioElement.currentTime || 0;
		audioElement.volume = state.volume;
		return states;
	});
}

export function handleTimeUpdate(attachmentId: string): void {
	const audioElement = audioElements[attachmentId];
	if (!audioElement) return;

	audioStatesStore.update((states) => {
		const state = states[attachmentId];
		if (!state) return states;

		state.currentTime = audioElement.currentTime;

		// Also update duration if it wasn't available before
		if (
			audioElement.duration &&
			!isNaN(audioElement.duration) &&
			isFinite(audioElement.duration) &&
			state.duration === 0
		) {
			state.duration = audioElement.duration;
		}

		return states;
	});
}

export function handleAudioEnded(attachmentId: string): void {
	audioStatesStore.update((states) => {
		const state = states[attachmentId];
		if (!state) return states;

		state.isPlaying = false;
		state.currentTime = 0;
		return states;
	});
}

export function handleProgressChange(attachmentId: string, event: Event): void {
	const target = event.target as HTMLInputElement;
	const newTime = parseFloat(target.value);
	const audioElement = audioElements[attachmentId];

	if (!audioElement) return;

	audioStatesStore.update((states) => {
		const state = states[attachmentId];
		if (!state) return states;

		audioElement.currentTime = newTime;
		state.currentTime = newTime;
		return states;
	});
}

export function handleVolumeChange(attachmentId: string, event: Event): void {
	const target = event.target as HTMLInputElement;
	const volume = parseFloat(target.value);
	const audioElement = audioElements[attachmentId];

	if (!audioElement) return;

	audioStatesStore.update((states) => {
		const state = states[attachmentId];
		if (!state) return states;

		state.volume = volume;
		audioElement.volume = volume;
		state.isMuted = volume === 0;
		return states;
	});
}

export function toggleMute(attachmentId: string): void {
	const audioElement = audioElements[attachmentId];
	if (!audioElement) return;

	audioStatesStore.update((states) => {
		const state = states[attachmentId];
		if (!state) return states;

		if (state.isMuted) {
			audioElement.volume = state.volume || 0.5;
			state.isMuted = false;
			if (state.volume === 0) state.volume = 0.5;
		} else {
			audioElement.volume = 0;
			state.isMuted = true;
		}
		return states;
	});
}

export function formatTime(seconds: number): string {
	if (!seconds || isNaN(seconds)) return '0:00';

	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Cleanup function for component destruction
export function cleanupAudioPlayer(attachmentId: string): void {
	const audioElement = audioElements[attachmentId];
	if (audioElement) {
		audioElement.pause();
		delete audioElements[attachmentId];
	}

	audioStatesStore.update((states) => {
		delete states[attachmentId];
		return states;
	});
}

// Pause all other audio players when one starts playing
export function pauseOtherAudioPlayers(currentAttachmentId: string): void {
	Object.keys(audioElements).forEach((attachmentId) => {
		if (attachmentId !== currentAttachmentId) {
			const audioElement = audioElements[attachmentId];
			if (audioElement && !audioElement.paused) {
				audioElement.pause();
				audioStatesStore.update((states) => {
					if (states[attachmentId]) {
						states[attachmentId].isPlaying = false;
					}
					return states;
				});
			}
		}
	});
}
