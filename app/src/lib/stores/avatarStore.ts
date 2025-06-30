import { writable } from 'svelte/store';

export const avatarTimestamp = writable(Date.now());

export function refreshAvatar() {
	avatarTimestamp.set(Date.now());
}